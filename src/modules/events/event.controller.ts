import { Request, Response, NextFunction } from "express";
import { EventService } from "./event.service";
import {
  createEventSchema,
  updateEventSchema,
  CreateEventDto,
  UpdateEventDto,
} from "./event.validation";
import { parseSchema } from "../../core/middleware/validation.middleware";
import { successResponse } from "../../core/utils/response";

export class EventController {
  constructor(private readonly eventService: EventService) {}

  listEvents = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { page, limit, search, status } = req.query;
      const result = await this.eventService.listEvents(
        req.user!.id,
        page,
        limit,
        typeof search === "string" ? search : undefined,
        typeof status === "string" ? status : undefined,
      );
      successResponse({
        res,
        message: "Events retrieved successfully",
        data: result.data,
        meta: result.meta,
      });
    } catch (err) {
      next(err);
    }
  };

  createEvent = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      // Validasi body request sebelum masuk ke database
      const dto = parseSchema(createEventSchema, req.body) as CreateEventDto;
      const event = await this.eventService.createEvent(req.user!.id, dto);
      successResponse({
        res,
        message: "Event created successfully",
        data: event,
        statusCode: 201,
      });
    } catch (err) {
      next(err);
    }
  };

  getEvent = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const event = await this.eventService.getEventById(
        req.params.id,
        req.user!.id,
      );
      successResponse({
        res,
        message: "Event retrieved successfully",
        data: event,
      });
    } catch (err) {
      next(err);
    }
  };

  updateEvent = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const dto = parseSchema(updateEventSchema, req.body) as UpdateEventDto;
      const event = await this.eventService.updateEvent(
        req.params.id,
        req.user!.id,
        dto,
      );
      successResponse({
        res,
        message: "Event updated successfully",
        data: event,
      });
    } catch (err) {
      next(err);
    }
  };

  deleteEvent = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      await this.eventService.deleteEvent(req.params.id, req.user!.id);
      successResponse({ res, message: "Event deleted successfully" });
    } catch (err) {
      next(err);
    }
  };
}
