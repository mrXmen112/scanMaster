/**
 * Generates the ScanMaster tool icon pack.
 *
 * Spec (per tool):
 *   128x128 viewBox
 *   rounded square tile  x=4 y=4 w=120 h=120 rx=32
 *   diagonal gradient, ONE distinct colour per tool
 *   white glyph, stroke-width 8, round caps + joins
 *   subtle white 10% highlight across the top half of the tile
 *
 * Output:
 *   tools/<id>.svg       source artwork
 *   tools/<id>.png       192px raster (for raster-only consumers)
 *   public/tool-icons/   runtime copy the web build actually serves
 *
 * Run: node tools/generate.js
 */
const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..')
const OUT = __dirname
const PUBLIC = path.join(ROOT, 'public', 'tool-icons')

/**
 * 20 visually distinct brand colours. Ordering matters: neighbouring entries
 * in the list sit next to each other in the UI, so adjacent colours are always
 * far apart in hue.
 */
const TOOLS = [
  { id: 'scan-to-pdf',          color: '#2563EB', label: 'Scan to PDF' },
  { id: 'text-to-pdf',          color: '#7C3AED', label: 'Text to PDF' },
  { id: 'image-to-pdf',         color: '#0891B2', label: 'Image to PDF' },
  { id: 'pdf-editor',           color: '#DB2777', label: 'PDF Editor' },
  { id: 'compress-pdf',         color: '#EA580C', label: 'Compress PDF' },
  { id: 'merge-pdf',            color: '#059669', label: 'Merge PDF' },
  { id: 'split-pdf',            color: '#DC2626', label: 'Split PDF' },
  { id: 'zip-export',           color: '#CA8A04', label: 'ZIP Export' },
  { id: 'ocr',                  color: '#4F46E5', label: 'OCR to Text' },
  { id: 'translate',            color: '#0D9488', label: 'Translate' },
  { id: 'speech-to-text',       color: '#9333EA', label: 'Speech to Text' },
  { id: 'smart-crop',           color: '#65A30D', label: 'Smart Crop' },
  { id: 'background-cleaner',   color: '#0EA5E9', label: 'Background Cleaner' },
  { id: 'screenshot-editor',    color: '#E11D48', label: 'Screenshot Editor' },
  { id: 'password-protect',     color: '#1D4ED8', label: 'Password Protect' },
  { id: 'password-remove',      color: '#7E22CE', label: 'Remove Password' },
  { id: 'e-signature',          color: '#C026D3', label: 'E-Signature' },
  { id: 'ai-summary',           color: '#0284C7', label: 'AI Summary' },
  { id: 'handwriting-to-text',  color: '#B45309', label: 'Handwriting to Text' },
  { id: 'business-card-scanner',color: '#15803D', label: 'Business Card Scanner' },
]

/**
 * White glyphs. All coordinates are inside the 128 viewBox and centred on
 * (64,64). stroke/fill/stroke-width are supplied by the wrapper so every glyph
 * shares identical geometry and stroke weight.
 */
const GLYPHS = {
  // document with a scan beam crossing it
  'scan-to-pdf': `
    <path d="M48 30h18l12 12v30a6 6 0 0 1-6 6H48a6 6 0 0 1-6-6V36a6 6 0 0 1 6-6z"/>
    <path d="M66 30v12h12"/>
    <path d="M30 62h68"/>
    <path d="M40 48h8M80 48h8"/>`,

  // document with text lines
  'text-to-pdf': `
    <path d="M48 28h18l12 12v32a6 6 0 0 1-6 6H48a6 6 0 0 1-6-6V34a6 6 0 0 1 6-6z"/>
    <path d="M66 28v12h12"/>
    <path d="M54 56h20M54 70h20"/>`,

  // picture frame with mountain + sun
  'image-to-pdf': `
    <rect x="30" y="36" width="68" height="56" rx="6"/>
    <circle cx="48" cy="54" r="6"/>
    <path d="M36 84l18-20 12 13 10-11 18 18"/>`,

  // pencil over a sheet
  'pdf-editor': `
    <path d="M36 92V40a6 6 0 0 1 6-6h44a6 6 0 0 1 6 6v20"/>
    <path d="M54 74l30-30a7 7 0 0 1 10 10L64 84l-14 4z"/>
    <path d="M80 48l10 10"/>`,

  // two arrows squeezing inward
  'compress-pdf': `
    <rect x="44" y="26" width="40" height="12" rx="5"/>
    <rect x="44" y="90" width="40" height="12" rx="5"/>
    <path d="M64 44v14M56 52l8 8 8-8"/>
    <path d="M64 84V70M56 76l8-8 8 8"/>`,

  // two sources folding into one arrow
  'merge-pdf': `
    <path d="M28 30v14a10 10 0 0 0 10 10h10"/>
    <path d="M100 30v14a10 10 0 0 1-10 10H80"/>
    <path d="M64 54v34"/>
    <path d="M54 78l10 10 10-10"/>`,

  // one arrow branching upward into two (inverse of merge)
  'split-pdf': `
    <path d="M64 96V62"/>
    <path d="M54 72l10-10 10 10"/>
    <path d="M64 62V52a10 10 0 0 0-10-10H36"/>
    <path d="M64 52a10 10 0 0 1 10-10h12"/>`,

  // archive box with lid
  'zip-export': `
    <rect x="28" y="52" width="72" height="44" rx="6"/>
    <path d="M28 70h72"/>
    <path d="M52 34h24v18H52z"/>
    <path d="M60 43h8"/>`,

  // text lines with a magnifier
  'ocr': `
    <path d="M32 40h30M32 56h22M32 72h16"/>
    <circle cx="78" cy="72" r="18"/>
    <path d="M90 84l14 14"/>`,

  // globe = language. Deliberately NOT an "A + bars" glyph: at tile size
  // that read as the letters "AI", which is the one thing this brand avoids.
  translate: `
    <circle cx="64" cy="64" r="32"/>
    <path d="M32 64h64"/>
    <path d="M64 32a22 22 0 0 1 0 64"/>
    <path d="M64 32a22 22 0 0 0 0 64"/>`,

  // waveform
  'speech-to-text': `
    <path d="M32 58v12M46 44v40M60 30v68M74 44v40M88 58v12"/>`,

  // crop marks with a slash
  'smart-crop': `
    <path d="M30 52V36a6 6 0 0 1 6-6h16"/>
    <path d="M98 52V36a6 6 0 0 0-6-6H76"/>
    <path d="M30 76v16a6 6 0 0 0 6 6h16"/>
    <path d="M98 76v16a6 6 0 0 1-6 6H76"/>
    <path d="M44 84l40-40"/>`,

  // sparkle + wand
  'background-cleaner': `
    <path d="M64 28l8 20 20 8-20 8-8 20-8-20-20-8 20-8z"/>
    <path d="M96 74l4 10 10 4-10 4-4 10-4-10-10-4 10-4z"/>`,

  // frame + cursor arrow
  'screenshot-editor': `
    <rect x="28" y="32" width="72" height="58" rx="6"/>
    <path d="M28 62l14-14 12 12 10-10 18 18"/>
    <path d="M78 66l8 22 4-10 10-4z"/>`,

  // closed padlock
  'password-protect': `
    <rect x="38" y="56" width="52" height="42" rx="8"/>
    <path d="M50 56V44a14 14 0 0 1 28 0v12"/>
    <path d="M64 72v12"/>
    <path d="M56 77h16"/>`,

  // open padlock
  'password-remove': `
    <rect x="38" y="56" width="52" height="42" rx="8"/>
    <path d="M50 56V44a14 14 0 0 1 26-6"/>
    <path d="M64 72v12"/>
    <path d="M56 77h16"/>`,

  // signature squiggle over a rule
  'e-signature': `
    <path d="M28 72c8 0 10-20 18-20s8 18 16 18 10-12 18-12 8 10 16 10"/>
    <path d="M28 94h72"/>`,

  // summary lines with a sparkle
  'ai-summary': `
    <path d="M32 42h40M32 60h28M32 78h40"/>
    <path d="M90 46l5 13 13 5-13 5-5 13-5-13-13-5 13-5z"/>`,

  // cursive stroke being written
  'handwriting-to-text': `
    <path d="M26 82c7 0 9-16 17-16s7 14 15 14 9-9 17-9"/>
    <path d="M26 100h46"/>
    <path d="M84 36l20 20"/>
    <path d="M90 30l10 10"/>`,

  // contact card with a person
  'business-card-scanner': `
    <rect x="26" y="44" width="76" height="48" rx="8"/>
    <circle cx="48" cy="64" r="10"/>
    <path d="M32 84c0-9 7-14 16-14s16 5 16 14"/>
    <path d="M76 58h20M76 74h14"/>`,
}

/** Darken a hex colour by `amount` (0..1) for the gradient's second stop. */
function darken(hex, amount = 0.28) {
  const n = parseInt(hex.slice(1), 16)
  const r = Math.round(((n >> 16) & 255) * (1 - amount))
  const g = Math.round(((n >> 8) & 255) * (1 - amount))
  const b = Math.round((n & 255) * (1 - amount))
  const to = (v) => v.toString(16).padStart(2, '0')
  return `#${to(r)}${to(g)}${to(b)}`
}

function buildSvg(color, glyph) {
  const c2 = darken(color)
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128" role="img">
  <defs>
    <linearGradient id="tile" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${color}"/>
      <stop offset="1" stop-color="${c2}"/>
    </linearGradient>
    <clipPath id="clip">
      <rect x="4" y="4" width="120" height="120" rx="32"/>
    </clipPath>
  </defs>
  <g clip-path="url(#clip)">
    <rect x="4" y="4" width="120" height="120" fill="url(#tile)"/>
    <rect x="4" y="4" width="120" height="56" fill="#ffffff" opacity="0.10"/>
  </g>
  <g fill="none" stroke="#ffffff" stroke-width="8" stroke-linecap="round" stroke-linejoin="round">
${glyph.trim()}
  </g>
</svg>
`
}

async function main() {
  fs.mkdirSync(PUBLIC, { recursive: true })
  const sharp = require('sharp')
  const entries = []

  for (const tool of TOOLS) {
    const glyph = GLYPHS[tool.id]
    if (!glyph) throw new Error(`Missing glyph for "${tool.id}"`)

    const svg = buildSvg(tool.color, glyph)
    fs.writeFileSync(path.join(OUT, `${tool.id}.svg`), svg)
    fs.copyFileSync(path.join(OUT, `${tool.id}.svg`), path.join(PUBLIC, `${tool.id}.svg`))

    await sharp(Buffer.from(svg))
      .resize(192, 192)
      .png()
      .toFile(path.join(OUT, `${tool.id}.png`))

    entries.push({ id: tool.id, label: tool.label, color: tool.color })
    console.log(`  ${tool.id.padEnd(24)} ${tool.color}`)
  }

  // Runtime map consumed by src/lib/tool-icons.ts (and tools/index.ts for
  // anyone working directly from the icon pack).
  const map = entries
    .map((e) => `  '${e.id}': { src: '/tool-icons/${e.id}.svg', label: '${e.label}' },`)
    .join('\n')
  const body =
    `// AUTO-GENERATED by tools/generate.js - do not edit by hand.\n\n` +
    `export interface ToolIconEntry {\n  src: string\n  label: string\n}\n\n` +
    `export const TOOL_ICONS: Record<string, ToolIconEntry> = {\n${map}\n}\n`

  fs.writeFileSync(path.join(OUT, 'index.ts'), body)
  // Mirror inside src/ so the app never imports across the project root.
  fs.writeFileSync(path.join(ROOT, 'src', 'lib', 'tool-icons.ts'), body)

  console.log(`\n${entries.length} tool icons generated (svg + 192px png + public copy).`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
