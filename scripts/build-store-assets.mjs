/**
 * Generates the Play Store listing assets from public/logo.svg.
 *
 *   node scripts/build-store-assets.mjs
 *
 * Outputs into store/:
 *   play-icon-512.png        512x512   required size, MUST be opaque
 *   play-icon-1024.png       1024x1024 master copy
 *   feature-graphic.png      1024x500  required size, MUST be opaque
 *   privacy-policy.html      standalone page for hosting
 *
 * Why flatten onto an opaque background instead of exporting the SVG
 * directly: Google Play rejects a 32-bit icon that carries an alpha channel.
 * The source artwork is a rounded square on transparency, so anything rendered
 * from it keeps that alpha. Flattening composites the rounded corners onto the
 * dark brand navy (#06102A) which is also what the launcher icon uses, so the
 * store listing and the installed app read as the same mark.
 */
import sharp from 'sharp'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const out = join(root, 'store')
const NAVY = '#06102A'

await mkdir(out, { recursive: true })

const logoSvg = await readFile(join(root, 'public', 'logo.svg'))

// ── Play icon ────────────────────────────────────────────────────────────────
// The logo is drawn on a 512 viewBox with the rounded square inset by 16, so
// rendering at 512 gives the full bleed Play expects. Sized up to 1024 for the
// master, then flattened either way.
async function renderIcon(size, { flatten = true } = {}) {
  let img = sharp(logoSvg, { density: 384 }).resize(size, size, { fit: 'fill' })
  if (flatten) img = img.flatten({ background: NAVY }) // kill the alpha channel
  return img.png({ compressionLevel: 9 }).toBuffer()
}

for (const size of [512, 1024]) {
  const buf = await renderIcon(size)
  const file = join(out, `play-icon-${size}.png`)
  await writeFile(file, buf)
  const m = await sharp(buf).metadata()
  console.log(
    `  play-icon-${size}.png  ${m.width}x${m.height}  ` +
      `channels=${m.channels}  alpha=${m.hasAlpha ? 'YES (bad)' : 'no (good)'}`
  )
}

// ── Feature graphic 1024x500 ────────────────────────────────────────────────
// Play renders this as the banner at the top of the listing. It must be the
// exact 2.05:1 ratio or it gets letterboxed, and the logo must survive being
// scaled down on a phone, so it sits left with the wordmark beside it.
const FG_W = 1024
const FG_H = 500
const MARK = 300

// The mark keeps its alpha here on purpose: compositing it over the gradient
// lets the rounded corners dissolve into the background. Flattening it first
// would leave a visible navy square sitting on the banner, which reads as a
// pasted-in image rather than part of the layout. The final canvas is still
// fully opaque because the gradient beneath covers every pixel.
const markPng = await renderIcon(MARK, { flatten: false })

const gradientSvg = Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="${FG_W}" height="${FG_H}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%"   stop-color="#0B1B3F"/>
      <stop offset="55%"  stop-color="#081634"/>
      <stop offset="100%" stop-color="#06102A"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="50%" r="50%">
      <stop offset="0%"   stop-color="#00D4FF" stop-opacity="0.30"/>
      <stop offset="100%" stop-color="#00D4FF" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%"   stop-color="#00D4FF"/>
      <stop offset="100%" stop-color="#0A84FF"/>
    </linearGradient>
  </defs>

  <rect width="${FG_W}" height="${FG_H}" fill="url(#bg)"/>
  <ellipse cx="${MARK / 2 + 60}" cy="${FG_H / 2}" rx="330" ry="250" fill="url(#glow)"/>

  <!-- thin accent rule under the wordmark -->
  <rect x="${MARK + 120}" y="${FG_H / 2 + 54}" width="360" height="6" rx="3" fill="url(#accent)"/>

  <text x="${MARK + 120}" y="${FG_H / 2 - 6}"
        font-family="Roboto, 'Helvetica Neue', Arial, sans-serif"
        font-size="104" font-weight="700" fill="#FFFFFF" letter-spacing="-1">ScanMaster</text>

  <text x="${MARK + 124}" y="${FG_H / 2 + 96}"
        font-family="Roboto, 'Helvetica Neue', Arial, sans-serif"
        font-size="38" font-weight="400" fill="#8FB3D9" letter-spacing="0.5">Scan &#183; Edit &#183; Sign &#183; Convert</text>
</svg>`)

// composite() and flatten() in a single sharp() chain do not compose in the
// order you write them - the alpha survives. So the layers are composited
// first, then flattened in a second pass over the rendered buffer.
const composed = await sharp(gradientSvg)
  .composite([{ input: markPng, left: 60, top: Math.round((FG_H - MARK) / 2) }])
  .png()
  .toBuffer()

const fg = await sharp(composed)
  .flatten({ background: NAVY })
  .png({ compressionLevel: 9 })
  .toBuffer()

await writeFile(join(out, 'feature-graphic.png'), fg)
const fgm = await sharp(fg).metadata()
console.log(
  `  feature-graphic.png  ${fgm.width}x${fgm.height}  ` +
    `channels=${fgm.channels}  alpha=${fgm.hasAlpha ? 'YES (bad)' : 'no (good)'}`
)

console.log('\n  store/ ready')