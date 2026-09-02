import { Request, Response, NextFunction } from 'express';
import { ForbiddenError } from '../errors/ForbiddenError';
import { UnauthorizedError } from '../errors/UnauthorizedError';

type Role = 'admin' | 'user';

/**
 * Authorization middleware factory.
 * Usage:
 *   router.get('/admin', authenticate, authorize('admin'), handler)
 *   router.get('/shared', authenticate, authorize('admin', 'user'), handler)
 *
 * Must be used AFTER the `authenticate` middleware.
 */
export function authorize(...allowedRoles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required'));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        new ForbiddenError(
          `This endpoint requires one of the following roles: ${allowedRoles.join(', ')}`,
        ),
      );
    }

    next();
  };
}
