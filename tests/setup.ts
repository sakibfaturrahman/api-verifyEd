/**
 * Global test setup.
 * Loads environment variables from .env.test if present, falls back to test defaults.
 */
import 'dotenv/config';

// Set test environment variables if not already set
process.env.NODE_ENV = 'test';
process.env.PORT = '5001';
process.env.LOG_LEVEL = 'warn'; // Suppress most logs during tests

// These must be set in .env.test for integration tests
// Unit tests mock Supabase so they don't need real values
if (!process.env.SUPABASE_URL) {
  process.env.SUPABASE_URL = 'https://test.supabase.co';
}
if (!process.env.SUPABASE_ANON_KEY) {
  process.env.SUPABASE_ANON_KEY = 'test-anon-key';
}
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
}
process.env.CORS_ORIGIN = 'http://localhost:3000';
process.env.SUPABASE_STORAGE_BUCKET_ORIGINAL = 'certificates-original';
process.env.SUPABASE_STORAGE_BUCKET_GENERATED = 'certificates-generated';
