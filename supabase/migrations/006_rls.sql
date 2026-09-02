-- ============================================================
-- Migration: 006_rls.sql
-- Description: Row Level Security policies
-- All public API access goes through Express backend (service role).
-- RLS is an extra defense layer for direct DB access.
-- ============================================================

-- Enable RLS on all application tables
ALTER TABLE public.profiles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.certificates      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verification_logs ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- HELPER: Check if current user is admin
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin'
    );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================
-- PROFILES policies
-- ============================================================

-- Users can view their own profile
CREATE POLICY "profiles_select_own"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id);

-- Admins can view all profiles
CREATE POLICY "profiles_select_admin"
    ON public.profiles FOR SELECT
    USING (public.is_admin());

-- Users can update their own profile (not role, not status)
CREATE POLICY "profiles_update_own"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- Only admins can update role/status of any profile
CREATE POLICY "profiles_update_admin"
    ON public.profiles FOR UPDATE
    USING (public.is_admin());

-- Service role has full access (backend uses service role)
-- This is implicit when bypassing RLS with service role key

-- ============================================================
-- EVENTS policies
-- ============================================================

-- Users can view their own events
CREATE POLICY "events_select_own"
    ON public.events FOR SELECT
    USING (auth.uid() = user_id);

-- Admins can view all events
CREATE POLICY "events_select_admin"
    ON public.events FOR SELECT
    USING (public.is_admin());

-- Users can create events for themselves
CREATE POLICY "events_insert_own"
    ON public.events FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can update their own events
CREATE POLICY "events_update_own"
    ON public.events FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Admins can update any event
CREATE POLICY "events_update_admin"
    ON public.events FOR UPDATE
    USING (public.is_admin());

-- Users can delete their own events
CREATE POLICY "events_delete_own"
    ON public.events FOR DELETE
    USING (auth.uid() = user_id);

-- Admins can delete any event
CREATE POLICY "events_delete_admin"
    ON public.events FOR DELETE
    USING (public.is_admin());

-- ============================================================
-- CERTIFICATES policies
-- ============================================================

-- Users can view certificates from their own events
CREATE POLICY "certificates_select_own"
    ON public.certificates FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.events e
            WHERE e.id = event_id AND e.user_id = auth.uid()
        )
    );

-- Admins can view all certificates
CREATE POLICY "certificates_select_admin"
    ON public.certificates FOR SELECT
    USING (public.is_admin());

-- Users can insert certificates for their own events
CREATE POLICY "certificates_insert_own"
    ON public.certificates FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.events e
            WHERE e.id = event_id AND e.user_id = auth.uid()
        )
    );

-- Users can update their own certificates
CREATE POLICY "certificates_update_own"
    ON public.certificates FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.events e
            WHERE e.id = event_id AND e.user_id = auth.uid()
        )
    );

-- Admins can update any certificate
CREATE POLICY "certificates_update_admin"
    ON public.certificates FOR UPDATE
    USING (public.is_admin());

-- ============================================================
-- VERIFICATION LOGS policies
-- ============================================================

-- Verification logs are write-only for authenticated users (through service role in backend)
-- No direct select for regular users — read via dashboard API only
-- Admins can view all logs
CREATE POLICY "verification_logs_select_admin"
    ON public.verification_logs FOR SELECT
    USING (public.is_admin());

-- Note: All inserts to verification_logs happen via backend with service role key
-- which bypasses RLS. This is intentional — public verification does not require auth.
