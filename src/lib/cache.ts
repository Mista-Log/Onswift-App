// Simple localStorage cache with TTL.
// All keys are prefixed "onswift_cache_" so logout can wipe them in one sweep.

const DEFAULT_TTL_MS = 10 * 60 * 1000; // 10 minutes

export function readCache<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(`onswift_cache_${key}`);
    if (!raw) return null;
    const { data, ts, ttl } = JSON.parse(raw) as { data: T; ts: number; ttl: number };
    if (Date.now() - ts > ttl) {
      localStorage.removeItem(`onswift_cache_${key}`);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

export function writeCache(key: string, data: unknown, ttlMs = DEFAULT_TTL_MS): void {
  try {
    localStorage.setItem(
      `onswift_cache_${key}`,
      JSON.stringify({ data, ts: Date.now(), ttl: ttlMs })
    );
  } catch {
    // Storage quota exceeded — silently skip caching
  }
}

export function clearCache(key: string): void {
  localStorage.removeItem(`onswift_cache_${key}`);
}

export function clearAllCache(): void {
  const toRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k?.startsWith("onswift_cache_")) toRemove.push(k);
  }
  toRemove.forEach((k) => localStorage.removeItem(k));
}
