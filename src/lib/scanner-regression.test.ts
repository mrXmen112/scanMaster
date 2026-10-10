import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

import {
  coverContentRect,
  fitGuideInContent,
  rectToSourcePixels,
  fitInsideBox,
} from './camera-geometry.ts'
import {
  computeIdCardLayout,
  countPdfPages,
  idCardFileName,
  ID_CARD_PAGE_SIZES,
  CARD_ASPECT,
} from './id-card-pdf.ts'

const near = (a: number, b: number, eps = 1e-6) =>
  assert.ok(Math.abs(a - b) < eps, `expected ${a} ≈ ${b}`)

describe('coverContentRect (object-fit: cover geometry)', () => {
  test('tall container: landscape source overflows horizontally', () => {
    // 4:3 source inside a 400x800 portrait container.
    // scale = max(400/400, 800/300) = 2.6667 -> 1066.67 x 800
    const rect = coverContentRect(
      { width: 400, height: 300 },
      { width: 400, height: 800 }
    )
    near(rect.height, 800, 1e-9)
    near(rect.width, (400 * 800) / 300, 1e-9)
    near(rect.x, (400 - rect.width) / 2, 1e-9)
    near(rect.y, 0)
    assert.ok(rect.width > 400, 'overflows the narrow axis, not the tall one')
  })

  test('landscape source in a square container overflows horizontally', () => {
    const rect = coverContentRect(
      { width: 1920, height: 1080 },
      { width: 400, height: 400 }
    )
    near(rect.height, 400)
    near(rect.width, (400 * 1920) / 1080)
    near(rect.x, (400 - rect.width) / 2)
    near(rect.y, 0)
  })

  test('degenerate inputs never produce NaN', () => {
    const rect = coverContentRect(
      { width: 0, height: 0 },
      { width: 400, height: 800 }
    )
    assert.ok(Number.isFinite(rect.x) && Number.isFinite(rect.width))
  })
})

describe('fitGuideInContent', () => {
  const content = coverContentRect(
    { width: 1920, height: 1080 },
    { width: 390, height: 844 }
  )

  test('guide stays fully inside the visible video area', () => {
    const guide = fitGuideInContent(content, 1 / 1.414, 0.08)
    assert.ok(guide.x >= content.x - 1e-9, 'left edge inside')
    assert.ok(guide.y >= content.y - 1e-9, 'top edge inside')
    assert.ok(
      guide.x + guide.width <= content.x + content.width + 1e-9,
      'right edge inside'
    )
    assert.ok(
      guide.y + guide.height <= content.y + content.height + 1e-9,
      'bottom edge inside'
    )
  })

  test('guide keeps the requested aspect ratio', () => {
    const guide = fitGuideInContent(content, 1 / 1.414, 0.08)
    near(guide.width / guide.height, 1 / 1.414, 1e-6)
  })

  test('landscape ID card guide is wider than tall and still fits', () => {
    const guide = fitGuideInContent(content, CARD_ASPECT, 0.1)
    assert.ok(guide.width > guide.height, 'ID card guide is landscape')
    assert.ok(guide.x >= content.x - 1e-9)
    assert.ok(guide.x + guide.width <= content.x + content.width + 1e-9)
  })

  test('all four corners remain inside on a compact viewport', () => {
    for (const vp of [
      { width: 360, height: 640 },
      { width: 390, height: 844 },
      { width: 412, height: 915 },
      { width: 360, height: 800 },
    ]) {
      const box = coverContentRect(
        { width: 1920, height: 1080 },
        vp
      )
      const guide = fitGuideInContent(box, 1 / 1.414, 0.08)
      for (const [px, py] of [
        [guide.x, guide.y],
        [guide.x + guide.width, guide.y],
        [guide.x, guide.y + guide.height],
        [guide.x + guide.width, guide.y + guide.height],
      ]) {
        assert.ok(px >= box.x - 1e-6 && px <= box.x + box.width + 1e-6, `x ${px} in box`)
        assert.ok(py >= box.y - 1e-6 && py <= box.y + box.height + 1e-6, `y ${py} in box`)
      }
    }
  })
})

describe('rectToSourcePixels (guide -> captured frame crop)', () => {
  test('maps the guide into real source pixels, not container pixels', () => {
    const container = { width: 390, height: 844 }
    const source = { width: 1920, height: 1080 }
    const content = coverContentRect(source, container)
    const guide = fitGuideInContent(content, 1 / 1.414, 0.08)

    const crop = rectToSourcePixels(guide, content, source)

    // Crop must be inside the real frame.
    assert.ok(crop.x >= 0)
    assert.ok(crop.y >= 0)
    assert.ok(crop.x + crop.width <= source.width)
    assert.ok(crop.y + crop.height <= source.height)
    assert.ok(crop.width >= 1 && crop.height >= 1)

    // A naive container-percentage crop would have used the whole 1920x1080
    // frame; the real crop must be strictly smaller than the full frame.
    assert.ok(crop.width < source.width, 'crop is narrower than full frame')
    assert.ok(crop.height < source.height, 'crop is shorter than full frame')
  })

  test('crop preserves the guide aspect ratio', () => {
    const container = { width: 412, height: 915 }
    const source = { width: 1080, height: 1920 }
    const content = coverContentRect(source, container)
    const guide = fitGuideInContent(content, 1 / 1.414, 0.08)
    const crop = rectToSourcePixels(guide, content, source)

    const got = crop.width / crop.height
    const want = 1 / 1.414
    assert.ok(Math.abs(got - want) / want < 0.02, `aspect drift ${got} vs ${want}`)
  })

  test('whole-frame guide reproduces the entire source frame', () => {
    const container = { width: 390, height: 844 }
    const source = { width: 1000, height: 1000 }
    const content = coverContentRect(source, container)
    const crop = rectToSourcePixels(
      { x: content.x, y: content.y, width: content.width, height: content.height },
      content,
      source
    )
    assert.equal(crop.x, 0)
    assert.equal(crop.y, 0)
    assert.equal(crop.width, 1000)
    assert.equal(crop.height, 1000)
  })

  test('never returns a zero-area crop', () => {
    const crop = rectToSourcePixels(
      { x: 100, y: 100, width: 0.0001, height: 0.0001 },
      { x: 0, y: 0, width: 400, height: 800 },
      { width: 1920, height: 1080 }
    )
    assert.ok(crop.width >= 1)
    assert.ok(crop.height >= 1)
  })
})

describe('fitInsideBox', () => {
  test('centres and preserves aspect', () => {
    const box = { x: 0, y: 0, width: 200, height: 100 }
    const r = fitInsideBox({ width: 1000, height: 500 }, box)
    near(r.height, 100)
    near(r.width, 200)
    near(r.x, 0)
    near(r.y, 0)
  })

  test('tall image is height-limited, centred, and never overflows the box', () => {
    const box = { x: 10, y: 20, width: 200, height: 100 }
    const r = fitInsideBox({ width: 500, height: 1000 }, box)
    // scale = min(200/500, 100/1000) = 0.1  ->  50 x 100
    near(r.height, 100)
    near(r.width, 50)
    near(r.x, 10 + (200 - 50) / 2)
    near(r.y, 20)
    near(r.width / r.height, 0.5, 1e-9)
    assert.ok(r.width <= box.width && r.height <= box.height)
  })
})

describe('computeIdCardLayout - single page, two cards, no distortion', () => {
  const page = ID_CARD_PAGE_SIZES.a4
  const base = {
    pageWidth: page.width,
    pageHeight: page.height,
    margin: 40,
    gutter: 28,
  }

  test('front is on the left, back is on the right', () => {
    const layout = computeIdCardLayout({
      ...base,
      frontSize: { width: 856, height: 540 },
      backSize: { width: 856, height: 540 },
    })
    assert.ok(layout.front.x < layout.back.x, 'front left of back')
    assert.ok(
      layout.front.x + layout.front.width <= layout.back.x,
      'cards do not overlap'
    )
  })

  test('both cards stay inside the page margins', () => {
    const layout = computeIdCardLayout({
      ...base,
      frontSize: { width: 856, height: 540 },
      backSize: { width: 640, height: 400 },
    })
    for (const r of [layout.front, layout.back]) {
      assert.ok(r.x >= base.margin - 1e-9, 'left margin respected')
      assert.ok(r.y >= base.margin - 1e-9, 'top margin respected')
      assert.ok(r.x + r.width <= base.pageWidth - base.margin + 1e-9, 'right margin')
      assert.ok(r.y + r.height <= base.pageHeight - base.margin + 1e-9, 'bottom margin')
    }
  })

  test('each card keeps its own aspect ratio even when sides differ', () => {
    const layout = computeIdCardLayout({
      ...base,
      frontSize: { width: 1600, height: 900 }, // 16:9
      backSize: { width: 540, height: 960 }, // 9:16 portrait
    })
    near(layout.front.width / layout.front.height, 1600 / 900, 1e-9)
    near(layout.back.width / layout.back.height, 540 / 960, 1e-9)
  })

  test('matching cards get identical scale and centred baselines', () => {
    const layout = computeIdCardLayout({
      ...base,
      frontSize: { width: 856, height: 540 },
      backSize: { width: 856, height: 540 },
    })
    near(layout.front.width, layout.back.width, 1e-9)
    near(layout.front.height, layout.back.height, 1e-9)
    near(layout.front.y, layout.back.y, 1e-9)
    // Vertically centred on the page.
    near(layout.front.y, (base.pageHeight - layout.front.height) / 2, 1e-9)
  })

  test('works on Letter as well as A4', () => {
    const letter = ID_CARD_PAGE_SIZES.letter
    const layout = computeIdCardLayout({
      pageWidth: letter.width,
      pageHeight: letter.height,
      margin: 40,
      gutter: 28,
      frontSize: { width: 856, height: 540 },
      backSize: { width: 856, height: 540 },
    })
    assert.ok(layout.front.x + layout.front.width <= letter.width - 40 + 1e-9)
    assert.ok(layout.back.x + layout.back.width <= letter.width - 40 + 1e-9)
  })
})

describe('countPdfPages', () => {
  test('counts pages and does not count the /Pages tree node', () => {
    const fake = new TextEncoder().encode(
      '1 0 obj<</Type /Catalog/Pages 2 0 R>>endobj ' +
        '2 0 obj<</Type /Pages/Kids[3 0 R]/Count 1>>endobj ' +
        '3 0 obj<</Type /Page/Parent 2 0 R>>endobj'
    )
    assert.equal(countPdfPages(fake), 1)
  })

  test('detects a two-page file so the one-page check can reject it', () => {
    const fake = new TextEncoder().encode(
      '2 0 obj<</Type /Pages/Count 2>>endobj ' +
        '3 0 obj<</Type /Page>>endobj ' +
        '4 0 obj<</Type /Page>>endobj'
    )
    assert.equal(countPdfPages(fake), 2)
  })
})

describe('idCardFileName', () => {
  test('carries no card content and ends in .pdf', () => {
    const name = idCardFileName(new Date(2026, 4, 5, 9, 7).getTime())
    assert.ok(name.endsWith('.pdf'))
    assert.ok(name.startsWith('ID_Card_Scan_'))
    assert.ok(/^ID_Card_Scan_[\d-]+_\d{4}\.pdf$/.test(name), `unexpected: ${name}`)
  })
})

describe('single-page PDF guarantee (real jsPDF output)', () => {
  // 1x1 white PNG - the smallest valid image jsPDF can embed.
  const PNG_1PX =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

  async function buildTwoUpPdf(): Promise<Uint8Array> {
    const { jsPDF } = await import('jspdf')
    const page = ID_CARD_PAGE_SIZES.a4
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4', compress: false })

    const layout = computeIdCardLayout({
      frontSize: { width: 856, height: 540 },
      backSize: { width: 856, height: 540 },
      pageWidth: page.width,
      pageHeight: page.height,
      margin: 40,
      gutter: 28,
    })

    pdf.addImage(PNG_1PX, 'PNG', layout.front.x, layout.front.y, layout.front.width, layout.front.height)
    pdf.addImage(PNG_1PX, 'PNG', layout.back.x, layout.back.y, layout.back.width, layout.back.height)
    pdf.setProperties({ title: 'ID Card Scan', creator: 'ScanMaster' })

    return new Uint8Array(await pdf.output('arraybuffer') as ArrayBuffer)
  }

  test('two card images land on EXACTLY ONE page, never two', async () => {
    const bytes = await buildTwoUpPdf()
    assert.equal(countPdfPages(bytes), 1)
  })

  test('page is landscape (wider than tall) and holds both XO objects', async () => {
    const bytes = await buildTwoUpPdf()
    const text = new TextDecoder('latin1').decode(bytes)

    // A landscape A4 page is wider than tall.
    const mb = text.match(/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)/)
    assert.ok(mb, 'MediaBox present')
    const w = Number(mb![1])
    const h = Number(mb![2])
    assert.ok(w > h, `expected landscape, got ${w}x${h}`)

    // Both cards must be drawn on that single page.
    const xobjects = (text.match(/\/Subtype\s*\/Image/g) || []).length
    assert.ok(xobjects >= 2, `expected 2 embedded images, found ${xobjects}`)
  })
})