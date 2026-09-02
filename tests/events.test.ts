import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventService } from '../src/modules/events/event.service';

const mockEventRepository = {
  create: vi.fn(),
  findAll: vi.fn(),
  findById: vi.fn(),
  findByIdAndOwner: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  getCertificateCount: vi.fn(),
};

const mockEvent = {
  id: 'event-uuid-1',
  user_id: 'user-uuid-1',
  name: 'Test Event',
  organizer: 'Test Org',
  description: null,
  event_date: '2024-01-01',
  location: null,
  status: 'draft' as const,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const eventService = new EventService(mockEventRepository as any);

describe('EventService', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('createEvent', () => {
    it('creates an event for the authenticated user', async () => {
      mockEventRepository.create.mockResolvedValue(mockEvent);
      const result = await eventService.createEvent('user-uuid-1', {
        name: 'Test Event',
        organizer: 'Test Org',
        event_date: '2024-01-01',
        status: 'draft',
      });
      expect(result.name).toBe('Test Event');
      expect(mockEventRepository.create).toHaveBeenCalledWith('user-uuid-1', expect.any(Object));
    });
  });

  describe('getEventById', () => {
    it('returns event for the owner', async () => {
      mockEventRepository.findByIdAndOwner.mockResolvedValue(mockEvent);
      const result = await eventService.getEventById('event-uuid-1', 'user-uuid-1');
      expect(result.id).toBe('event-uuid-1');
    });

    it('throws NotFoundError for non-existent event', async () => {
      mockEventRepository.findByIdAndOwner.mockResolvedValue(null);
      await expect(eventService.getEventById('bad-id', 'user-uuid-1')).rejects.toMatchObject({
        statusCode: 404,
      });
    });

    it('uses findById for admin (bypasses ownership)', async () => {
      mockEventRepository.findById.mockResolvedValue(mockEvent);
      const result = await eventService.getEventById('event-uuid-1', 'admin-uuid', true);
      expect(mockEventRepository.findById).toHaveBeenCalled();
      expect(mockEventRepository.findByIdAndOwner).not.toHaveBeenCalled();
      expect(result.id).toBe('event-uuid-1');
    });
  });

  describe('updateEvent', () => {
    it('updates owned event', async () => {
      mockEventRepository.findByIdAndOwner.mockResolvedValue(mockEvent);
      mockEventRepository.update.mockResolvedValue({ ...mockEvent, name: 'Updated' });
      const result = await eventService.updateEvent('event-uuid-1', 'user-uuid-1', { name: 'Updated' });
      expect(result.name).toBe('Updated');
    });

    it('throws NotFoundError when user tries to update another user\'s event', async () => {
      mockEventRepository.findByIdAndOwner.mockResolvedValue(null);
      await expect(
        eventService.updateEvent('event-uuid-1', 'other-user', { name: 'Hack' })
      ).rejects.toMatchObject({ statusCode: 404 });
    });
  });

  describe('deleteEvent', () => {
    it('deletes owned event', async () => {
      mockEventRepository.findByIdAndOwner.mockResolvedValue(mockEvent);
      mockEventRepository.delete.mockResolvedValue(undefined);
      await expect(eventService.deleteEvent('event-uuid-1', 'user-uuid-1')).resolves.not.toThrow();
    });
  });

  describe('assertEventOwnership', () => {
    it('throws ForbiddenError when event belongs to different user', async () => {
      mockEventRepository.findByIdAndOwner.mockResolvedValue(null);
      await expect(eventService.assertEventOwnership('event-uuid-1', 'wrong-user')).rejects.toMatchObject({
        statusCode: 403,
      });
    });
  });
});
