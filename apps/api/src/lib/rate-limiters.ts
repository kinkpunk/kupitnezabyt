import { createRateLimiter } from "../rate-limit.js";

export const authRateLimiter = createRateLimiter({
  maxAttempts: 10,
  windowMs: 15 * 60 * 1000
});

export const sensitiveRateLimiter = createRateLimiter({
  maxAttempts: 10,
  windowMs: 15 * 60 * 1000
});

export const invitationRateLimiter = createRateLimiter({
  maxAttempts: 20,
  windowMs: 60 * 60 * 1000
});
