import { describe, expect, it } from "vitest";

import { createRateLimiter } from "./rate-limit.js";

describe("createRateLimiter", () => {
  it("allows requests up to the configured window limit", () => {
    let currentTime = 1_000;
    const limiter = createRateLimiter({
      maxAttempts: 2,
      windowMs: 1_000,
      now: () => currentTime
    });

    expect(limiter.consume("auth:user")).toBe(true);
    expect(limiter.consume("auth:user")).toBe(true);
    expect(limiter.consume("auth:user")).toBe(false);

    currentTime = 2_000;
    expect(limiter.consume("auth:user")).toBe(true);
  });

  it("tracks buckets independently and can reset a single key", () => {
    const limiter = createRateLimiter({
      maxAttempts: 1,
      windowMs: 1_000,
      now: () => 1_000
    });

    expect(limiter.consume("auth:a")).toBe(true);
    expect(limiter.consume("auth:a")).toBe(false);
    expect(limiter.consume("auth:b")).toBe(true);

    limiter.reset("auth:a");
    expect(limiter.consume("auth:a")).toBe(true);
  });

  it("can clear all buckets", () => {
    const limiter = createRateLimiter({
      maxAttempts: 1,
      windowMs: 1_000,
      now: () => 1_000
    });

    expect(limiter.consume("auth:a")).toBe(true);
    expect(limiter.consume("auth:b")).toBe(true);

    limiter.clear();
    expect(limiter.consume("auth:a")).toBe(true);
    expect(limiter.consume("auth:b")).toBe(true);
  });
});
