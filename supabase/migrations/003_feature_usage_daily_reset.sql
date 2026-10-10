-- ============================================================
-- ScanMaster AI — Migration 003: feature_usage daily reset
-- Run this SQL in the Supabase SQL Editor
-- ============================================================

-- 1. Add usage_date column for daily tracking
ALTER TABLE public.feature_usage ADD COLUMN IF NOT EXISTS usage_date DATE DEFAULT CURRENT_DATE;

-- 2. Drop old unique constraint
ALTER TABLE public.feature_usage DROP CONSTRAINT IF EXISTS feature_usage_user_id_feature_key;

-- 3. Add new daily-scoped unique constraint
ALTER TABLE public.feature_usage ADD CONSTRAINT unique_user_feature_date UNIQUE (user_id, feature, usage_date);

-- 4. Backfill existing rows
UPDATE public.feature_usage SET usage_date = CURRENT_DATE WHERE usage_date IS NULL;

-- 5. Update RLS to allow upsert by usage_date
DROP POLICY IF EXISTS "Users can update own feature usage" ON public.feature_usage;
CREATE POLICY "Users can update own feature usage"
  ON public.feature_usage
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 6. Update index to include usage_date
DROP INDEX IF EXISTS idx_feature_usage_user_feature;
CREATE INDEX IF NOT EXISTS idx_feature_usage_user_feature_date
  ON public.feature_usage(user_id, feature, usage_date);
