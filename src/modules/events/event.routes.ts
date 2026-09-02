import { Router } from 'express';
import { EventController } from './event.controller';
import { EventService } from './event.service';
import { EventRepository } from './event.repository';
import { validate } from '../../core/middleware/validation.middleware';
import { authenticate } from '../../core/middleware/auth.middleware';
import { createEventSchema, updateEventSchema } from './event.validation';

const router = Router();

export const eventRepository = new EventRepository();
export const eventService = new EventService(eventRepository);
const eventController = new EventController(eventService);

// All event routes require authentication
router.use(authenticate);

router.get('/', eventController.listEvents);
router.post('/', validate('body', createEventSchema), eventController.createEvent);
router.get('/:id', eventController.getEvent);
router.put('/:id', validate('body', updateEventSchema), eventController.updateEvent);
router.delete('/:id', eventController.deleteEvent);

export default router;
