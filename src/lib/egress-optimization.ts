type CacheEntry<T> = {
  expiresAt: number;
  value?: T;
  promise?: Promise<T>;
};

const requestCache = new Map<string, CacheEntry<unknown>>();

export async function cachedRequest<T>(
  key: string,
  loader: () => Promise<T>,
  ttlMs = 300_000,
): Promise<T> {
  const now = Date.now();
  const cached = requestCache.get(key) as CacheEntry<T> | undefined;

  if (cached?.value !== undefined && cached.expiresAt > now) {
    return cached.value;
  }

  if (cached?.promise) {
    return cached.promise;
  }

  const promise = loader()
    .then((value) => {
      requestCache.set(key, {
        value,
        expiresAt: Date.now() + Math.max(1_000, ttlMs),
      });
      return value;
    })
    .catch((error) => {
      requestCache.delete(key);
      throw error;
    });

  requestCache.set(key, {
    promise,
    expiresAt: now + Math.max(1_000, ttlMs),
  });

  return promise;
}

export function clearCachedRequest(key?: string) {
  if (key) requestCache.delete(key);
  else requestCache.clear();
}
