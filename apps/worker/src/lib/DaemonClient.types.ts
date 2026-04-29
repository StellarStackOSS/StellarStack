import type {
  DaemonEnvelope,
  DaemonMessage,
} from "@workspace/daemon-proto/messages.types"

/**
 * Outcome of a daemon request. The worker either gets a single ack/error
 * envelope back or a stream of envelopes terminated by ack/error (used by
 * `server.run_install` for log streaming).
 */
export type DaemonRequestResult = {
  envelope: DaemonEnvelope
}

/**
 * Callback invoked for each frame the daemon emits while a streamed
 * request is in flight, before the terminal ack/error.
 */
export type DaemonStreamCallback = (message: DaemonMessage) => void
