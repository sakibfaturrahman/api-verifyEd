import { EventRepository, EventRow } from './event.repository';
import { CreateEventDto, UpdateEventDto } from './event.validation';
import { NotFoundError } from '../../core/errors/NotFoundError';
import { ForbiddenError } from '../../core/errors/ForbiddenError';
import { parsePagination, buildPaginationMeta } from '../../core/utils/pagination';

export class EventService {
  constructor(private readonly eventRepository: EventRepository) {}

  async createEvent(userId: string, dto: CreateEventDto): Promise<EventRow> {
    return this.eventRepository.create(userId, dto);
  }

  async listEvents(
    userId: string,
    rawPage: unknown,
    rawLimit: unknown,
    search?: string,
    status?: string,
  ) {
    const { page, limit, offset } = parsePagination(rawPage, rawLimit);
    const { data, total } = await this.eventRepository.findAll({
      userId,
      page,
      limit,
      offset,
      search,
      status,
    });
    return { data, meta: buildPaginationMeta(page, limit, total) };
  }

  async getEventById(id: string, userId: string, isAdmin = false): Promise<EventRow> {
    if (isAdmin) {
      const event = await this.eventRepository.findById(id);
      if (!event) throw new NotFoundError('Event');
      return event;
    }

    const event = await this.eventRepository.findByIdAndOwner(id, userId);
    if (!event) throw new NotFoundError('Event');
    return event;
  }

  async updateEvent(
    id: string,
    userId: string,
    dto: UpdateEventDto,
    isAdmin = false,
  ): Promise<EventRow> {
    await this.getEventById(id, userId, isAdmin);
    return this.eventRepository.update(id, dto);
  }

  async deleteEvent(id: string, userId: string, isAdmin = false): Promise<void> {
    await this.getEventById(id, userId, isAdmin);
    await this.eventRepository.delete(id);
  }

  // Admin only — list all events across all users
  async listAllEvents(rawPage: unknown, rawLimit: unknown, search?: string, status?: string) {
    const { page, limit, offset } = parsePagination(rawPage, rawLimit);
    const { data, total } = await this.eventRepository.findAll({
      page,
      limit,
      offset,
      search,
      status,
    });
    return { data, meta: buildPaginationMeta(page, limit, total) };
  }

  /**
   * Verifies that an event belongs to the given user.
   * Used by certificate operations to ensure ownership chain.
   */
  async assertEventOwnership(eventId: string, userId: string): Promise<EventRow> {
    const event = await this.eventRepository.findByIdAndOwner(eventId, userId);
    if (!event) {
      throw new ForbiddenError('You do not have access to this event');
    }
    return event;
  }
}
