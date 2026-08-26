/**
 * Sliding-window rate limiter — pure in-memory, zero dependencies.
 *
 * Suitable for single-instance deployments (Vercel serverless, single
 * Node process). For multi-instance, swap the Map store for Redis
 * (Upstash, etc.) by implementing the RateLimitStore interface.
 *
 * Each key gets a fixed window of `windowMs` milliseconds with a max
 * of `max` requests. Older entries are pruned on each check.
 */

export interface RateLimitStore {
  get(key: string): number[];
  set(key: string, timestamps: number[]): void;
}

/** In-memory store — per-process, resets on cold start. */
class MemoryStore implements RateLimitStore {
  private store = new Map<string, number[]>();

  get(key: string): number[] {
    return this.store.get(key) ?? [];
  }

  set(key: string, timestamps: number[]): void {
    this.store.set(key, timestamps);
  }
}

export interface RateLimitConfig {
  /** Maximum requests per window. */
  max: number;
  /** Window duration in milliseconds. */
  windowMs: number;
  /** Optional custom store (defaults to in-memory). */
  store?: RateLimitStore;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetMs: number;
}

const defaultStore = new MemoryStore();

/**
 * Check if a request is allowed under the rate limit for a given key.
 * Returns { allowed, remaining, resetMs }.
 */
export function checkRateLimit(
  key: string,
  config: RateLimitConfig
): RateLimitResult {
  const store = config.store ?? defaultStore;
  const now = Date.now();
  const windowStart = now - config.windowMs;

  // Get existing timestamps and prune expired ones.
  const timestamps = store.get(key).filter((t) => t > windowStart);

  if (timestamps.length >= config.max) {
    const oldest = timestamps[0];
    const resetMs = oldest + config.windowMs - now;
    return { allowed: false, remaining: 0, resetMs };
  }

  timestamps.push(now);
  store.set(key, timestamps);

  return {
    allowed: true,
    remaining: config.max - timestamps.length,
    resetMs: config.windowMs,
  };
}

/**
 * Get a rate limit key from a request. Uses IP + optional path prefix.
 * Falls back to "anonymous" if no IP is available.
 */
export function rateLimitKey(
  ip: string | null | undefined,
  namespace: string
): string {
  return `${namespace}:${ip ?? "anonymous"}`;
}

/** Pre-configured limiters for common routes. */
export const LOGIN_LIMIT: RateLimitConfig = {
  max: 5,
  windowMs: 60_000, // 5 attempts per minute
};

export const CHECKOUT_LIMIT: RateLimitConfig = {
  max: 3,
  windowMs: 60_000, // 3 checkouts per minute
};

export const WEBHOOK_LIMIT: RateLimitConfig = {
  max: 30,
  windowMs: 60_000, // 30 webhooks per minute per IP
};

export const API_READ_LIMIT: RateLimitConfig = {
  max: 60,
  windowMs: 60_000, // 60 reads per minute
};
