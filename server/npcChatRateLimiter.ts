// Simple in-memory rate limiting for the local single-instance NPC chat proxy
// (Feature 14 §23): a per-session sliding window plus a one-concurrent-request
// guard. No Redis, no external store.

export interface RateLimiter {
  check: (key: string, now: number) => boolean
}

export function createRateLimiter(opts: { windowMs: number; max: number }): RateLimiter {
  const hits = new Map<string, number[]>()
  return {
    check(key, now) {
      const recent = (hits.get(key) ?? []).filter((t) => t > now - opts.windowMs)
      if (recent.length >= opts.max) {
        hits.set(key, recent)
        return false
      }
      recent.push(now)
      hits.set(key, recent)
      return true
    },
  }
}

export interface ConcurrencyGuard {
  tryAcquire: (key: string) => boolean
  release: (key: string) => void
}

export function createConcurrencyGuard(): ConcurrencyGuard {
  const active = new Set<string>()
  return {
    tryAcquire(key) {
      if (active.has(key)) return false
      active.add(key)
      return true
    },
    release(key) {
      active.delete(key)
    },
  }
}

export const NPC_CHAT_RATE = { windowMs: 60_000, max: 10 } as const
