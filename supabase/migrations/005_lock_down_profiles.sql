-- 005_lock_down_profiles.sql
--
-- WHY THIS EXISTS
-- ---------------
-- Migrations 001-004 contain correct policies:
--
--     USING (auth.uid() = user_id)
--
-- but they were never applied to the live database. Verified against
-- https://irbfbdkyzcswonokqlqj.supabase.co with the *publishable* (anon)
-- key: an unauthenticated SELECT on public.profiles returned a real row,
-- including another user's user_id. With RLS correctly enabled that request
-- returns zero rows, because auth.uid() is NULL for an anonymous caller and
-- NULL = user_id is never true.
--
-- So the schema on disk and the schema in the cloud had drifted apart. This
-- migration re-states the intent idempotently so it is safe to run against a
-- database that has partial, missing, or dashboard-edited policies.
--
-- HOW TO APPLY
--   Supabase dashboard -> SQL Editor -> New query -> paste -> Run.
--   Re-running this is harmless: every statement is DROP ... IF EXISTS guarded.
--
-- VERIFY AFTER RUNNING (expect an empty array):
--   curl "<PROJECT_URL>/rest/v1/profiles?select=*" \
--        -H "apikey: <PUBLISHABLE_KEY>" \
--        -H "Authorization: Bearer <PUBLISHABLE_KEY>" -i
--   HTTP/1.1 200 OK with "[]" is correct. A returned row means it did not take.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Make sure RLS is actually on. Also FORCE it, so that even the table
--    owner (and any connection using a role that bypasses RLS) is subject to
--    the policies. FORCE is what closes the "owner bypasses RLS" hole.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.profiles     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles     FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.user_files   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_files   FORCE  ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. profiles — rebuild the policy set from scratch.
--    Dropping first means a stray permissive policy created by hand in the
--    dashboard cannot survive alongside these.
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can read own profile"   ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can delete own profile" ON public.profiles;

CREATE POLICY "Users can read own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() IS NOT NULL AND auth.uid() = user_id);

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = user_id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() IS NOT NULL AND auth.uid() = user_id)
  WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = user_id);

CREATE POLICY "Users can delete own profile"
  ON public.profiles FOR DELETE
  USING (auth.uid() IS NOT NULL AND auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. user_files — same treatment. The owner column is `user_id` (confirmed
--    against 001_initial_schema.sql). `FORCE` above is what stops the table
--    owner role from reading the whole table regardless of these policies.
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can read own files"   ON public.user_files;
DROP POLICY IF EXISTS "Users can insert own files" ON public.user_files;
DROP POLICY IF EXISTS "Users can update own files" ON public.user_files;
DROP POLICY IF EXISTS "Users can delete own files" ON public.user_files;
DROP POLICY IF EXISTS "Users can upload own files" ON public.user_files;

CREATE POLICY "Users can read own files"
  ON public.user_files FOR SELECT
  USING (auth.uid() IS NOT NULL AND auth.uid() = user_id);

CREATE POLICY "Users can insert own files"
  ON public.user_files FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = user_id);

CREATE POLICY "Users can update own files"
  ON public.user_files FOR UPDATE
  USING (auth.uid() IS NOT NULL AND auth.uid() = user_id)
  WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = user_id);

CREATE POLICY "Users can delete own files"
  ON public.user_files FOR DELETE
  USING (auth.uid() IS NOT NULL AND auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Verification helper. Run this after the above; every table should report
--    rls_enabled = true, rls_forced = true, and 0 policies that permit an
--    anonymous (auth.uid() IS NULL) read.
-- ─────────────────────────────────────────────────────────────────────────────
-- SELECT c.relname                       AS table_name,
--        c.relrowsecurity                AS rls_enabled,
--        c.relforcerowsecurity          AS rls_forced,
--        count(p.polname)                AS policy_count
-- FROM pg_class c
-- JOIN pg_namespace n ON n.oid = c.relnamespace
-- LEFT JOIN pg_policy p ON p.polrelid = c.oid
-- WHERE n.nspname = 'public'
--   AND c.relname IN ('profiles', 'user_files', 'feature_usage')
-- GROUP BY c.relname, c.relrowsecurity, c.relforcerowsecurity;