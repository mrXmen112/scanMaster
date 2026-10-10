const DAILY_LIMIT = 3
const WATERMARK_AFTER = 2

type Feature = 'screenshot-editor' | 'handwriting' | 'password-protect' | 'pdf-editor'

interface FeatureUsage {
  count: number
  date: string
}

function todayKey(): string {
  return new Date().toISOString().split('T')[0]
}

function storageKey(feature: Feature): string {
  return `usage_${feature}`
}

function getFeatureUsage(feature: Feature): FeatureUsage {
  if (typeof window === 'undefined') return { count: 0, date: todayKey() }
  try {
    const raw = localStorage.getItem(storageKey(feature))
    if (!raw) return { count: 0, date: todayKey() }
    const data = JSON.parse(raw) as FeatureUsage
    if (data.date !== todayKey()) {
      localStorage.setItem(storageKey(feature), JSON.stringify({ count: 0, date: todayKey() }))
      return { count: 0, date: todayKey() }
    }
    return data
  } catch {
    return { count: 0, date: todayKey() }
  }
}

export function incrementUsage(feature: Feature): void {
  if (typeof window === 'undefined') return
  const current = getFeatureUsage(feature)
  localStorage.setItem(storageKey(feature), JSON.stringify({ count: current.count + 1, date: todayKey() }))
}

export function getRemainingUses(feature: Feature): number {
  const current = getFeatureUsage(feature)
  return Math.max(0, DAILY_LIMIT - current.count)
}

export function isLimitReached(feature: Feature): boolean {
  return getFeatureUsage(feature).count >= DAILY_LIMIT
}

export function shouldWatermark(feature: Feature): boolean {
  const current = getFeatureUsage(feature)
  return current.count > WATERMARK_AFTER
}

export function resetAllUsage(): void {
  if (typeof window === 'undefined') return
  const features: Feature[] = ['screenshot-editor', 'handwriting', 'password-protect', 'pdf-editor']
  for (const f of features) {
    localStorage.removeItem(storageKey(f))
  }
}

export function grantBonusUse(feature: Feature): void {
  if (typeof window === 'undefined') return
  const current = getFeatureUsage(feature)
  const newCount = Math.max(0, current.count - 1)
  localStorage.setItem(storageKey(feature), JSON.stringify({ count: newCount, date: todayKey() }))
}
