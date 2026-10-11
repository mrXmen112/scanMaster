/**
 * Developer-only tooling.
 *
 * Some screens in this app exist purely to help whoever is building the app:
 * running migrations, creating storage buckets, checking table health. They
 * depend on Next.js API routes, and they have no business being visible to
 * somebody who installed the app from the Play Store.
 *
 * The Android build is a *static export* (`output: 'export'`), so those API
 * routes do not exist in the bundle at all — meaning on device these calls
 * can only ever 404. Gating on this flag keeps them out of release builds
 * entirely instead of shipping a button that cannot work.
 *
 * To get the Database Setup screen back while developing, set:
 *   NEXT_PUBLIC_ENABLE_DEV_TOOLS=true
 */
export const DEV_TOOLS_ENABLED =
  process.env.NODE_ENV !== 'production' ||
  process.env.NEXT_PUBLIC_ENABLE_DEV_TOOLS === 'true'