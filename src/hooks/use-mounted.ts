'use client'

import { useSyncExternalStore } from 'react'

/**
 * Returns true only after the component has mounted on the client.
 * Uses useSyncExternalStore (React 19 recommended pattern) to avoid
 * SSR/client hydration mismatches and lint warnings.
 */
export function useMounted(): boolean {
  return useSyncExternalStore(
    // subscribe: no-op since "mounted" never changes back
    () => () => {},
    // getSnapshot (client): always true after first render
    () => true,
    // getServerSnapshot: always false on the server
    () => false
  )
}
