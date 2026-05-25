const cache = new Map<string, { value: unknown; expiry: number }>();

export function cached<T>(key: string, ttlMs: number, factory: () => T): T {
  const existing = cache.get(key);
  if (existing && existing.expiry > Date.now()) {
    return existing.value as T;
  }
  const value = factory();
  cache.set(key, { value, expiry: Date.now() + ttlMs });
  return value;
}

export async function cachedAsync<T>(key: string, ttlMs: number, factory: () => Promise<T>): Promise<T> {
  const existing = cache.get(key);
  if (existing && existing.expiry > Date.now()) {
    return existing.value as T;
  }
  const value = await factory();
  cache.set(key, { value, expiry: Date.now() + ttlMs });
  return value;
}

export function invalidateCache(key?: string): void {
  if (key) {
    cache.delete(key);
  } else {
    cache.clear();
  }
}

export function cacheSize(): number {
  return cache.size;
}
