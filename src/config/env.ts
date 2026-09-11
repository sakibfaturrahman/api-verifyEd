import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(5000),

  // Supabase
  SUPABASE_URL: z.string().url("SUPABASE_URL must be a valid URL"),
  SUPABASE_ANON_KEY: z.string().min(1, "SUPABASE_ANON_KEY is required"),
  SUPABASE_SERVICE_ROLE_KEY: z
    .string()
    .min(1, "SUPABASE_SERVICE_ROLE_KEY is required"),

  // Storage
  SUPABASE_STORAGE_BUCKET_ORIGINAL: z.string().default("certificates-original"),
  SUPABASE_STORAGE_BUCKET_GENERATED: z
    .string()
    .default("certificates-generated"),

  // CORS
  CORS_ORIGIN: z.string().default("http://localhost:3000"),

  // ONLY ADMIN
  SUPER_ADMIN_ID: z.string().default(""),

  // File Upload
  MAX_FILE_SIZE: z.coerce
    .number()
    .int()
    .positive()
    .default(10 * 1024 * 1024), // 10MB
  MAX_BULK_FILES: z.coerce.number().int().positive().default(50),

  // Rate Limiting
  RATE_LIMIT_VERIFY_MAX: z.coerce.number().int().positive().default(30),
  RATE_LIMIT_VERIFY_WINDOW_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(60_000),
  RATE_LIMIT_API_MAX: z.coerce.number().int().positive().default(100),
  RATE_LIMIT_API_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  RATE_LIMIT_AUTH_MAX: z.coerce.number().int().positive().default(10),
  RATE_LIMIT_AUTH_WINDOW_MS: z.coerce.number().int().positive().default(60_000),

  // Signed URLs
  SIGNED_URL_EXPIRY: z.coerce.number().int().positive().default(3600),

  // Logging
  LOG_LEVEL: z
    .enum(["trace", "debug", "info", "warn", "error", "fatal", "silent"])
    .default("info"),
});

const _parsed = envSchema.safeParse(process.env);

if (!_parsed.success) {
  console.error("❌ Invalid environment variables:");
  console.error(_parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = _parsed.data;

export const isDev = env.NODE_ENV === "development";
export const isProd = env.NODE_ENV === "production";
export const isTest = env.NODE_ENV === "test";
