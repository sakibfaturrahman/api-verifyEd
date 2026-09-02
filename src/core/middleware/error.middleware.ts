import { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors/AppError';
import { ValidationError } from '../errors/ValidationError';
import { logger } from '../../app';
import { isDev } from '../../config/env';

/**
 * Centralized error handling middleware.
 * Must be registered LAST in the Express middleware chain.
 *
 * Handles:
 * - Operational AppErrors (safe to expose to clients)
 * - Validation errors (returns field-level details)
 * - Unexpected/programming errors (returns generic 500, logs full detail)
 */
export function errorMiddleware(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  // Handle validation errors
  if (err instanceof ValidationError) {
    res.status(422).json({
      success: false,
      message: err.message,
      errors: err.errors,
    });
    return;
  }

  // Handle known operational errors
  if (err instanceof AppError) {
    // Log 5xx operational errors as errors, 4xx as warnings
    if (err.statusCode >= 500) {
      logger.error({ err, code: err.code }, err.message);
    } else {
      logger.warn({ code: err.code, status: err.statusCode }, err.message);
    }

    res.status(err.statusCode).json({
      success: false,
      message: err.message,
      error: { code: err.code },
    });
    return;
  }

  // Unexpected / programming error — do NOT expose details in production
  logger.error({ err }, 'Unexpected error');

  res.status(500).json({
    success: false,
    message: 'An unexpected error occurred. Please try again later.',
    error: { code: 'INTERNAL_SERVER_ERROR' },
    ...(isDev && { stack: err.stack }),
  });
}
