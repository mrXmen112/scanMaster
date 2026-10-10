-- Create ai_usage table for daily rate limiting
CREATE TABLE IF NOT EXISTS public.ai_usage (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  identifier TEXT NOT NULL,
  date TEXT NOT NULL,
  text_count INTEGER DEFAULT 0,
  pdf_count INTEGER DEFAULT 0,
  ocr_count INTEGER DEFAULT 0,
  translated_pdf_ids JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(identifier, date)
);

-- Enable RLS on ai_usage
ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;

-- Allow full access for any role — this is rate-limiting metadata, not user data.
-- The server-side anon-key client needs to insert/read/update for both guest and
-- authenticated user identifiers. User-specific auth is handled at the application
-- layer (resolveVerifiedIdentity in rate-limiter.ts).
CREATE POLICY "Allow all operations on ai_usage"
  ON public.ai_usage
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Grant privileges
GRANT ALL ON public.ai_usage TO anon;
GRANT ALL ON public.ai_usage TO authenticated;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_ai_usage_identifier_date
  ON public.ai_usage(identifier, date);
