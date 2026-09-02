import { Request, Response, NextFunction } from 'express';
import { UserService } from '../users/user.service';
import { EventService } from '../events/event.service';
import { CertificateService } from '../certificates/certificate.service';
import { successResponse } from '../../core/utils/response';
import { parseSchema } from '../../core/middleware/validation.middleware';
import { z } from 'zod';
import { bulkRevokeSchema, listCertificatesQuerySchema } from '../certificates/certificate.validation';
import { updateEventSchema } from '../events/event.validation';
import { UpdateEventDto } from '../events/event.validation';

function toStr(val: unknown): string | undefined {
  return typeof val === 'string' ? val : undefined;
}

const updateStatusSchema = z.object({
  status: z.enum(['active', 'inactive']),
});

const revokeSchema = z.object({
  reason: z.string().min(1, 'Reason is required').max(1000),
});

export class AdminController {
  constructor(
    private readonly userService: UserService,
    private readonly eventService: EventService,
    private readonly certService: CertificateService,
  ) {}

  // ═══════════════════════════════════════
  // USERS
  // ═══════════════════════════════════════

  /**
   * @openapi
   * /api/v1/admin/users:
   *   get:
   *     tags: [Admin]
   *     summary: List all users (admin only)
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: page
   *         schema: { type: integer }
   *       - in: query
   *         name: limit
   *         schema: { type: integer }
   *       - in: query
   *         name: search
   *         schema: { type: string }
   *       - in: query
   *         name: status
   *         schema: { type: string, enum: [active, inactive] }
   *       - in: query
   *         name: role
   *         schema: { type: string, enum: [admin, user] }
   *     responses:
   *       200:
   *         description: Paginated user list
   */
  listUsers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { page, limit, search, status, role } = req.query;
      const result = await this.userService.listUsers(
        page, limit,
        toStr(search),
        toStr(status),
        toStr(role),
      );
      successResponse({ res, message: 'Users retrieved successfully', data: result.data, meta: result.meta });
    } catch (err) {
      next(err);
    }
  };

  /**
   * @openapi
   * /api/v1/admin/users/{id}:
   *   get:
   *     tags: [Admin]
   *     summary: Get user by ID (admin only)
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema: { type: string, format: uuid }
   *     responses:
   *       200:
   *         description: User profile
   *       404:
   *         description: User not found
   */
  getUserById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = await this.userService.getUserById(req.params.id);
      successResponse({ res, message: 'User retrieved successfully', data: user });
    } catch (err) {
      next(err);
    }
  };

  /**
   * @openapi
   * /api/v1/admin/users/{id}/status:
   *   patch:
   *     tags: [Admin]
   *     summary: Activate or deactivate a user account
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema: { type: string, format: uuid }
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [status]
   *             properties:
   *               status: { type: string, enum: [active, inactive] }
   *     responses:
   *       200:
   *         description: User status updated
   */
  updateUserStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { status } = parseSchema(updateStatusSchema, req.body);
      const user = await this.userService.updateUserStatus(req.params.id, status);
      successResponse({ res, message: `User ${status === 'active' ? 'activated' : 'deactivated'} successfully`, data: user });
    } catch (err) {
      next(err);
    }
  };

  /**
   * @openapi
   * /api/v1/admin/users/{id}:
   *   delete:
   *     tags: [Admin]
   *     summary: Delete a user account permanently
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema: { type: string, format: uuid }
   *     responses:
   *       200:
   *         description: User deleted
   *       404:
   *         description: User not found
   */
  deleteUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.userService.deleteUser(req.params.id, req.user!.id);
      successResponse({ res, message: 'User deleted successfully' });
    } catch (err) {
      next(err);
    }
  };

  // ═══════════════════════════════════════
  // EVENTS
  // ═══════════════════════════════════════

  /**
   * @openapi
   * /api/v1/admin/events:
   *   get:
   *     tags: [Admin]
   *     summary: List all events across all users (admin only)
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: page
   *         schema: { type: integer }
   *       - in: query
   *         name: search
   *         schema: { type: string }
   *       - in: query
   *         name: status
   *         schema: { type: string, enum: [draft, ongoing, completed] }
   *     responses:
   *       200:
   *         description: Paginated event list
   */
  listEvents = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { page, limit, search, status } = req.query;
      const result = await this.eventService.listAllEvents(
        page, limit,
        toStr(search),
        toStr(status),
      );
      successResponse({ res, message: 'Events retrieved successfully', data: result.data, meta: result.meta });
    } catch (err) {
      next(err);
    }
  };

  getEventById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const event = await this.eventService.getEventById(req.params.id, req.user!.id, true);
      successResponse({ res, message: 'Event retrieved successfully', data: event });
    } catch (err) {
      next(err);
    }
  };

  updateEvent = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const dto = parseSchema(updateEventSchema, req.body) as UpdateEventDto;
      const event = await this.eventService.updateEvent(req.params.id, req.user!.id, dto, true);
      successResponse({ res, message: 'Event updated successfully', data: event });
    } catch (err) {
      next(err);
    }
  };

  deleteEvent = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.eventService.deleteEvent(req.params.id, req.user!.id, true);
      successResponse({ res, message: 'Event deleted successfully' });
    } catch (err) {
      next(err);
    }
  };

  // ═══════════════════════════════════════
  // CERTIFICATES
  // ═══════════════════════════════════════

  /**
   * @openapi
   * /api/v1/admin/certificates:
   *   get:
   *     tags: [Admin]
   *     summary: List all certificates across all users (admin only)
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: page
   *         schema: { type: integer }
   *       - in: query
   *         name: search
   *         schema: { type: string }
   *       - in: query
   *         name: status
   *         schema: { type: string, enum: [active, revoked] }
   *       - in: query
   *         name: event_id
   *         schema: { type: string, format: uuid }
   *     responses:
   *       200:
   *         description: Paginated certificate list
   */
  listCertificates = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const query = parseSchema(listCertificatesQuerySchema, req.query);
      const result = await this.certService.listAllCertificates(query);
      successResponse({ res, message: 'Certificates retrieved successfully', data: result.data, meta: result.meta });
    } catch (err) {
      next(err);
    }
  };

  getCertificateById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const cert = await this.certService.getCertificateById(req.params.id, req.user!.id, true);
      successResponse({ res, message: 'Certificate retrieved successfully', data: cert });
    } catch (err) {
      next(err);
    }
  };

  revokeCertificate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const dto = parseSchema(revokeSchema, req.body) as { reason: string };
      const cert = await this.certService.revokeCertificate(req.params.id, req.user!.id, dto, true);
      successResponse({ res, message: 'Certificate revoked successfully', data: cert });
    } catch (err) {
      next(err);
    }
  };

  /**
   * @openapi
   * /api/v1/admin/certificates/bulk-revoke:
   *   post:
   *     tags: [Admin]
   *     summary: Bulk revoke multiple certificates
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [certificateIds, reason]
   *             properties:
   *               certificateIds:
   *                 type: array
   *                 items: { type: string, format: uuid }
   *                 maxItems: 100
   *               reason: { type: string }
   *     responses:
   *       200:
   *         description: Bulk revoke result
   */
  bulkRevoke = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { certificateIds, reason } = parseSchema(bulkRevokeSchema, req.body);
      const result = await this.certService.bulkRevoke(certificateIds, reason);
      successResponse({ res, message: `${result.revoked} certificates revoked successfully`, data: result });
    } catch (err) {
      next(err);
    }
  };
}
