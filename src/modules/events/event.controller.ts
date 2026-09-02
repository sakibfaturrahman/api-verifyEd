import { Request, Response, NextFunction } from 'express';
import { EventService } from './event.service';
import { UpdateEventDto } from './event.validation';
import { successResponse } from '../../core/utils/response';

export class EventController {
  constructor(private readonly eventService: EventService) {}

  /**
   * @openapi
   * /api/v1/events:
   *   get:
   *     tags: [Events]
   *     summary: List authenticated user's events
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: page
   *         schema: { type: integer, default: 1 }
   *       - in: query
   *         name: limit
   *         schema: { type: integer, default: 10, maximum: 100 }
   *       - in: query
   *         name: search
   *         schema: { type: string }
   *         description: Search by event name or organizer
   *       - in: query
   *         name: status
   *         schema: { type: string, enum: [draft, ongoing, completed] }
   *     responses:
   *       200:
   *         description: Paginated list of events
   */
  listEvents = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { page, limit, search, status } = req.query;
      const result = await this.eventService.listEvents(
        req.user!.id,
        page,
        limit,
        typeof search === 'string' ? search : undefined,
        typeof status === 'string' ? status : undefined,
      );
      successResponse({ res, message: 'Events retrieved successfully', data: result.data, meta: result.meta });
    } catch (err) {
      next(err);
    }
  };

  /**
   * @openapi
   * /api/v1/events:
   *   post:
   *     tags: [Events]
   *     summary: Create a new event
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [name, organizer, event_date]
   *             properties:
   *               name: { type: string }
   *               organizer: { type: string }
   *               description: { type: string }
   *               event_date: { type: string, format: date, example: "2024-12-01" }
   *               location: { type: string }
   *               status: { type: string, enum: [draft, ongoing, completed] }
   *     responses:
   *       201:
   *         description: Event created
   */
  createEvent = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const event = await this.eventService.createEvent(req.user!.id, req.body);
      successResponse({ res, message: 'Event created successfully', data: event, statusCode: 201 });
    } catch (err) {
      next(err);
    }
  };

  /**
   * @openapi
   * /api/v1/events/{id}:
   *   get:
   *     tags: [Events]
   *     summary: Get a specific event by ID
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema: { type: string, format: uuid }
   *     responses:
   *       200:
   *         description: Event details
   *       404:
   *         description: Event not found
   */
  getEvent = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const event = await this.eventService.getEventById(req.params.id, req.user!.id);
      successResponse({ res, message: 'Event retrieved successfully', data: event });
    } catch (err) {
      next(err);
    }
  };

  /**
   * @openapi
   * /api/v1/events/{id}:
   *   put:
   *     tags: [Events]
   *     summary: Update an event
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema: { type: string, format: uuid }
   *     requestBody:
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/Event'
   *     responses:
   *       200:
   *         description: Event updated
   *       403:
   *         description: Not your event
   *       404:
   *         description: Event not found
   */
  updateEvent = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const event = await this.eventService.updateEvent(
        req.params.id,
        req.user!.id,
        req.body as UpdateEventDto,
      );
      successResponse({ res, message: 'Event updated successfully', data: event });
    } catch (err) {
      next(err);
    }
  };

  /**
   * @openapi
   * /api/v1/events/{id}:
   *   delete:
   *     tags: [Events]
   *     summary: Delete an event
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema: { type: string, format: uuid }
   *     responses:
   *       200:
   *         description: Event deleted
   *       404:
   *         description: Event not found
   */
  deleteEvent = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.eventService.deleteEvent(req.params.id, req.user!.id);
      successResponse({ res, message: 'Event deleted successfully' });
    } catch (err) {
      next(err);
    }
  };
}
