-- ============================================================
-- Migration: 004_create_verification_logs.sql
-- Description: Audit log for every verification attempt
-- ============================================================

CREATE TYPE verification_method AS ENUM ('qr', 'pdf', 'certificate_id');
CREATE TYPE verification_result AS ENUM ('verified', 'revoked', 'not_found');

CREATE TABLE IF NOT EXISTS public.verification_logs (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- NULL when result = 'not_found' (no matching certificate exists)
    certificate_id UUID REFERENCES public.certificates(id) ON DELETE SET NULL,
    method         verification_method NOT NULL,
    result         verification_result NOT NULL,
    ip_address     VARCHAR(45),   -- IPv4 or IPv6
    user_agent     TEXT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.verification_logs IS 'Immutable audit log. Every verification attempt is logged regardless of result.';
COMMENT ON COLUMN public.verification_logs.certificate_id IS 'NULL when result is not_found — cannot FK to non-existent certificate.';
COMMENT ON COLUMN public.verification_logs.ip_address IS 'Client IP for abuse detection. Max 45 chars supports IPv6.';
