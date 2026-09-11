// src/core/middlewares/authorize.ts
import { Request, Response, NextFunction } from "express";
import { AppError } from "../../../core/errors/AppError";

export const requireAdmin = (
  req: Request,
  _res: Response,
  next: NextFunction,
): void => {
  if (req.user?.role !== "admin") {
    return next(
      new AppError("Forbidden: Admin access required", 403, "FORBIDDEN"),
    );
  }
  next();
};
