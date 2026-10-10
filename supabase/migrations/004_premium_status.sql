-- ============================================================
-- ScanMaster AI — Migration 004: premium_status & Razorpay
-- Run this SQL in the Supabase SQL Editor
-- ============================================================

-- 1. Add premium_status column to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS premium_status BOOLEAN DEFAULT false NOT NULL;

-- 2. Add subscription_id column to profiles (Razorpay subscription ID)
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS subscription_id TEXT DEFAULT '';

-- 3. Create subscriptions tracking table
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  razorpay_subscription_id TEXT NOT NULL,
  plan_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'created',
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(user_id, razorpay_subscription_id)
);

-- 4. Enable RLS on subscriptions
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- 5. Users can read only their own subscriptions
CREATE POLICY "Users can read own subscriptions"
  ON public.subscriptions
  FOR SELECT
  USING (auth.uid() = user_id);

-- 6. Users can insert only their own subscriptions
CREATE POLICY "Users can insert own subscriptions"
  ON public.subscriptions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 7. Users can update only their own subscriptions
CREATE POLICY "Users can update own subscriptions"
  ON public.subscriptions
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 8. Index for faster subscription lookups
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id
  ON public.subscriptions(user_id);

CREATE INDEX IF NOT EXISTS idx_subscriptions_razorpay_id
  ON public.subscriptions(razorpay_subscription_id);

-- ============================================================
-- Razorpay Payment RLS Policies (user-owned billing)
-- ============================================================

-- 9. RLS for payments.razorpay_subscriptions (user-owned)
CREATE POLICY "Users can create own razorpay subscriptions"
  ON payments.razorpay_subscriptions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    subject_type = 'user'
    AND subject_id = auth.uid()::text
  );

-- 10. RLS for payments.razorpay_orders (user-owned)
CREATE POLICY "Users can create own razorpay orders"
  ON payments.razorpay_orders
  FOR INSERT
  TO authenticated
  WITH CHECK (
    subject_type = 'user'
    AND subject_id = auth.uid()::text
  );

-- ============================================================
-- Fulfillment trigger — update profiles.premium_status on webhook
-- ============================================================

-- 11. Function to update premium_status when subscription is charged/activated
CREATE OR REPLACE FUNCTION public.fulfill_premium_subscription()
RETURNS TRIGGER AS $$
DECLARE
  v_subject_type TEXT;
  v_subject_id TEXT;
  v_subscription_id TEXT;
BEGIN
  IF NEW.provider <> 'razorpay' OR NEW.processing_status <> 'processed' THEN
    RETURN NEW;
  END IF;

  -- Handle subscription.charged and subscription.activated events
  IF NEW.event_type IN ('subscription.charged', 'subscription.activated') THEN
    v_subject_type := NEW.payload -> 'payload' -> 'subscription' -> 'entity'
                      -> 'notes' ->> 'insforge_subject_type';
    v_subject_id := NEW.payload -> 'payload' -> 'subscription' -> 'entity'
                    -> 'notes' ->> 'insforge_subject_id';
    v_subscription_id := NEW.payload -> 'payload' -> 'subscription' -> 'entity'
                         ->> 'id';

    -- Fallback to customer_mappings if notes not available
    IF v_subject_id IS NULL THEN
      SELECT m.subject_type, m.subject_id
      INTO v_subject_type, v_subject_id
      FROM payments.customer_mappings m
      WHERE m.provider = NEW.provider
        AND m.environment = NEW.environment
        AND m.provider_customer_id = NEW.payload -> 'payload' -> 'subscription'
                                     -> 'entity' ->> 'customer_id';
    END IF;

    IF v_subject_id IS NOT NULL AND v_subject_type = 'user' THEN
      -- Upsert premium_status on profiles (handles users without existing profile row)
      INSERT INTO public.profiles (user_id, name, email, premium_status, subscription_id)
      VALUES (v_subject_id::uuid, '', '', true, v_subscription_id)
      ON CONFLICT (user_id) DO UPDATE SET
        premium_status = true,
        subscription_id = v_subscription_id;

      -- Upsert subscription record
      INSERT INTO public.subscriptions (user_id, razorpay_subscription_id, plan_id, status)
      VALUES (
        v_subject_id::uuid,
        v_subscription_id,
        NEW.payload -> 'payload' -> 'subscription' -> 'entity' -> 'plan_id',
        'active'
      )
      ON CONFLICT (user_id, razorpay_subscription_id) DO UPDATE
      SET status = 'active',
          plan_id = EXCLUDED.plan_id,
          updated_at = NOW();
    END IF;
  END IF;

  -- Only revoke premium on explicit user cancellation or natural completion.
  -- Keep premium active on payment failures (halted/expired) — don't cut access.
  -- Razorpay Payment Retry should be enabled in Dashboard to auto-retry failed charges.
  IF NEW.event_type IN ('subscription.cancelled', 'subscription.completed') THEN
    v_subscription_id := NEW.payload -> 'payload' -> 'subscription' -> 'entity' ->> 'id';

    UPDATE public.profiles p
    SET premium_status = false,
        subscription_id = ''
    FROM public.subscriptions s
    WHERE s.razorpay_subscription_id = v_subscription_id
      AND p.user_id = s.user_id;

    UPDATE public.subscriptions
    SET status = 'cancelled',
        updated_at = NOW()
    WHERE razorpay_subscription_id = v_subscription_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 12. Trigger on payments.webhook_events
DROP TRIGGER IF EXISTS fulfill_premium_trigger ON payments.webhook_events;
CREATE TRIGGER fulfill_premium_trigger
  AFTER INSERT OR UPDATE ON payments.webhook_events
  FOR EACH ROW
  EXECUTE FUNCTION public.fulfill_premium_subscription();
