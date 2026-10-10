import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isPendingError, handleApiError } from '@/lib/api-error-handler'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  ''

function getClient() {
  if (!supabaseUrl || !supabaseKey) return null
  return createClient(supabaseUrl, supabaseKey)
}

// ─── Server-side request dedup ──────────────────────────────────────────
// Prevents multiple concurrent GET /api/setup/supabase requests from
// all hitting Supabase at the same time (which causes PreconditionFailed).

let inFlightGet: Promise<NextResponse> | null = null
let cachedGetResponse: { response: NextResponse; timestamp: number } | null = null
const CACHE_TTL_MS = 10_000 // Cache GET results for 10 seconds on server side

// Server-side pending backoff: if we recently got a PreconditionFailed error,
// don't even try to hit Supabase again for a few seconds.
let pendingUntil = 0
const PENDING_BACKOFF_MS = 5_000

/**
 * Check if an error from a Supabase query indicates "table not found"
 * but the connection itself is working fine.
 */
function isTableNotFoundError(error: { message?: string; code?: string; status?: number }): boolean {
  if (!error) return false
  if (error.code === 'PGRST205') return true
  if (error.code === '42P01') return true
  if (error.message?.includes('does not exist')) return true
  if (error.message?.includes('Could not find the table')) return true
  if (error.message?.includes('relation') && error.message?.includes('does not exist')) return true
  return false
}

/**
 * Check if an error means the connection is working
 * (any structured error response = we reached Supabase)
 */
function isConnectionWorking(error: { message?: string; code?: string; status?: number }): boolean {
  if (!error) return true
  if (error.status && error.status !== 500) return true
  if (error.code) return true
  return false
}

/**
 * Probe the "user-files" storage bucket by attempting a lightweight upload.
 * The error tells us if the bucket exists:
 *   - "Bucket not found" (404) → bucket doesn't exist
 *   - RLS / policy error (403) → bucket exists but we lack permission
 *   - No error → bucket exists
 */
async function probeBucketExists(client: ReturnType<typeof createClient>): Promise<boolean> {
  try {
    const testBlob = new Blob([''], { type: 'text/plain' })
    const { error: uploadError } = await client.storage
      .from('user-files')
      .upload('__probe_check__', testBlob, { upsert: false })

    if (!uploadError) {
      // Upload succeeded — bucket definitely exists. Clean up.
      try { await client.storage.from('user-files').remove(['__probe_check__']) } catch { /* ignore */ }
      return true
    }

    if (
      uploadError.message?.includes('Bucket not found') ||
      uploadError.message?.includes('does not exist') ||
      uploadError.statusCode === '404'
    ) {
      return false
    }

    // Any other error (RLS, policy, already exists, etc.) means bucket exists
    return true
  } catch {
    return false
  }
}

async function doGet(): Promise<NextResponse> {
  const client = getClient()

  // Check if Supabase is configured at all
  if (!client) {
    return NextResponse.json({
      configured: false,
      connection: false,
      tables: { profiles: false, user_files: false },
      bucket: false,
      allGood: false,
      summary: 'Supabase is not configured. Missing environment variables.',
    })
  }

  // Server-side pending backoff: if we recently got a pending error,
  // skip the Supabase queries and return a 503 immediately.
  if (Date.now() < pendingUntil) {
    return NextResponse.json(
      { configured: true, connection: false, tables: { profiles: false, user_files: false }, bucket: false, allGood: false, summary: 'Setup is still processing. Please wait a few seconds and try again.' },
      { status: 503 }
    )
  }

  // Check connection AND profiles table in ONE query (they were previously separate)
  let connectionOk = false
  let profilesExists = false
  try {
    const { error: profilesError } = await client.from('profiles').select('id').limit(1)
    if (!profilesError) {
      connectionOk = true
      profilesExists = true
    } else if (isTableNotFoundError(profilesError)) {
      // Table not found = connection works, table just doesn't exist yet
      connectionOk = true
      profilesExists = false
    } else if (isConnectionWorking(profilesError)) {
      // Any structured error means we connected (RLS, etc. = table likely exists)
      connectionOk = true
      profilesExists = true
    }
  } catch {
    connectionOk = false
  }

  // Check user_files table
  let userFilesExists = false
  if (connectionOk) {
    try {
      const { error: filesError } = await client.from('user_files').select('id').limit(1)
      if (!filesError) {
        userFilesExists = true
      } else if (isTableNotFoundError(filesError)) {
        userFilesExists = false
      } else {
        userFilesExists = true
      }
    } catch {
      userFilesExists = false
    }
  }

  // Check bucket (only if connected — saves a network call)
  let bucketExists = false
  if (connectionOk) {
    bucketExists = await probeBucketExists(client)
  }

  const allGood = connectionOk && profilesExists && userFilesExists && bucketExists

  let summary = ''
  if (!connectionOk) {
    summary = 'Cannot connect to Supabase. Check your credentials and network.'
  } else if (!profilesExists || !userFilesExists) {
    const missing = []
    if (!profilesExists) missing.push('profiles')
    if (!userFilesExists) missing.push('user_files')
    summary = `Connected! Tables missing: ${missing.join(', ')}. Run the SQL migration in the Supabase SQL Editor.`
  } else if (!bucketExists) {
    summary = 'Tables exist, but the "user-files" storage bucket is missing. Create it in the Supabase Dashboard or click "Create Bucket".'
  } else {
    summary = 'All set! Database tables and storage bucket are ready.'
  }

  return NextResponse.json({
    configured: true,
    connection: connectionOk,
    tables: { profiles: profilesExists, user_files: userFilesExists },
    bucket: bucketExists,
    allGood,
    summary,
  })
}

/**
 * GET handler — with server-side dedup, caching, and pending backoff.
 */
export async function GET(): Promise<NextResponse> {
  // Return cached response if fresh
  if (cachedGetResponse && (Date.now() - cachedGetResponse.timestamp) < CACHE_TTL_MS) {
    return cachedGetResponse.response
  }

  // If a request is already in-flight, piggyback on it
  if (inFlightGet) return inFlightGet

  // Start a new request
  inFlightGet = (async () => {
    try {
      const response = await doGet()
      cachedGetResponse = { response, timestamp: Date.now() }
      return response
    } catch (err) {
      if (isPendingError(err)) {
        // Set server-side pending backoff
        pendingUntil = Date.now() + PENDING_BACKOFF_MS
        return NextResponse.json(
          { configured: true, connection: false, tables: { profiles: false, user_files: false }, bucket: false, allGood: false, summary: 'Setup is still processing. Please wait a few seconds and try again.' },
          { status: 503 }
        )
      }
      return handleApiError(err, 'GET /api/setup/supabase')
    } finally {
      inFlightGet = null
    }
  })()

  return inFlightGet
}

// ─── Server-side POST dedup ─────────────────────────────────────────────
let inFlightPost: Promise<NextResponse> | null = null

export async function POST(): Promise<NextResponse> {
  // If a POST is already in-flight, return its promise (dedup)
  if (inFlightPost) return inFlightPost

  // Server-side pending backoff
  if (Date.now() < pendingUntil) {
    return NextResponse.json(
      { success: false, results: [{ action: 'setup', success: false, message: 'Setup is still processing. Please wait a few seconds and try again.' }], bucketCreated: false },
      { status: 503 }
    )
  }

  inFlightPost = (async () => {
    try {
      const client = getClient()

      if (!client) {
        return NextResponse.json({
          success: false,
          message: 'Supabase is not configured. Missing environment variables.',
        })
      }

      const results: { action: string; success: boolean; message: string }[] = []

      // Try to create the storage bucket
      try {
        const bucketExists = await probeBucketExists(client)

        if (!bucketExists) {
          const { error: createError } = await client.storage.createBucket('user-files', {
            public: false,
            fileSizeLimit: 50 * 1024 * 1024,
          })
          if (createError) {
            results.push({ action: 'create_bucket', success: false, message: `Failed: ${createError.message}. Create it manually in the Supabase Dashboard → Storage.` })
          } else {
            results.push({ action: 'create_bucket', success: true, message: 'Bucket "user-files" created successfully.' })
          }
        } else {
          results.push({ action: 'create_bucket', success: true, message: 'Bucket "user-files" already exists.' })
        }
      } catch (err) {
        results.push({ action: 'create_bucket', success: false, message: `Error: ${(err as Error).message}. Create it manually in the Supabase Dashboard → Storage.` })
      }

      // Check tables (single query — reuse the same logic)
      try {
        const { error: profileError } = await client.from('profiles').select('id').limit(1)
        if (isTableNotFoundError(profileError)) {
          results.push({ action: 'check_tables', success: false, message: 'Tables do not exist. Run the SQL migration in the Supabase SQL Editor.' })
        } else {
          results.push({ action: 'check_tables', success: true, message: 'Tables appear to exist.' })
        }
      } catch {
        results.push({ action: 'check_tables', success: false, message: 'Could not verify tables. Run the SQL migration manually.' })
      }

      // Check bucket status after creation
      const bucketCreated = await probeBucketExists(client)

      // Invalidate the GET cache so next check returns fresh data
      cachedGetResponse = null

      return NextResponse.json({
        success: results.every((r) => r.success),
        results,
        bucketCreated,
      })
    } catch (err) {
      // Invalidate GET cache on error too
      cachedGetResponse = null

      if (isPendingError(err)) {
        pendingUntil = Date.now() + PENDING_BACKOFF_MS
        return NextResponse.json(
          { success: false, results: [{ action: 'setup', success: false, message: 'Setup is still processing. Please wait a few seconds and try again.' }], bucketCreated: false },
          { status: 503 }
        )
      }
      return handleApiError(err, 'POST /api/setup/supabase')
    } finally {
      inFlightPost = null
    }
  })()

  return inFlightPost
}
