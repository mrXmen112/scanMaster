-- ============================================================
-- ScanMaster AI — Supabase Database Schema
-- Run this SQL in the Supabase SQL Editor
--
-- HOW TO USE:
-- 1. Open https://supabase.com/dashboard/project/sswyiiqyveufsejftgbv/sql
-- 2. Paste this entire script into the SQL Editor
-- 3. Click "Run" to create all tables, policies, and triggers
--
-- NOTE: This .sql file cannot be previewed in the IDE.
--       Use the "Download" or "Copy" button in the app's
--       Setup Wizard (Profile → Database Setup) instead.
-- ============================================================

-- 1. Create profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 2. Create user_files table
CREATE TABLE IF NOT EXISTS public.user_files (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size BIGINT DEFAULT 0,
  file_type TEXT DEFAULT 'pdf',
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 3. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_files_user_id ON public.user_files(user_id);
CREATE INDEX IF NOT EXISTS idx_user_files_created_at ON public.user_files(created_at DESC);

-- ============================================================
-- Row Level Security (RLS) Policies
-- ============================================================

-- Enable RLS on both tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_files ENABLE ROW LEVEL SECURITY;

-- 4. Profiles: Users can read their own profile
CREATE POLICY "Users can read own profile"
  ON public.profiles
  FOR SELECT
  USING (auth.uid() = user_id);

-- 5. Profiles: Users can insert their own profile
CREATE POLICY "Users can insert own profile"
  ON public.profiles
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 6. Profiles: Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 7. User files: Users can read only their own files
CREATE POLICY "Users can read own files"
  ON public.user_files
  FOR SELECT
  USING (auth.uid() = user_id);

-- 8. User files: Users can insert only their own files
CREATE POLICY "Users can insert own files"
  ON public.user_files
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 9. User files: Users can update only their own files
CREATE POLICY "Users can update own files"
  ON public.user_files
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 10. User files: Users can delete only their own files
CREATE POLICY "Users can delete own files"
  ON public.user_files
  FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================
-- Storage Bucket & Policies
-- ============================================================

-- 11. Create the user-files bucket (if it doesn't exist)
-- Run this in the Supabase Dashboard → Storage → New Bucket
-- Bucket name: user-files
-- Public: false (files are private, accessed via signed URLs or RLS)

-- 12. Storage policies (run in SQL Editor)
-- Allow authenticated users to upload files to their own folder
CREATE POLICY "Users can upload own files"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'user-files'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Allow authenticated users to read their own files
CREATE POLICY "Users can read own files"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'user-files'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Allow authenticated users to update their own files
CREATE POLICY "Users can update own files"
  ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'user-files'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Allow authenticated users to delete their own files
CREATE POLICY "Users can delete own files"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'user-files'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- ============================================================
-- Trigger: Auto-create profile on signup
-- ============================================================

-- 13. Function to auto-create profile when a new user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 14. Trigger on auth.users insert
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
