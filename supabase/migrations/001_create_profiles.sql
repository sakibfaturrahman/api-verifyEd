-- ============================================================
-- Migration: 001_create_profiles.sql
-- Description: Application user profiles linked to auth.users
-- Run in: Supabase SQL Editor or via supabase CLI
-- ============================================================

-- Create the custom role type
CREATE TYPE user_role AS ENUM ('admin', 'user');

-- Create the custom status type
CREATE TYPE user_status AS ENUM ('active', 'inactive');

-- Profiles table — mirrors auth.users with application-specific fields
CREATE TABLE IF NOT EXISTS public.profiles (
    id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name        VARCHAR(255) NOT NULL,
    email       VARCHAR(255) NOT NULL UNIQUE,
    phone       VARCHAR(50),
    address     TEXT,
    description TEXT,
    avatar_url  TEXT,
    role        user_role NOT NULL DEFAULT 'user',
    status      user_status NOT NULL DEFAULT 'active',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-update updated_at on row change
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- Auto-create profile when a new auth user signs up
-- This trigger fires AFTER a new user is inserted into auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, name, email, role, status)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
        NEW.email,
        'user',
        'active'
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

COMMENT ON TABLE public.profiles IS 'Application user profiles. Linked 1:1 to auth.users.';
COMMENT ON COLUMN public.profiles.role IS 'admin: full access | user: owns their events and certificates';
COMMENT ON COLUMN public.profiles.status IS 'inactive users cannot authenticate to protected endpoints';
