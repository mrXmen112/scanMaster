import { createClient, isSupabaseConfigured } from './client'

export interface UserProfile {
  id: string
  user_id: string
  name: string
  email: string
  created_at: string
}

/**
 * Check if an error is a PreconditionFailed / pending-state error.
 * These happen when the serverless function is still deploying.
 * We silently ignore these errors — the app works offline.
 */
function isPendingStateError(err: unknown): boolean {
  if (err instanceof Error) {
    const msg = err.message || ''
    return (
      msg.includes('pending state') ||
      msg.includes('PreconditionFailed') ||
      msg.includes('503')
    )
  }
  if (typeof err === 'object' && err !== null) {
    const obj = err as Record<string, unknown>
    return obj.Code === 'PreconditionFailed' || String(obj.Message || '').includes('pending state')
  }
  return false
}

/**
 * Ensure a profile row exists for the given user.
 *
 * The database has a trigger (handle_new_user) that auto-creates a profile
 * on signup, so we must NOT blindly insert. Instead:
 *   1. Try to fetch the existing profile.
 *   2. If found, return it.
 *   3. If not found, upsert one (in case of a race with the trigger).
 *      Never set the `id` column — let the database generate it.
 */
export async function ensureUserProfile(
  userId: string,
  email: string,
  name?: string
): Promise<UserProfile | null> {
  if (!isSupabaseConfigured()) return null

  try {
    const supabase = createClient()

    // 1. Check if profile already exists (likely created by the DB trigger)
    const { data: existing, error: selectError } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()

    if (existing) {
      return existing
    }

    // If it's a pending-state error, bail out silently
    if (selectError && isPendingStateError(selectError)) {
      return null
    }

    // selectError with no data could mean RLS blocked or row truly doesn't exist.
    // If it's a real DB error (not just "no rows"), bail out.
    if (selectError && selectError.code !== 'PGRST116') {
      return null
    }

    // 2. Profile doesn't exist yet — upsert to handle race with trigger.
    //    Do NOT set `id` — let the database default (gen_random_uuid()) handle it.
    const displayName = name || email.split('@')[0]

    const { data, error } = await supabase
      .from('profiles')
      .upsert(
        { user_id: userId, name: displayName, email },
        { onConflict: 'user_id' }
      )
      .select()
      .single()

    if (error) {
      // If it's a pending-state error, bail out silently
      if (isPendingStateError(error)) {
        return null
      }
      // Upsert also failed — do a final fetch in case the trigger created it
      // between our select and upsert (race condition).
      const { data: fallback } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle()

      return fallback
    }

    return data
  } catch (err) {
    // Silently handle errors (including PreconditionFailed) — app works offline
    if (isPendingStateError(err)) {
      console.info('[DB] Profile operation skipped — service in pending state')
    }
    return null
  }
}

export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  if (!isSupabaseConfigured()) return null

  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()

    if (error) {
      // Pending-state errors should be silently handled
      if (isPendingStateError(error)) {
        console.info('[DB] getUserProfile skipped — service in pending state')
      }
      return null
    }

    return data
  } catch (err) {
    // Silently handle errors (including PreconditionFailed) — app works offline
    if (isPendingStateError(err)) {
      console.info('[DB] getUserProfile skipped — service in pending state')
    }
    return null
  }
}

export async function updateUserProfile(
  userId: string,
  updates: Partial<Pick<UserProfile, 'name'>>
): Promise<UserProfile | null> {
  if (!isSupabaseConfigured()) return null

  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('user_id', userId)
      .select()
      .single()

    if (error) {
      if (isPendingStateError(error)) {
        console.info('[DB] updateUserProfile skipped — service in pending state')
        return null
      }
      throw new Error(error.message)
    }

    return data
  } catch (err) {
    // Silently handle errors (including PreconditionFailed) — app works offline
    if (isPendingStateError(err)) {
      console.info('[DB] updateUserProfile skipped — service in pending state')
    }
    return null
  }
}
