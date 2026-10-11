-- 005_lock_down_profiles.sql
--
-- WHY THIS EXISTS
-- ---------------
-- Migrations 001-004 contain correct policies:
--
--     USING (auth.uid() = user_id)
--
-- but they were never applied to the live database. Verified against the
-- ScanMaster project with the *publishable* key: an unauthenticated
-- SELECT on public.profiles returned 6 rows, including real user_ids,
-- display names and Google avatar URLs. user_files and feature_usage
-- correctly returned zero rows, so the gap was specific to profiles.
--
-- This matters more than it otherwise would: the publishable key is
-- embedded in the Android bundle, so anyone who unzips the APK has it.
-- As shipped, that was enough to enumerate every account in the product.
--
-- Confirmed live state before writing this migration:
--   profiles       EXISTS, anonymous SELECT returns rows   <-- open
--   user_files     EXISTS, anonymous SELECT returns 0 rows <-- ok
--   feature_usage  EXISTS, anonymous SELECT returns 0 rows <-- ok
--   subscriptions  not exposed
--   storage        no bucket publicly readable
--   anon INSERT    correctly denied (42501)
--
-- HOW TO APPLY
--   Supabase dashboard -> SQL Editor -> New query -> paste -> Run.
--   Re-running is harmless: every statement is DROP ... IF EXISTS guarded.
--
-- VERIFY AFTER RUNNING (expect []):
--   curl "<PROJECT_URL>/rest/v1/profiles?select=*" \
--        -H "apikey: <PUBLISHABLE_KEY>" \
--        -H "Authorization: Bearer <PUBLISHABLE_KEY>"
--
-- ─────────────────────────────────────────────────────────────────────────────
-- BUG 1 — FIXED HERE: FORCE ROW LEVEL SECURITY BREAKS SIGNUP
-- ─────────────────────────────────────────────────────────────────────────────
-- An earlier draft of this file ran
--     ALTER TABLE public.profiles FORCE ROW LEVEL SECURITY;
-- That is wrong. public.profiles is written by public.handle_new_user(),
-- a SECURITY DEFINER trigger that fires AFTER INSERT ON auth.users.
--
-- The trigger runs as the table owner, and FORCE means the owner is *also*
-- subject to RLS. During signup there is no authenticated JWT yet, so
-- auth.uid() IS NULL, and the trigger's INSERT is checked against:
--     WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = user_id)
-- which is false. Every new signup would fail at the database with
-- "new row violates row-level security policy", breaking account creation.
--
-- ENABLE alone is sufficient here. PostgREST reaches the table as the
-- anon/authenticated roles, never as the owner, so owner-bypass is not a
-- path an attacker can use through the public API. FORCE only matters for
-- connections made *as* the owner, which is not how this app talks to
-- Postgres at all. Correctness of signup beats defence-in-depth that no
-- request path can reach.

ALTER TABLE public.profiles     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_files   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feature_usage ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. profiles — rebuild the policy set from scratch.
--    Dropping first means a stray permissive policy created by hand in the
--    dashboard cannot survive alongside these.
--
--    Also note the live table has more columns than 001_initial_schema.sql
--    declared (username, bio, location, website, avatar_url, preferences,
--    updated_at). Only ownership matters for policies, so no column list is
--    referenced here — the policies are ownership-only by design.
-- ─────────────────────────────────────────────────────────────────────────────
-- Drop every existing policy by enumerating pg_policies, not by a fixed list
-- of names. A permissive policy hand-created in the dashboard would otherwise
-- survive next to the strict ones below, which is exactly the failure that
-- left profiles readable in the first place.
DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='profiles'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.profiles', p.policyname);
  END LOOP;
END $$;

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
-- 3. user_files — same treatment. Owner column is user_id (confirmed against
--    001_initial_schema.sql).
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='user_files'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.user_files', p.policyname);
  END LOOP;
END $$;

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
-- 4. feature_usage — migration 002 already enables RLS and has correct
--    policies, but rebuild for completeness so one run fixes every table.
--    Its UNIQUE(user_id, feature, usage_date) key means the client upserts,
--    so INSERT and UPDATE are both required.
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='feature_usage'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.feature_usage', p.policyname);
  END LOOP;
END $$;

CREATE POLICY "Users can read own feature usage"
  ON public.feature_usage FOR SELECT
  USING (auth.uid() IS NOT NULL AND auth.uid() = user_id);

CREATE POLICY "Users can insert own feature usage"
  ON public.feature_usage FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = user_id);

CREATE POLICY "Users can update own feature usage"
  ON public.feature_usage FOR UPDATE
  USING (auth.uid() IS NOT NULL AND auth.uid() = user_id)
  WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Verification query. Run this after the statements above.
--    Expected: every table rls_enabled=true, policy_count=4/4/3.
-- ─────────────────────────────────────────────────────────────────────────────
-- SELECT c.relname                       AS table_name,
--        c.relrowsecurity                AS rls_enabled,
--        count(p.polname)                AS policy_count
-- FROM pg_class c
-- JOIN pg_namespace n ON n.oid = c.relnamespace
-- LEFT JOIN pg_policy p ON p.polrelid = c.oid
-- WHERE n.nspname = 'public'
--   AND c.relname IN ('profiles','user_files','feature_usage')
-- GROUP BY c.relname, c.relrowsecurity
-- ORDER BY c.relname;