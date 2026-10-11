# Play Store release checklist — ScanMaster

Generated assets live in `store/`. Rebuild them with:

```bash
npm run store:assets
```

## What is ready

| Requirement | Spec | File | Status |
|---|---|---|---|
| App icon | 512×512 PNG, 32-bit, **no alpha** | `store/play-icon-512.png` | ✅ |
| App icon (master) | 1024×1024 PNG, no alpha | `store/play-icon-1024.png` | ✅ |
| Feature graphic | 1024×500 PNG/JPG, no alpha | `store/feature-graphic.png` | ✅ |
| Privacy policy page | standalone, self-contained | `store/privacy-policy.html` | ✅ built, ⬜ **needs a public URL** |

The icon is flattened onto `#06102A` on purpose. Google Play rejects a 32-bit
icon that still carries an alpha channel, and the source artwork is a rounded
square on transparency — so anything rendered straight from it would fail
validation. The feature graphic keeps the mark's transparency instead, so its
rounded corners dissolve into the gradient rather than sitting on a visible
navy square.

## Blocking before you can submit

- [ ] **Privacy policy URL.** Upload `store/privacy-policy.html` somewhere
      public and put the URL in Play Console. The copy inside the app is *not*
      sufficient — Google requires a URL they can fetch.
      Netlify Drop, GitHub Pages or Cloudflare Pages all work and are free.
      Keep `store/play-icon-512.png` next to the HTML, since the page references
      it.
- [ ] **Apply `supabase/migrations/005_lock_down_profiles.sql`.**
      Currently `public.profiles` returns 6 rows to an anonymous request, and
      the publishable key ships inside the APK. Run the migration in
      Supabase → SQL Editor. Without it, any user who unzips the app can read
      every account's id, name and avatar.
- [ ] **Rotate any credential pasted into a chat or commit.** A Supabase
      Management API token (`sbp_…`) was shared in conversation. That token can
      manage every project on the account. Revoke and recreate it under
      Account → Access Tokens.
- [ ] **Contact address.** `privacy@scanmaster.app` is a placeholder. Swap in a
      mailbox you actually read — Google verifies it and users contact you there.

## Build

```bash
npm run release          # static export + signed APK + AAB
```

Outputs:

- `android/app/build/outputs/apk/release/app-release.apk`
- `android/app/build/outputs/bundle/release/app-release.aab`

Upload the **AAB** to Play Console. The APK is for sideload testing.

## Still to confirm in Play Console

These are console-side answers, not code. Fill them from what the app really does:

**Data safety** — declare:

- Account email → *collected*, *not shared*, purpose: app functionality
- Name → collected, not shared, app functionality
- Photos/files → **not collected** (processed on device)
- App activity / crash logs → may be collected for diagnostics
- Advertising ID → collected by Google AdMob, not shared with us

**Content rating** — questionnaire only.

**Ads** — yes, contains ads.

**Target audience** — pick the age band; note it is not directed at children.

**Data deletion** — if you ship an in-app delete-account path (you do, under
Profile → Delete Account), you can declare deletion as available in-app and skip
the web request form.

**Target API level** — Google requires the target SDK to meet the current
Play requirement. Check `android/app/build.gradle` and bump
`targetSdkVersion` if it is behind, then rebuild; a stale target API is the most
common cause of a rejected new submission.

## Store listing copy

- **Title:** ScanMaster: PDF & Document Tools
- **Short description (80 char max):** Scan, convert and edit PDFs and images — fast and private.
- **Category:** Productivity
- **Content:** Everyone