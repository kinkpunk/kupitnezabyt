export type RateLimitOptions = {
  maxAttempts: number;
  windowMs: number;
  now?: () => number;
};

export type RateLimiter = {
  consume: (key: string) => boolean;
  reset: (key: string) => void;
  clear: () => void;
};

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

export function createRateLimiter(options: RateLimitOptions): RateLimiter {
  const buckets = new Map<string, RateLimitBucket>();
  const now = options.now ?? Date.now;

  return {
    consume(key) {
      const currentTime = now();
      const bucket = buckets.get(key);
      if (!bucket || bucket.resetAt <= currentTime) {
        buckets.set(key, {
          count: 1,
          resetAt: currentTime + options.windowMs
        });
        return true;
      }

      if (bucket.count >= options.maxAttempts) {
        return false;
      }

      bucket.count += 1;
      return true;
    },
    reset(key) {
      buckets.delete(key);
    },
    clear() {
      buckets.clear();
    }
  };
}
