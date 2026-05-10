/**
 * In-process stand-in for the slice of `ioredis` that `StatusCache`
 * actually uses. Kicks in when `REDIS_URL=memory://` — handy for the
 * desktop app, where running a real Redis container next to Postgres
 * is wasted ceremony for one user, one process.
 *
 * If we ever need more Redis surface (queues, pub/sub) we'll have to
 * choose between extending this shim or reintroducing the container.
 * For now StatusCache is the only caller and it pulls four methods.
 */
export class MemoryRedis {
  private readonly store = new Map<string, { value: string; expiresAt: number | null }>()

  public async set(
    key: string,
    value: string,
    expiryFlag?: "EX",
    ttlSeconds?: number
  ): Promise<"OK"> {
    const expiresAt =
      expiryFlag === "EX" && ttlSeconds !== undefined
        ? Date.now() + ttlSeconds * 1_000
        : null
    this.store.set(key, { value, expiresAt })
    return "OK"
  }

  public async get(key: string): Promise<string | null> {
    const entry = this.store.get(key)
    if (entry === undefined) return null
    if (entry.expiresAt !== null && entry.expiresAt < Date.now()) {
      this.store.delete(key)
      return null
    }
    return entry.value
  }

  public async mget(...keys: string[]): Promise<(string | null)[]> {
    return Promise.all(keys.map((k) => this.get(k)))
  }

  public async del(...keys: string[]): Promise<number> {
    let removed = 0
    for (const k of keys) {
      if (this.store.delete(k)) removed++
    }
    return removed
  }

  // Lazy GC — sweep expired keys when the store grows past a threshold.
  // The desktop app rarely has more than a handful of servers, so this
  // never actually fires for the intended use case.
  public sweepExpired(): void {
    const now = Date.now()
    for (const [k, v] of this.store) {
      if (v.expiresAt !== null && v.expiresAt < now) this.store.delete(k)
    }
  }
}

const MEMORY_URL_PREFIX = "memory://"

export const isMemoryRedisUrl = (url: string): boolean =>
  url.startsWith(MEMORY_URL_PREFIX)
