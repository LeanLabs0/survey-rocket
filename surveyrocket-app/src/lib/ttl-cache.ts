type Entry<T> = { value: T; until: number };

const store = new Map<string, Entry<unknown>>();

export function cacheGet<T>(key: string): { hit: true; value: T } | { hit: false } {
  const entry = store.get(key);
  if (!entry) return { hit: false };
  if (entry.until < Date.now()) {
    store.delete(key);
    return { hit: false };
  }
  return { hit: true, value: entry.value as T };
}

export function cacheSet<T>(key: string, value: T, ttlMs: number) {
  store.set(key, { value, until: Date.now() + ttlMs });
}

export function cacheDelete(key: string) {
  store.delete(key);
}

export function cacheDeletePrefix(prefix: string) {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}

export async function cacheGetOrSet<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const cached = cacheGet<T>(key);
  if (cached.hit) return cached.value;
  const value = await load();
  cacheSet(key, value, ttlMs);
  return value;
}
