import { Response } from 'express';

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface SuccessResponseOptions<T> {
  res: Response;
  message: string;
  data?: T;
  statusCode?: number;
  meta?: PaginationMeta;
}

interface ErrorResponseOptions {
  res: Response;
  message: string;
  statusCode: number;
  code?: string;
}

/**
 * Sends a standardised success JSON response.
 */
export function successResponse<T>({
  res,
  message,
  data,
  statusCode = 200,
  meta,
}: SuccessResponseOptions<T>): void {
  const body: Record<string, unknown> = {
    success: true,
    message,
  };

  if (data !== undefined) body.data = data;
  if (meta !== undefined) body.meta = meta;

  res.status(statusCode).json(body);
}

/**
 * Sends a standardised error JSON response.
 */
export function errorResponse({ res, message, statusCode, code }: ErrorResponseOptions): void {
  res.status(statusCode).json({
    success: false,
    message,
    error: code ? { code } : undefined,
  });
}
