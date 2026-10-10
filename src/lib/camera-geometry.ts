/**
 * Camera preview geometry helpers.
 *
 * WHY THIS EXISTS
 * ---------------
 * The scanner renders the live preview with `object-fit: cover` inside a
 * full-screen container. "cover" means the video is scaled up and *cropped*
 * by the container, so a rectangle drawn as a percentage of the CONTAINER does
 * not correspond to any known region of the captured frame.
 *
 * The previous implementation drew its guide at hardcoded percentages
 * (top/bottom 12%, left/right 8%) of the container, which is why the guide was
 * geometrically meaningless and drifted on different device aspect ratios.
 *
 * These helpers compute the video's real displayed content rectangle inside the
 * container (the "content box" of object-fit: cover) and map a guide rectangle
 * expressed in container space back into source-image pixel space, so that what
 * the user frames is what actually gets cropped and saved.
 *
 * Pure functions only - no DOM, no browser APIs - so they are unit testable.
 */

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export interface Size {
  width: number
  height: number
}

/**
 * Compute the visible content rectangle of a source image displayed with
 * `object-fit: cover` inside a container of the given size.
 *
 * With "cover" the image keeps its aspect ratio and fills the container, so the
 * overflow is split evenly across the two opposing edges.
 */
export function coverContentRect(
  source: Size,
  container: Size
): Rect {
  if (source.width <= 0 || source.height <= 0) {
    return { x: 0, y: 0, width: container.width, height: container.height }
  }
  if (container.width <= 0 || container.height <= 0) {
    return { x: 0, y: 0, width: 0, height: 0 }
  }

  const scale = Math.max(
    container.width / source.width,
    container.height / source.height
  )

  const width = source.width * scale
  const height = source.height * scale

  return {
    x: (container.width - width) / 2,
    y: (container.height - height) / 2,
    width,
    height,
  }
}

/**
 * Fit a guide of the given aspect ratio inside the content rectangle, leaving
 * a proportional inset on every side. The guide is guaranteed to stay fully
 * inside the visible video area on any device size.
 *
 * @param content    visible video rectangle (container space, CSS pixels)
 * @param aspect     guide width / height (e.g. 1 / 1.414 for A4 portrait,
 *                   85.6 / 54 for an ID-1 card)
 * @param insetRatio fraction of the content size left as margin on each axis
 */
export function fitGuideInContent(
  content: Rect,
  aspect: number,
  insetRatio = 0.08
): Rect {
  if (content.width <= 0 || content.height <= 0 || aspect <= 0) {
    return { x: content.x, y: content.y, width: content.width, height: content.height }
  }

  const inset = Math.min(content.width, content.height) * insetRatio

  const availW = content.width - inset * 2
  const availH = content.height - inset * 2
  if (availW <= 0 || availH <= 0) {
    return { x: content.x, y: content.y, width: content.width, height: content.height }
  }

  let width = availW
  let height = width / aspect
  if (height > availH) {
    height = availH
    width = height * aspect
  }

  return {
    x: content.x + (content.width - width) / 2,
    y: content.y + (content.height - height) / 2,
    width,
    height,
  }
}

/**
 * Map a rectangle expressed in container/overlay space into source-image pixel
 * space. Used at capture time to crop the real frame to what the guide framed.
 *
 * The result is clamped to the source bounds and to whole pixels so it can be
 * used directly as `drawImage` source arguments.
 */
export function rectToSourcePixels(
  guide: Rect,
  content: Rect,
  source: Size
): Rect {
  if (content.width <= 0 || content.height <= 0) {
    return { x: 0, y: 0, width: source.width, height: source.height }
  }

  const scaleX = source.width / content.width
  const scaleY = source.height / content.height

  const rawX = (guide.x - content.x) * scaleX
  const rawY = (guide.y - content.y) * scaleY
  const rawW = guide.width * scaleX
  const rawH = guide.height * scaleY

  const x = clamp(rawX, 0, source.width)
  const y = clamp(rawY, 0, source.height)
  const right = clamp(rawX + rawW, 0, source.width)
  const bottom = clamp(rawY + rawH, 0, source.height)

  const width = Math.max(1, Math.round(right - x))
  const height = Math.max(1, Math.round(bottom - y))

  return { x: Math.round(x), y: Math.round(y), width, height }
}

/**
 * Scale an image down so its longest edge is at most `maxEdge`, keeping aspect.
 * Avoids embedding huge camera frames into the PDF and keeps memory sane.
 * Aspect ratio is never changed, so no distortion is introduced.
 */
export function shouldDownscale(source: Size, maxEdge = 2200): boolean {
  return Math.max(source.width, source.height) > maxEdge
}

/**
 * Fit `source` inside `box`, preserving aspect ratio, centred.
 * Used by the PDF layout so cards are never stretched.
 */
export function fitInsideBox(
  source: Size,
  box: { x: number; y: number; width: number; height: number }
): Rect {
  if (source.width <= 0 || source.height <= 0 || box.width <= 0 || box.height <= 0) {
    return { x: box.x, y: box.y, width: box.width, height: box.height }
  }

  const scale = Math.min(box.width / source.width, box.height / source.height)
  const width = source.width * scale
  const height = source.height * scale

  return {
    x: box.x + (box.width - width) / 2,
    y: box.y + (box.height - height) / 2,
    width,
    height,
  }
}

/**
 * Natural pixel size of a data URL. Kept separate so tests can stub it.
 */
export function imageSizeFromDataUrl(dataUrl: string): Promise<Size> {
  return new Promise((resolve) => {
    if (typeof Image === 'undefined') {
      resolve({ width: 0, height: 0 })
      return
    }
    const img = new Image()
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight })
    img.onerror = () => resolve({ width: 0, height: 0 })
    img.src = dataUrl
  })
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}