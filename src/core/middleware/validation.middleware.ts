import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { ValidationError } from '../errors/ValidationError';

type ValidateTarget = 'body' | 'query' | 'params';

/**
 * Validation middleware factory using Zod schemas.
 * Usage:
 *   router.post('/', validate('body', createEventSchema), handler)
 *   router.get('/', validate('query', listQuerySchema), handler)
 */
export function validate(target: ValidateTarget, schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[target]);

    if (!result.success) {
      const errors = result.error.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      }));
      return next(new ValidationError(errors));
    }

    // Replace with parsed/coerced data
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (req as any)[target] = result.data;
    next();
  };
}

/**
 * Type-safe validator that also extracts validated data.
 * Returns a Zod parse error message for simple inline use.
 */
export function parseSchema<T>(schema: ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const errors = (result.error as ZodError).errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));
    throw new ValidationError(errors);
  }
  return result.data;
}
