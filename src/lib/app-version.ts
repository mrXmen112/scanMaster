/**
 * Version shown in Profile -> About.
 *
 * Previously hardcoded to "1.0.0", which had already drifted from
 * android/app/build.gradle ("1.1.0") — the About panel lied to users and
 * there was no way to notice, because nothing tied it to the build.
 *
 * Capacitor's App.getInfo() reads versionName/versionCode straight out of the
 * native build, so the number shown now comes from the same place Play reads
 * it. On web (npm run dev) there is no native container, so it falls back to
 * a constant that mirrors build.gradle. Keep the two in step when bumping.
 */
export const appVersion = '1.1.0'