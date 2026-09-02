-- ============================================================
-- Migration: 005_indexes.sql
-- Description: Performance indexes for frequent query patterns
-- ============================================================

-- === profiles ===
CREATE INDEX IF NOT EXISTS idx_profiles_email  ON public.profiles (email);
CREATE INDEX IF NOT EXISTS idx_profiles_role   ON public.profiles (role);
CREATE INDEX IF NOT EXISTS idx_profiles_status ON public.profiles (status);

-- === events ===
CREATE INDEX IF NOT EXISTS idx_events_user_id    ON public.events (user_id);
CREATE INDEX IF NOT EXISTS idx_events_event_date ON public.events (event_date);
CREATE INDEX IF NOT EXISTS idx_events_status     ON public.events (status);
-- Composite for user dashboard queries (user's events filtered by status)
CREATE INDEX IF NOT EXISTS idx_events_user_status ON public.events (user_id, status);

-- === certificates ===
CREATE INDEX IF NOT EXISTS idx_certificates_event_id           ON public.certificates (event_id);
CREATE INDEX IF NOT EXISTS idx_certificates_certificate_number ON public.certificates (certificate_number);
CREATE INDEX IF NOT EXISTS idx_certificates_qr_token           ON public.certificates (qr_token);
CREATE INDEX IF NOT EXISTS idx_certificates_status             ON public.certificates (status);
CREATE INDEX IF NOT EXISTS idx_certificates_issued_at          ON public.certificates (issued_at);
CREATE INDEX IF NOT EXISTS idx_certificates_file_hash          ON public.certificates (file_hash);
-- Composite for dashboard stats (event's active certs)
CREATE INDEX IF NOT EXISTS idx_certificates_event_status ON public.certificates (event_id, status);

-- === verification_logs ===
CREATE INDEX IF NOT EXISTS idx_verification_logs_certificate_id ON public.verification_logs (certificate_id);
CREATE INDEX IF NOT EXISTS idx_verification_logs_method         ON public.verification_logs (method);
CREATE INDEX IF NOT EXISTS idx_verification_logs_created_at     ON public.verification_logs (created_at);
-- Composite for stats over time per certificate
CREATE INDEX IF NOT EXISTS idx_verification_logs_cert_date ON public.verification_logs (certificate_id, created_at);
