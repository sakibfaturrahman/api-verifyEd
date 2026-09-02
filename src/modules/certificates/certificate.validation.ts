import { z } from 'zod';

export const revokeCertificateSchema = z.object({
  reason: z.string().min(1, 'Revoke reason is required').max(1000),
});

export const qrConfigSchema = z.object({
  certificate_id: z.string().uuid('certificate_id must be a valid UUID'),
  x: z.number().min(0),
  y: z.number().min(0),
  width: z.number().min(10).max(500),
  height: z.number().min(10).max(500),
  page: z.number().int().min(1).default(1),
  rotation: z.number().min(0).max(360).default(0),
});

export const listCertificatesQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  search: z.string().max(255).optional(),
  status: z.enum(['active', 'revoked']).optional(),
  event_id: z.string().uuid().optional(),
});

export interface QrConfig {
  x: number;
  y: number;
  width: number;
  height: number;
  page: number;
  rotation?: number;
}

export const bulkRevokeSchema = z.object({
  certificateIds: z.array(z.string().uuid()).min(1, 'At least one certificate ID is required').max(100),
  reason: z.string().min(1, 'Revoke reason is required').max(1000),
});

export type RevokeCertificateDto = z.infer<typeof revokeCertificateSchema>;
export type QrConfigDto = z.infer<typeof qrConfigSchema>;
export type ListCertificatesQuery = z.infer<typeof listCertificatesQuerySchema>;
export type BulkRevokeDto = z.infer<typeof bulkRevokeSchema>;
