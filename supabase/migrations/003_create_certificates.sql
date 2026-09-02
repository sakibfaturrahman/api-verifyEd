-- ============================================================
-- Migration: 003_create_certificates.sql
-- Description: Certificates table with integrity and QR support
-- ============================================================

CREATE TYPE certificate_status AS ENUM ('active', 'revoked');

CREATE TABLE IF NOT EXISTS public.certificates (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id           UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    certificate_number VARCHAR(50) NOT NULL UNIQUE,
    recipient_name     VARCHAR(255) NOT NULL,
    original_file      TEXT,                   -- Supabase Storage path for original upload
    generated_file     TEXT,                   -- Supabase Storage path for QR-embedded PDF
    file_hash          VARCHAR(64),            -- SHA-256 hex of the original PDF (64 chars)
    qr_token           VARCHAR(64) NOT NULL UNIQUE, -- crypto.randomBytes(32).hex
    qr_config          JSONB,                  -- {x, y, width, height, page, rotation?}
    status             certificate_status NOT NULL DEFAULT 'active',
    issued_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at         TIMESTAMPTZ,
    revoke_reason      TEXT,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Ensure revoke fields are set together
    CONSTRAINT revoke_consistency CHECK (
        (status = 'revoked' AND revoked_at IS NOT NULL)
        OR status = 'active'
    )
);

CREATE TRIGGER set_certificates_updated_at
    BEFORE UPDATE ON public.certificates
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

COMMENT ON TABLE public.certificates IS 'Issued certificates with integrity hash and QR token.';
COMMENT ON COLUMN public.certificates.file_hash IS 'SHA-256 hash of the original uploaded PDF. Used for tamper detection during PDF verification.';
COMMENT ON COLUMN public.certificates.qr_token IS '64-char hex from crypto.randomBytes(32). Never expose the raw DB ID.';
COMMENT ON COLUMN public.certificates.qr_config IS 'JSON config for QR placement: {x, y, width, height, page, rotation?}';
COMMENT ON COLUMN public.certificates.certificate_number IS 'Human-readable cert ID: CERT-{YYYYMMDD}-{8HEX}. Unique but not sequential.';
