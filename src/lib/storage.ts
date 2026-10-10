// Safe localStorage helpers with SSR protection and in-memory fallback

const memoryStore: Record<string, string> = {};

function isStorageAvailable(): boolean {
  try {
    if (typeof window === 'undefined') return false;
    const testKey = '__storage_test__';
    localStorage.setItem(testKey, '1');
    localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

export function getStorageValue(key: string, fallback: string = ''): string {
  try {
    if (typeof window === 'undefined') return fallback;
    if (isStorageAvailable()) {
      const value = localStorage.getItem(key);
      return value !== null ? value : fallback;
    }
    return memoryStore[key] ?? fallback;
  } catch {
    return memoryStore[key] ?? fallback;
  }
}

export function setStorageValue(key: string, value: string): void {
  try {
    memoryStore[key] = value;
    if (typeof window !== 'undefined' && isStorageAvailable()) {
      localStorage.setItem(key, value);
    }
  } catch {
    // Silently fail - memory store already updated
  }
}

export function removeStorageValue(key: string): void {
  try {
    delete memoryStore[key];
    if (typeof window !== 'undefined' && isStorageAvailable()) {
      localStorage.removeItem(key);
    }
  } catch {
    // Silently fail
  }
}

export function getStorageJSON<T>(key: string, fallback: T): T {
  const raw = getStorageValue(key, '');
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function setStorageJSON<T>(key: string, value: T): void {
  try {
    setStorageValue(key, JSON.stringify(value));
  } catch {
    // Silently fail
  }
}
