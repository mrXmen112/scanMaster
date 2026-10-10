# 🔐 SUPABASE AUTHENTICATION SETUP GUIDE
# Follow these steps to enable login/signup in your APK

## Step 1: Create Supabase Project (FREE)
1. Go to: https://supabase.com
2. Click "Start your project"
3. Sign in with GitHub (recommended)
4. Click "New Project"
5. Fill in:
   - Name: scanmaster-ai
   - Database Password: (generate strong password - SAVE IT!)
   - Region: Choose closest to you
   - Pricing Plan: Free (sufficient for this app)
6. Click "Create new project"
7. Wait 2-3 minutes for setup to complete

## Step 2: Get Your Credentials
1. In Supabase dashboard, go to: Settings → API
2. Copy these values:
   - Project URL (looks like: https://xxxxx.supabase.co)
   - anon public key (starts with: eyJhbGc...)

## Step 3: Update .env File
Replace these lines in D:\scanMaster_ai\.env:

NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...your-key-here

## Step 4: Enable Email Authentication
1. In Supabase dashboard: Authentication → Providers
2. Find "Email" provider
3. Make sure it's ENABLED (toggle should be green)
4. Confirm email is required: YES
5. Click Save

## Step 5: Configure Google OAuth (Optional)
1. In Supabase dashboard: Authentication → Providers → Google
2. Enable Google provider
3. You'll need:
   - Google OAuth Client ID
   - Google OAuth Client Secret
4. Get these from: https://console.cloud.google.com/apis/credentials
5. Authorized redirect URIs: Add your Supabase callback URL
   (Supabase will show you the exact URL to add)

## Step 6: Create profiles Table (Required)
1. In Supabase dashboard: SQL Editor
2. Click "New Query"
3. Paste this SQL:

```sql
-- Create profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS (Row Level Security)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own profile
CREATE POLICY "Users can view own profile"
    ON public.profiles
    FOR SELECT
    USING (auth.uid() = user_id);

-- Policy: Users can update their own profile
CREATE POLICY "Users can update own profile"
    ON public.profiles
    FOR UPDATE
    USING (auth.uid() = user_id);

-- Policy: Users can insert their own profile
CREATE POLICY "Users can insert own profile"
    ON public.profiles
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Function to create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (user_id, name)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1))
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-create profile
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();
```

4. Click "Run" (or press Ctrl+Enter)
5. Should see: "Success. No rows returned"

## Step 7: Configure Email Templates (Optional but Recommended)
1. In Supabase dashboard: Authentication → Email Templates
2. Customize these templates:
   - Confirm signup
   - Magic Link
   - Change Email Address
3. Make sure redirect URLs point to: https://scanmaster-ai.vercel.app

## Step 8: Deploy to Vercel
After updating .env file:

```powershell
# If using Vercel CLI:
vercel env pull

# Or manually add in Vercel Dashboard:
# Settings → Environment Variables → Add:
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...your-key-here
OPENROUTER_API_KEY=sk-or-v1-<your-key-here>
DATABASE_URL=postgresql://...
```

Then redeploy:
```powershell
git add .
git commit -m "Add Supabase authentication"
git push
```

## Step 9: Rebuild APK
```powershell
cd D:\scanMaster_ai
node scripts/build-apk.js
npx cap sync android
npx cap open android
```

## Step 10: Test Authentication
After installing APK:
1. Open app
2. Go to Profile tab
3. Click "Sign Up"
4. Enter email and password
5. Check email for verification code
6. Enter code to verify
7. You're logged in!

## Troubleshooting

### "Supabase not configured"
- Check .env file has correct NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
- Rebuild APK after updating .env
- Make sure variables start with NEXT_PUBLIC_ (required for client-side)

### Email not sending
- Check Supabase dashboard: Authentication → Settings
- Make sure "Enable Email Confirmations" is ON
- Check spam folder
- For production, configure custom SMTP in Supabase

### Google OAuth not working
- Check redirect URI matches exactly in Google Console
- Make sure authorized domains include your Supabase project URL
- In Supabase, enable "Enable Manual Linking" if needed

### "User already exists"
- User tried to sign up with existing email
- Tell them to use "Sign In" instead
- Or use "Forgot Password" to reset

## Quick Test (Without Creating Account)
You can test with guest mode:
- App works without login
- AI features available with device ID
- Login optional for premium features

## Security Notes
- ✅ NEXT_PUBLIC_* variables are safe to expose (client-side)
- ❌ Never expose DATABASE_URL or OPENROUTER_API_KEY in client
- ✅ Row Level Security (RLS) enabled on profiles table
- ✅ Email verification required for new accounts
- ✅ OAuth uses secure redirect flow

## Support
If issues persist:
1. Check Supabase logs: Logs → Auth
2. Check browser console: F12 → Console
3. Check Android logs: Chrome → chrome://inspect
