import { Request, Response, NextFunction } from "express";
import { AdminService } from "./admin.service";
import { successResponse } from "../../../core/utils/response";

export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  getAll = async (
    _req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const admins = await this.adminService.getAllAdmins();
      successResponse({
        res,
        message: "Admins retrieved successfully",
        data: admins,
      });
    } catch (err) {
      next(err);
    }
  };

  create = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const result = await this.adminService.createAdmin(req.body);
      successResponse({
        res,
        message: result.message,
        statusCode: 201,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  };

  update = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { id } = req.params;
      const updated = await this.adminService.updateAdmin(id, req.body);
      successResponse({
        res,
        message: "Admin updated successfully",
        data: updated,
      });
    } catch (err) {
      next(err);
    }
  };

  delete = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { id } = req.params;
      await this.adminService.deleteAdmin(id);
      successResponse({ res, message: "Admin deleted successfully" });
    } catch (err) {
      next(err);
    }
  };
}
