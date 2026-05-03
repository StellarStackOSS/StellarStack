import { randomUUID } from "node:crypto"

import type IORedis from "ioredis"
import type { Logger } from "pino"

import {
  daemonBridgeEnvelopeSchema,
} from "@workspace/daemon-proto/messages"
import type {
  DaemonEnvelope,
  DaemonMessage,
} from "@workspace/daemon-proto/messages.types"

import type { Env } from "@/env"
import type {
  DaemonPushCallback,
  DaemonRequestResult,
  DaemonStreamCallback,
} from "@/lib/DaemonClient.types"

const safeParse = (text: string): unknown => {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

type Pending = {
  resolve: (result: DaemonRequestResult) => void
  reject: (reason: Error) => void
  onStream?: DaemonStreamCallback
  timer: NodeJS.Timeout
}

/**
 * Worker-side client for the API ↔ daemon control bridge.
 *
 * The API holds the daemon WebSocket; the worker publishes commands onto
 * `DAEMON_CMD_CHANNEL` and listens for responses on `DAEMON_RESP_CHANNEL`,
 * correlating request and response frames by `envelope.id`. Streamed
 * intermediate frames (install logs) fire the optional `onStream` callback;
 * the terminal `ack` or `error` envelope resolves the promise.
 */
export class DaemonClient {
  private readonly publisher: IORedis
  private readonly subscriber: IORedis
  private readonly env: Env
  private readonly logger: Logger
  private readonly pending = new Map<string, Pending>()
  private readonly pushListeners = new Set<DaemonPushCallback>()
  private started = false

  public constructor(params: {
    publisher: IORedis
    subscriber: IORedis
    env: Env
    logger: Logger
  }) {
    this.publisher = params.publisher
    this.subscriber = params.subscriber
    this.env = params.env
    this.logger = params.logger.child({ component: "DaemonClient" })
  }

  /**
   * Subscribe to the daemon-resp channel. Idempotent.
   */
  public async start(): Promise<void> {
    if (this.started) {
      return
    }
    this.started = true
    await this.subscriber.subscribe(this.env.DAEMON_RESP_CHANNEL)
    this.subscriber.on("message", (_channel, payload) => {
      const parsed = daemonBridgeEnvelopeSchema.safeParse(safeParse(payload))
      if (!parsed.success) {
        this.logger.warn(
          { issues: parsed.error.issues },
          "Dropping malformed daemon-resp payload"
        )
        return
      }
      const { nodeId, envelope } = parsed.data
      const id = envelope.id
      if (id === null || id === "") {
        for (const cb of this.pushListeners) {
          cb(nodeId, envelope.message)
        }
        return
      }
      const pending = this.pending.get(id)
      if (pending === undefined) {
        return
      }
      const message = envelope.message
      if (message.type === "ack" || message.type === "error") {
        pending.resolve({ envelope })
        this.cleanup(id)
        return
      }
      if (pending.onStream !== undefined) {
        pending.onStream(message)
      }
    })
  }

  /**
   * Send a request to the given node and await a terminal `ack`/`error`
   * envelope. Optional `onStream` fires for any non-terminal frames the
   * daemon emits while the request is in flight (install_log, etc.).
   *
   * Times out and rejects if no response arrives within `timeoutMs`.
   */
  public async request(params: {
    nodeId: string
    message: DaemonMessage
    timeoutMs?: number
    onStream?: DaemonStreamCallback
  }): Promise<DaemonRequestResult> {
    if (!this.started) {
      throw new Error("DaemonClient.start() must be called before request()")
    }
    const id = randomUUID()
    const envelope: DaemonEnvelope = { id, message: params.message }
    const timeoutMs = params.timeoutMs ?? 60_000

    const promise = new Promise<DaemonRequestResult>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.cleanup(id)
        reject(new Error(`Daemon request timed out after ${timeoutMs}ms`))
      }, timeoutMs)
      this.pending.set(id, {
        resolve,
        reject,
        onStream: params.onStream,
        timer,
      })
    })

    await this.publisher.publish(
      this.env.DAEMON_CMD_CHANNEL,
      JSON.stringify({ nodeId: params.nodeId, envelope })
    )

    return promise
  }

  /**
   * Register a listener for unsolicited daemon push frames (id === null),
   * e.g. server.state.changed and server.stats. Returns a cleanup function.
   */
  public onPush(cb: DaemonPushCallback): () => void {
    this.pushListeners.add(cb)
    return () => this.pushListeners.delete(cb)
  }

  /**
   * Cancel pending requests on shutdown. Each pending request rejects so
   * caller jobs surface a clean failure instead of hanging.
   */
  public shutdown(): void {
    for (const [id, pending] of this.pending) {
      clearTimeout(pending.timer)
      pending.reject(new Error("DaemonClient is shutting down"))
      this.pending.delete(id)
    }
  }

  private cleanup(id: string): void {
    const pending = this.pending.get(id)
    if (pending === undefined) {
      return
    }
    clearTimeout(pending.timer)
    this.pending.delete(id)
  }
}
