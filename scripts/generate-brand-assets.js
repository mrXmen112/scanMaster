/**
 * Generates Android launcher icons, adaptive icons and splash screens from the
 * single 1024x1024 master artwork in assets/.
 *
 * Run: node scripts/generate-brand-assets.js
 */
const sharp = require('sharp')
const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..')
const MASTER = path.join(ROOT, 'assets', 'scanmaster_icon_1024.png')
const RES = path.join(ROOT, 'android', 'app', 'src', 'main', 'res')
const PUBLIC = path.join(ROOT, 'public')

// Brand colours sampled from the master artwork / splash spec.
const BRAND_BLUE = '#1D4ED8'   // adaptive background, matches icon gradient
const SPLASH_BG = '#0B1B3F'    // splash background requested by the design

const DENSITIES = [
  ['ldpi', 36],
  ['mdpi', 48],
  ['hdpi', 72],
  ['xhdpi', 96],
  ['xxhdpi', 144],
  ['xxxhdpi', 192],
]

// Adaptive layers are 108dp; the outer 18dp on each side may be masked away.
const ADAPTIVE = [
  ['mdpi', 108],
  ['hdpi', 162],
  ['xhdpi', 216],
  ['xxhdpi', 324],
  ['xxxhdpi', 432],
]

async function main() {
  if (!fs.existsSync(MASTER)) {
    console.error('Missing master artwork: assets/scanmaster_icon_1024.png')
    process.exit(1)
  }
  const src = MASTER

  // ── 1. Legacy launcher icons ───────────────────────────────────────────────
  for (const [density, size] of DENSITIES) {
    const dir = path.join(RES, `mipmap-${density}`)
    fs.mkdirSync(dir, { recursive: true })

    await sharp(src)
      .resize(size, size, { fit: 'cover' })
      .png()
      .toFile(path.join(dir, 'ic_launcher.png'))

    // Round variant: circular mask so legacy round launchers look right.
    const round = Buffer.from(
      `<svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="#fff"/></svg>`
    )
    await sharp(src)
      .resize(size, size, { fit: 'cover' })
      .composite([{ input: round, blend: 'dest-in' }])
      .png()
      .toFile(path.join(dir, 'ic_launcher_round.png'))

    console.log(`  mipmap-${density}: ic_launcher${size}x${size} + round`)
  }

  // ── 2. Adaptive icon layers ────────────────────────────────────────────────
  for (const [density, size] of ADAPTIVE) {
    const dir = path.join(RES, `mipmap-${density}`)
    fs.mkdirSync(dir, { recursive: true })

    // Background: solid brand blue so any mask shape is seamless.
    await sharp({
      create: { width: size, height: size, channels: 4, background: BRAND_BLUE },
    })
      .png()
      .toFile(path.join(dir, 'ic_launcher_background.png'))

    // Foreground: the full mark, inset to ~72% so it survives circle/squircle
    // masks and parallax cropping without the document being clipped.
    const fg = Math.round(size * 0.72)
    const pad = Math.round((size - fg) / 2)
    await sharp(src)
      .resize(fg, fg, { fit: 'cover' })
      .extend({
        top: pad,
        bottom: pad,
        left: pad,
        right: pad,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toFile(path.join(dir, 'ic_launcher_foreground.png'))

    console.log(`  mipmap-${density}: adaptive layers ${size}x${size}`)
  }

  // ── 3. Adaptive icon XML ───────────────────────────────────────────────────
  const anydpi = path.join(RES, 'mipmap-anydpi-v26')
  fs.mkdirSync(anydpi, { recursive: true })
  const adaptiveXml = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@mipmap/ic_launcher_background" />
    <foreground android:drawable="@mipmap/ic_launcher_foreground" />
    <monochrome android:drawable="@mipmap/ic_launcher_foreground" />
</adaptive-icon>
`
  fs.writeFileSync(path.join(anydpi, 'ic_launcher.xml'), adaptiveXml)
  fs.writeFileSync(path.join(anydpi, 'ic_launcher_round.xml'), adaptiveXml)
  console.log('  mipmap-anydpi-v26: ic_launcher.xml + ic_launcher_round.xml')

  // Play Store listing icon (must be exactly 512x512, no transparency).
  await sharp(src)
    .resize(512, 512, { fit: 'cover' })
    .flatten({ background: SPLASH_BG })
    .png()
    .toFile(path.join(PUBLIC, 'icon-512.png'))

  // PWA icons.
  for (const size of [192, 512]) {
    await sharp(src)
      .resize(size, size, { fit: 'cover' })
      .png()
      .toFile(path.join(PUBLIC, `icon-${size}.png`))
  }
  await sharp(src).resize(512, 512, { fit: 'cover' })
    .png().toFile(path.join(PUBLIC, 'logo-512.png'))
  await sharp(src).resize(512, 512, { fit: 'cover' })
    .png().toFile(path.join(PUBLIC, 'logo.png'))
  console.log('  public/: icon-192, icon-512, logo, logo-512')

  // ── 4. Native splash screens ───────────────────────────────────────────────
  // Portrait and landscape variants per density, brand background + centred mark.
  const SPLASH = [
    ['port-ldpi', 240, 320], ['port-mdpi', 320, 480], ['port-hdpi', 480, 800],
    ['port-xhdpi', 720, 1280], ['port-xxhdpi', 960, 1600], ['port-xxxhdpi', 1280, 1920],
    ['land-ldpi', 320, 240], ['land-mdpi', 480, 320], ['land-hdpi', 800, 480],
    ['land-xhdpi', 1280, 720], ['land-xxhdpi', 1600, 960], ['land-xxxhdpi', 1920, 1280],
  ]

  for (const [name, w, h] of SPLASH) {
    const dir = path.join(RES, name)
    fs.mkdirSync(dir, { recursive: true })
    const mark = Math.round(Math.min(w, h) * 0.28)
    await sharp({
      create: { width: w, height: h, channels: 4, background: SPLASH_BG },
    })
      .composite([
        {
          input: await sharp(src).resize(mark, mark, { fit: 'cover' }).toBuffer(),
          left: Math.round((w - mark) / 2),
          top: Math.round((h - mark) / 2),
        },
      ])
      .png()
      .toFile(path.join(dir, 'splash.png'))

    // Night variants inherit the same brand treatment (the app theme is dark-first).
    const nightDir = path.join(RES, `${name}-night`)
    fs.mkdirSync(nightDir, { recursive: true })
    fs.copyFileSync(path.join(dir, 'splash.png'), path.join(nightDir, 'splash.png'))
  }
  console.log('  splash.png generated for all portrait/landscape densities')

  // Standalone 1080x1920 splash the spec asks for.
  const mark1080 = Math.round(1080 * 0.28)
  await sharp({
    create: { width: 1080, height: 1920, channels: 4, background: SPLASH_BG },
  })
    .composite([
      {
        input: await sharp(src).resize(mark1080, mark1080, { fit: 'cover' }).toBuffer(),
        left: Math.round((1080 - mark1080) / 2),
        top: Math.round((1920 - mark1080) / 2),
      },
    ])
    .png()
    .toFile(path.join(ROOT, 'assets', 'splash_static_1080x1920.png'))

  // Small in-app splash icon used by the animated splash screen.
  await sharp(src).resize(512, 512, { fit: 'cover' })
    .png().toFile(path.join(PUBLIC, 'splash-icon.png'))
  console.log('  assets/splash_static_1080x1920.png + public/splash-icon.png')

  console.log('\nDone.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
