import { PaginationMeta } from './response';

export interface PaginationParams {
  page: number;
  limit: number;
  offset: number;
}

/**
 * Parses raw query params into safe pagination values.
 * @param rawPage  - page query string value
 * @param rawLimit - limit query string value
 * @param maxLimit - upper cap for limit (default 100)
 */
export function parsePagination(
  rawPage: unknown,
  rawLimit: unknown,
  maxLimit = 100,
): PaginationParams {
  const page = Math.max(1, Number.isFinite(Number(rawPage)) ? Number(rawPage) : 1);
  const limit = Math.min(
    maxLimit,
    Math.max(1, Number.isFinite(Number(rawLimit)) ? Number(rawLimit) : 10),
  );
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

/**
 * Builds pagination metadata for list responses.
 */
export function buildPaginationMeta(page: number, limit: number, total: number): PaginationMeta {
  return {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  };
}
