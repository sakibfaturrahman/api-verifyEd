-- ============================================================
-- Migration: 007_seed.sql
-- Description: Development seed data
-- WARNING: Never run in production
-- ============================================================

-- =============================================================
-- NOTE: Seed users must be created via Supabase Auth first.
-- Steps:
--   1. Create users via Supabase Auth (dashboard or API)
--   2. Note the UUIDs returned
--   3. Replace the placeholder UUIDs below with real auth user IDs
--   4. Run this script
--
-- The handle_new_user() trigger will auto-create profile rows,
-- so update those rows instead of inserting.
-- =============================================================

-- Placeholder UUIDs — replace with real auth.users IDs
DO $$
DECLARE
    admin_id  UUID := '00000000-0000-0000-0000-000000000001';  -- replace
    user1_id  UUID := '00000000-0000-0000-0000-000000000002';  -- replace
    user2_id  UUID := '00000000-0000-0000-0000-000000000003';  -- replace
    event1_id UUID;
    event2_id UUID;
    cert1_id  UUID;
    cert2_id  UUID;
BEGIN

    -- Update profile roles (trigger creates them as 'user' by default)
    UPDATE public.profiles SET role = 'admin', name = 'Admin User'
    WHERE id = admin_id;

    UPDATE public.profiles SET name = 'Alice Johnson'
    WHERE id = user1_id;

    UPDATE public.profiles SET name = 'Bob Smith'
    WHERE id = user2_id;

    -- Events
    INSERT INTO public.events (id, user_id, name, organizer, description, event_date, location, status)
    VALUES
        (gen_random_uuid(), user1_id, 'Web Development Bootcamp 2024', 'Tech Academy', 'A 12-week intensive web development program.', '2024-06-15', 'Jakarta, Indonesia', 'completed'),
        (gen_random_uuid(), user1_id, 'Data Science Workshop', 'AI Institute', 'Hands-on data science workshop.', '2024-09-01', 'Bandung, Indonesia', 'ongoing')
    RETURNING id INTO event1_id;

    -- Fetch the inserted event IDs
    SELECT id INTO event1_id FROM public.events WHERE user_id = user1_id AND name = 'Web Development Bootcamp 2024';
    SELECT id INTO event2_id FROM public.events WHERE user_id = user1_id AND name = 'Data Science Workshop';

    -- Certificates (use dummy hashes and tokens for dev)
    INSERT INTO public.certificates (id, event_id, certificate_number, recipient_name, file_hash, qr_token, status, issued_at)
    VALUES
        (gen_random_uuid(), event1_id, 'CERT-20240615-AABBCCDD', 'Jane Doe',
         'abc123def456abc123def456abc123def456abc123def456abc123def456ab01',
         'qrtok01aabbccddee112233445566778899aabbccddee112233445566778800',
         'active', '2024-06-15 09:00:00+00'),
        (gen_random_uuid(), event1_id, 'CERT-20240615-11223344', 'John Smith',
         'def456abc123def456abc123def456abc123def456abc123def456abc12302',
         'qrtok02aabbccddee112233445566778899aabbccddee112233445566778801',
         'revoked', '2024-06-15 09:00:00+00')
    RETURNING id INTO cert1_id;

    SELECT id INTO cert1_id FROM public.certificates WHERE certificate_number = 'CERT-20240615-AABBCCDD';
    SELECT id INTO cert2_id FROM public.certificates WHERE certificate_number = 'CERT-20240615-11223344';

    -- Update revoke fields for revoked cert
    UPDATE public.certificates
    SET revoked_at = NOW(), revoke_reason = 'Seed data test revoke'
    WHERE id = cert2_id;

    -- Verification logs
    INSERT INTO public.verification_logs (certificate_id, method, result, ip_address)
    VALUES
        (cert1_id, 'certificate_id', 'verified', '127.0.0.1'),
        (cert1_id, 'qr', 'verified', '127.0.0.1'),
        (cert2_id, 'certificate_id', 'revoked', '127.0.0.1'),
        (NULL, 'certificate_id', 'not_found', '127.0.0.1');

    RAISE NOTICE 'Seed completed. event1_id=%, event2_id=%, cert1_id=%, cert2_id=%',
        event1_id, event2_id, cert1_id, cert2_id;
END $$;
