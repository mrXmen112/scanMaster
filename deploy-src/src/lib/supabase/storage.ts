import { createClient, isSupabaseConfigured } from './client'

const BUCKET_NAME = 'user-files'

/**
 * Check if an error is a PreconditionFailed / pending-state error.
 * These happen when the serverless function is still deploying.
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
 * Generate a signed URL for a private bucket file.
 * Public URLs don't work for private buckets — signed URLs include a token.
 */
async function getSignedUrl(filePath: string): Promise<string> {
  const supabase = createClient()
  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .createSignedUrl(filePath, 3600) // 1 hour expiry

  if (error || !data) {
    console.error('[Storage] Signed URL error:', error?.message)
    // Fallback to public URL (won't work for private buckets but better than nothing)
    const { data: urlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(filePath)
    return urlData.publicUrl
  }

  return data.signedUrl
}

export async function uploadFile(
  userId: string,
  file: File,
  onProgress?: (progress: number) => void
): Promise<{ path: string; url: string } | null> {
  if (!isSupabaseConfigured()) return null

  try {
    const supabase = createClient()
    // Upload path format: {user_id}/{filename}
    const filePath = `${userId}/${file.name}`

    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      })

    if (error) {
      if (isPendingStateError(error)) {
        console.info('[Storage] Upload skipped — service in pending state')
        return null
      }
      console.error('[Storage] Upload error:', error.message)
      throw new Error(error.message)
    }

    // Private bucket — use signed URL
    const signedUrl = await getSignedUrl(data.path)

    return {
      path: data.path,
      url: signedUrl,
    }
  } catch (err) {
    if (isPendingStateError(err)) {
      console.info('[Storage] Upload skipped — service in pending state')
      return null
    }
    throw err
  }
}

export async function listUserFiles(userId: string) {
  if (!isSupabaseConfigured()) return []

  try {
    const supabase = createClient()

    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .list(userId, {
        sortBy: { column: 'created_at', order: 'desc' },
      })

    if (error) {
      if (isPendingStateError(error)) {
        console.info('[Storage] List files skipped — service in pending state')
        return []
      }
      console.error('[Storage] List error:', error.message)
      return []
    }

    const files = data.filter(f => f.id && !f.name.startsWith('.'))
    // Generate signed URLs for all files in parallel
    const filesWithUrls = await Promise.all(
      files.map(async (f) => {
        const signedUrl = await getSignedUrl(`${userId}/${f.name}`)
        return {
          id: f.id,
          name: f.name,
          size: f.metadata?.size || 0,
          created: f.created_at,
          url: signedUrl,
        }
      })
    )
    return filesWithUrls
  } catch (err) {
    if (isPendingStateError(err)) {
      console.info('[Storage] List files skipped — service in pending state')
      return []
    }
    console.error('[Storage] List error:', err)
    return []
  }
}

export async function deleteUserFile(userId: string, fileName: string) {
  if (!isSupabaseConfigured()) return false

  try {
    const supabase = createClient()
    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .remove([`${userId}/${fileName}`])

    if (error) {
      if (isPendingStateError(error)) {
        console.info('[Storage] Delete skipped — service in pending state')
        return false
      }
      console.error('[Storage] Delete error:', error.message)
      throw new Error(error.message)
    }

    // Also remove from user_files table
    await supabase
      .from('user_files')
      .delete()
      .eq('user_id', userId)
      .eq('file_name', fileName)

    return true
  } catch (err) {
    if (isPendingStateError(err)) {
      console.info('[Storage] Delete skipped — service in pending state')
      return false
    }
    throw err
  }
}

export async function saveFileRecord(
  userId: string,
  fileName: string,
  filePath: string,
  fileUrl: string,
  fileSize: number,
  fileType: string
) {
  if (!isSupabaseConfigured()) return null

  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('user_files')
      .insert({
        user_id: userId,
        file_name: fileName,
        file_path: filePath,
        file_url: fileUrl,
        file_size: fileSize,
        file_type: fileType,
      })
      .select()
      .single()

    if (error) {
      if (isPendingStateError(error)) {
        console.info('[Storage] Save record skipped — service in pending state')
        return null
      }
      console.error('[Storage] Save record error:', error.message)
      throw new Error(error.message)
    }

    return data
  } catch (err) {
    if (isPendingStateError(err)) {
      console.info('[Storage] Save record skipped — service in pending state')
      return null
    }
    throw err
  }
}

export async function getUserFileRecords(userId: string) {
  if (!isSupabaseConfigured()) return []

  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('user_files')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) {
      if (isPendingStateError(error)) {
        console.info('[Storage] Get records skipped — service in pending state')
        return []
      }
      console.error('[Storage] Get records error:', error.message)
      return []
    }

    return data || []
  } catch (err) {
    if (isPendingStateError(err)) {
      console.info('[Storage] Get records skipped — service in pending state')
      return []
    }
    console.error('[Storage] Get records error:', err)
    return []
  }
}

export async function deleteUserFileRecord(userId: string, fileId: string) {
  if (!isSupabaseConfigured()) return false

  try {
    const supabase = createClient()
    const { error } = await supabase
      .from('user_files')
      .delete()
      .eq('id', fileId)
      .eq('user_id', userId)

    if (error) {
      if (isPendingStateError(error)) {
        console.info('[Storage] Delete record skipped — service in pending state')
        return false
      }
      console.error('[Storage] Delete record error:', error.message)
      throw new Error(error.message)
    }

    return true
  } catch (err) {
    if (isPendingStateError(err)) {
      console.info('[Storage] Delete record skipped — service in pending state')
      return false
    }
    throw err
  }
}
