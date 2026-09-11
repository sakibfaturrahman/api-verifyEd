import { z } from "zod";

export const createAdminSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email format"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      "Password must contain uppercase, lowercase, and a number",
    ),
});

export const updateAdminSchema = z.object({
  name: z.string().min(2).optional(),
  phone: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  status: z.enum(["active", "inactive"]).optional(),
});

export type CreateAdminDto = z.infer<typeof createAdminSchema>;
export type UpdateAdminDto = z.infer<typeof updateAdminSchema>;
