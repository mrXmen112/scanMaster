/**
 * Replaces each tool screen's in-header lucide glyph with the shared
 * <ToolIcon> tile, so the whole app speaks one icon language.
 *
 * Only the icon that sits immediately before the screen's <h2> title is
 * touched; functional glyphs inside the screen body (back arrow, buttons,
 * status marks) are deliberately left alone.
 *
 * Run: node tools/apply-header-icons.js
 */
const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..')
const DIR = path.join(ROOT, 'src', 'components', 'scanmaster')

// tool screen file -> registry id
const MAP = {
  'ScanToPdf.tsx': 'scan-to-pdf',
  'TextToPdf.tsx': 'text-to-pdf',
  'ImageToPdf.tsx': 'image-to-pdf',
  'PdfEditor.tsx': 'pdf-editor',
  'CompressPdf.tsx': 'compress-pdf',
  'MergePdf.tsx': 'merge-pdf',
  'SplitPdf.tsx': 'split-pdf',
  'ZipExport.tsx': 'zip-export',
  'OcrTool.tsx': 'ocr',
  'Translate.tsx': 'translate',
  'SpeechToText.tsx': 'speech-to-text',
  'SmartCrop.tsx': 'smart-crop',
  'BackgroundCleaner.tsx': 'background-cleaner',
  'ScreenshotEditor.tsx': 'screenshot-editor',
  'PasswordProtect.tsx': 'password-protect',
  'PasswordRemove.tsx': 'password-remove',
  'ESignature.tsx': 'e-signature',
  'AiSummary.tsx': 'ai-summary',
  'HandwritingToText.tsx': 'handwriting-to-text',
  'BusinessCardScanner.tsx': 'business-card-scanner',
}

let changed = 0
let skipped = 0

for (const [file, toolId] of Object.entries(MAP)) {
  const full = path.join(DIR, file)
  if (!fs.existsSync(full)) {
    console.log(`  SKIP  ${file} (missing)`)
    skipped++
    continue
  }

  let src = fs.readFileSync(full, 'utf8')
  const original = src

  // 1. Ensure the import exists (after the last lucide import).
  if (!/from '\.\/ToolCards'/.test(src)) {
    const lucideImport = src.match(/^import \{[\s\S]*?\} from 'lucide-react'\n/m)
    if (lucideImport) {
      src = src.replace(
        lucideImport[0],
        `${lucideImport[0]}import { ToolIcon } from './ToolCards'\n`
      )
    } else {
      const firstImport = src.match(/^import .*\n/m)
      if (firstImport) {
        src = src.replace(firstImport[0], `${firstImport[0]}import { ToolIcon } from './ToolCards'\n`)
      }
    }
  }

  // 2. Swap the glyph sitting directly before the screen title.
  //    Matches <Icon className="..." /> immediately preceding <h2 ...>Title</h2>
  const titleMatch = src.match(/(\s*)<h2[^>]*>([\s\S]*?)<\/h2>/)
  if (!titleMatch) {
    console.log(`  SKIP  ${file} (no <h2> header found)`)
    skipped++
    continue
  }

  const titleStart = titleMatch.index + titleMatch[1].length
  const before = src.slice(Math.max(0, titleStart - 260), titleStart)
  const glyphMatch = before.match(/<([A-Z][A-Za-z0-9]*)\s+className="[^"]*"\s*\/>\s*$/)

  if (glyphMatch) {
    const oldGlyph = glyphMatch[0]
    const newGlyph = `\n        <ToolIcon toolId="${toolId}" size="sm" />\n      `
    src = src.slice(0, titleStart - 260) + before.replace(oldGlyph, newGlyph) + src.slice(titleStart)
    fs.writeFileSync(full, src, 'utf8')
    console.log(`  OK    ${file} -> ${toolId}`)
    changed++
  } else {
    console.log(`  SKIP  ${file} (no glyph before title)`)
    skipped++
  }

  if (src === original) skipped++
}

console.log(`\n${changed} headers updated, ${skipped} skipped.`)
