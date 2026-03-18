export type RateLimitDecision = {
  allowed: boolean;
  remaining: number;
  resetAt: number;
};

export type RateLimiter = {
  consume: (key: string) => RateLimitDecision;
  reset: (key: string) => void;
};

type RateLimitConfig = {
  max: number;
  windowMs: number;
  now?: () => number;
};

type Bucket = {
  count: number;
  resetAt: number;
};

export function createRateLimiter(config: RateLimitConfig): RateLimiter {
  const buckets = new Map<string, Bucket>();
  const now = config.now ?? Date.now;
  const max = Math.max(1, Math.floor(config.max));
  const windowMs = Math.max(1, Math.floor(config.windowMs));

  function consume(key: string): RateLimitDecision {
    const currentTime = now();
    const currentBucket = buckets.get(key);

    if (!currentBucket || currentTime >= currentBucket.resetAt) {
      const freshBucket: Bucket = {
        count: 1,
        resetAt: currentTime + windowMs,
      };
      buckets.set(key, freshBucket);
      return {
        allowed: true,
        remaining: max - 1,
        resetAt: freshBucket.resetAt,
      };
    }

    const nextCount = currentBucket.count + 1;
    currentBucket.count = nextCount;

    if (nextCount > max) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: currentBucket.resetAt,
      };
    }

    return {
      allowed: true,
      remaining: max - nextCount,
      resetAt: currentBucket.resetAt,
    };
  }

  function reset(key: string) {
    buckets.delete(key);
  }

  return { consume, reset };
}
