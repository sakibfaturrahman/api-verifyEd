import rateLimit from 'express-rate-limit';
import { env } from '../../config/env';
import { errorResponse } from '../utils/response';

const rateLimitHandler = (
  _req: Parameters<ReturnType<typeof rateLimit>>[0],
  res: Parameters<ReturnType<typeof rateLimit>>[1],
) => {
  errorResponse({
    res,
    message: 'Too many requests. Please try again later.',
    statusCode: 429,
    code: 'RATE_LIMIT_EXCEEDED',
  });
};

/**
 * General API rate limiter — applied globally.
 */
export const apiRateLimit = rateLimit({
  windowMs: env.RATE_LIMIT_API_WINDOW_MS,
  max: env.RATE_LIMIT_API_MAX,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: rateLimitHandler,
});

/**
 * Strict rate limiter for authentication endpoints.
 * Prevents brute force attacks.
 */
export const authRateLimit = rateLimit({
  windowMs: env.RATE_LIMIT_AUTH_WINDOW_MS,
  max: env.RATE_LIMIT_AUTH_MAX,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: rateLimitHandler,
});

/**
 * Strict rate limiter for public verification endpoints.
 * Prevents verification abuse / certificate enumeration.
 */
export const verifyRateLimit = rateLimit({
  windowMs: env.RATE_LIMIT_VERIFY_WINDOW_MS,
  max: env.RATE_LIMIT_VERIFY_MAX,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: rateLimitHandler,
  keyGenerator: (req) => req.ip ?? 'unknown',
});
