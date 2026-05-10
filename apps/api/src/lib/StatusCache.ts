import type { ServerLifecycleState } from "@workspace/shared/events.types"

const TTL_SECONDS = 3600

/**
 * Minimal slice of the ioredis API that `StatusCache` needs. Both the
 * real ioredis client and our `MemoryRedis` shim satisfy this — the
 * cache doesn't care which is wired up.
 */
export interface RedisLike {
  set(
    key: string,
    value: string,
    expiryFlag?: "EX",
    ttlSeconds?: number
  ): Promise<unknown>
  get(key: string): Promise<string | null>
  mget(...keys: string[]): Promise<(string | null)[]>
}

/**
 * Cheap status cache for the dashboard list view. The daemon's HTTP
 * status callback is the single writer; the API's GET /servers handler
 * reads here first and falls back to Postgres on miss.
 */
export class StatusCache {
  public constructor(private readonly redis: RedisLike) {}

  public async set(serverId: string, state: ServerLifecycleState): Promise<void> {
    await this.redis.set(`servers:${serverId}:status`, state, "EX", TTL_SECONDS)
  }

  public async get(serverId: string): Promise<ServerLifecycleState | null> {
    const v = await this.redis.get(`servers:${serverId}:status`)
    return (v as ServerLifecycleState | null) ?? null
  }

  public async getMany(
    serverIds: readonly string[]
  ): Promise<Map<string, ServerLifecycleState>> {
    const out = new Map<string, ServerLifecycleState>()
    if (serverIds.length === 0) return out
    const keys = serverIds.map((id) => `servers:${id}:status`)
    const values = await this.redis.mget(...keys)
    serverIds.forEach((id, i) => {
      const v = values[i]
      if (v !== null && v !== undefined) {
        out.set(id, v as ServerLifecycleState)
      }
    })
    return out
  }
}
