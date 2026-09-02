import { z } from 'zod';

export const updateProfileSchema = z.object({
  name: z.string().min(2).max(255).optional(),
  phone: z.string().max(50).optional().nullable(),
  address: z.string().max(1000).optional().nullable(),
  description: z.string().max(2000).optional().nullable(),
  avatar_url: z.string().url('Must be a valid URL').max(1000).optional().nullable(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(72)
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
}).refine(
  (data) => data.currentPassword !== data.newPassword,
  { message: 'New password must be different from current password', path: ['newPassword'] },
);

export type UpdateProfileDto = z.infer<typeof updateProfileSchema>;
export type ChangePasswordDto = z.infer<typeof changePasswordSchema>;
