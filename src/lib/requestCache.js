const cache = new Map();
const maxEntries = 100;

export async function cachedRequest(key, request, staleTimeMs) {
  const now = Date.now();
  const cached = cache.get(key);
  if (cached?.value !== undefined && cached.expiresAt > now) {
    return cached.value;
  }
  if (cached?.promise) return cached.promise;

  const entry = { promise: null, expiresAt: 0 };
  const promise = Promise.resolve()
    .then(request)
    .then((value) => {
      if (cache.get(key) !== entry) return value;
      entry.promise = null;
      if (value?.error) {
        cache.delete(key);
        return value;
      }
      cache.set(key, {
        value,
        expiresAt: Date.now() + staleTimeMs,
      });
      pruneCache();
      return value;
    })
    .catch((error) => {
      if (cache.get(key) === entry) {
        entry.promise = null;
        cache.delete(key);
      }
      throw error;
    });

  entry.promise = promise;
  cache.set(key, entry);
  return promise;
}

export function invalidateRequestCache(prefix = "") {
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) cache.delete(key);
  }
}

export function clearRequestCache() {
  cache.clear();
}

function pruneCache() {
  const now = Date.now();
  for (const [key, value] of cache) {
    if (value.expiresAt <= now && !value.promise) cache.delete(key);
  }
  while (cache.size > maxEntries) {
    cache.delete(cache.keys().next().value);
  }
}
