import { z } from 'zod';

export const createEventSchema = z.object({
  name: z.string().min(2, 'Event name is required').max(255),
  organizer: z.string().min(2, 'Organizer is required').max(255),
  description: z.string().max(5000).optional(),
  event_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD format'),
  location: z.string().max(255).optional(),
  status: z.enum(['draft', 'ongoing', 'completed']).default('draft'),
});

export const updateEventSchema = createEventSchema.partial();

export const listEventsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  search: z.string().max(255).optional(),
  status: z.enum(['draft', 'ongoing', 'completed']).optional(),
});

export type CreateEventDto = z.infer<typeof createEventSchema>;
export type UpdateEventDto = z.infer<typeof updateEventSchema>;
export type ListEventsQuery = z.infer<typeof listEventsQuerySchema>;
