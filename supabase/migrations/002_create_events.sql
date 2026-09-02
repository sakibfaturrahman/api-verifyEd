-- ============================================================
-- Migration: 002_create_events.sql
-- Description: Events table for grouping certificates
-- ============================================================

CREATE TYPE event_status AS ENUM ('draft', 'ongoing', 'completed');

CREATE TABLE IF NOT EXISTS public.events (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    name        VARCHAR(255) NOT NULL,
    organizer   VARCHAR(255) NOT NULL,
    description TEXT,
    event_date  DATE NOT NULL,
    location    VARCHAR(255),
    status      event_status NOT NULL DEFAULT 'draft',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER set_events_updated_at
    BEFORE UPDATE ON public.events
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

COMMENT ON TABLE public.events IS 'Events group certificates together. One event can have many certificates.';
COMMENT ON COLUMN public.events.status IS 'draft: not published | ongoing: active | completed: finished';
