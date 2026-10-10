import { createClient } from '@insforge/sdk'

const insforgeUrl = process.env.NEXT_PUBLIC_INSFORGE_URL || 'https://rtut9pdy.ap-southeast.insforge.app'
const insforgeAnonKey = process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY || ''

// Singleton client instance — reused across the app
let _client: ReturnType<typeof createClient> | null = null

export function getInsforgeClient() {
  if (!_client) {
    _client = createClient({
      baseUrl: insforgeUrl,
      anonKey: insforgeAnonKey || undefined,
    })
  }
  return _client
}

export function isInsforgeConfigured(): boolean {
  return !!insforgeUrl
}
