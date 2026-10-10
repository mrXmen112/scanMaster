-- ============================================================
-- ScanMaster AI — Migration 002: feature_usage RLS
-- Run this SQL in the Supabase SQL Editor
-- ============================================================

-- 1. Create feature_usage table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.feature_usage (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  feature TEXT NOT NULL,
  use_count INTEGER DEFAULT 0,
  usage_date DATE DEFAULT CURRENT_DATE,
  first_used_at TIMESTAMPTZ DEFAULT now(),
  last_used_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, feature, usage_date)
);

-- 2. Enable RLS on feature_usage
ALTER TABLE public.feature_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feature_usage FORCE ROW LEVEL SECURITY;

-- 3. Users can read only their own feature usage
CREATE POLICY "Users can read own feature usage"
  ON public.feature_usage
  FOR SELECT
  USING (auth.uid() = user_id);

-- 4. Users can insert only their own feature usage
CREATE POLICY "Users can insert own feature usage"
  ON public.feature_usage
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 5. Users can update only their own feature usage
CREATE POLICY "Users can update own feature usage"
  ON public.feature_usage
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 6. Anonymous users cannot access feature_usage at all
CREATE POLICY "Anonymous users cannot access feature_usage"
  ON public.feature_usage
  FOR ALL
  USING (auth.role() = 'authenticated');

-- 7. Create index for performance
CREATE INDEX IF NOT EXISTS idx_feature_usage_user_feature
  ON public.feature_usage(user_id, feature);
