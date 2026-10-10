-- Enable RLS on feature_usage (existing table)
ALTER TABLE IF EXISTS public.feature_usage ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can read own feature usage" ON public.feature_usage;
DROP POLICY IF EXISTS "Users can insert own feature usage" ON public.feature_usage;
DROP POLICY IF EXISTS "Users can update own feature usage" ON public.feature_usage;
DROP POLICY IF EXISTS "Users can delete own feature usage" ON public.feature_usage;
DROP POLICY IF EXISTS "Anonymous users cannot access feature_usage" ON public.feature_usage;
DROP POLICY IF EXISTS "Allow all operations on feature_usage" ON public.feature_usage;

-- Allow all DML for any authenticated role — the server-side anon-key client
-- needs CRUD access for free-tier feature usage tracking. User-level auth
-- is enforced at the application layer (resolveVerifiedIdentity).
CREATE POLICY "Allow all operations on feature_usage"
  ON public.feature_usage
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Grant privileges
GRANT ALL ON public.feature_usage TO anon;
GRANT ALL ON public.feature_usage TO authenticated;
