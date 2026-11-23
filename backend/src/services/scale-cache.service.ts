import Redis from 'ioredis';

const MAX_LOCAL_KEYS = 2000;
const localCache = new Map<string, { exp: number; value: any }>();
const inFlightPromises = new Map<string, Promise<any>>();

let redisClient: Redis | null = null;
let redisCooldownUntil = 0;

function getRedis(): Redis | null {
  if (Date.now() < redisCooldownUntil) return null;
  const url = process.env.REDIS_URL?.trim();
  if (!url) return null;
  if (!redisClient) {
    try {
      redisClient = new Redis(url, {
        maxRetriesPerRequest: 1,
        connectTimeout: 2000,
        lazyConnect: true,
        enableOfflineQueue: false,
        retryStrategy: (times) => {
          redisCooldownUntil = Date.now() + 60_000;
          return Math.min(times * 2000, 30_000);
        },
      });
      redisClient.on('error', () => {
        redisCooldownUntil = Date.now() + 60_000;
      });
    } catch {
      redisCooldownUntil = Date.now() + 60_000;
      return null;
    }
  }
  if (redisClient.status !== 'ready') return null;
  return redisClient;
}

export async function scaleCacheGet<T = any>(key: string): Promise<T | null> {
  const hit = localCache.get(key);
  if (hit && hit.exp > Date.now()) return hit.value as T;
  if (hit) localCache.delete(key);

  const r = getRedis();
  if (r) {
    try {
      const raw = await r.get(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        localCache.set(key, { exp: Date.now() + 30000, value: parsed });
        return parsed as T;
      }
    } catch {
      redisCooldownUntil = Date.now() + 60_000;
    }
  }
  return null;
}

export async function scaleCacheSet(key: string, value: any, ttlSeconds = 60): Promise<void> {
  if (localCache.size >= MAX_LOCAL_KEYS) {
    const firstKey = localCache.keys().next().value;
    if (firstKey) localCache.delete(firstKey);
  }
  localCache.set(key, { exp: Date.now() + ttlSeconds * 1000, value });

  const r = getRedis();
  if (r) {
    try {
      await r.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch {
      redisCooldownUntil = Date.now() + 60_000;
    }
  }
}

export function scaleCacheInvalidatePrefix(prefix: string): void {
  for (const key of localCache.keys()) {
    if (key.startsWith(prefix)) {
      localCache.delete(key);
    }
  }
}

/**
 * Deduplica chamadas concorrentes idênticas em voo (Singleflight) e armazena em cache local curto.
 * Transparente em ambiente de testes (`NODE_ENV === 'test'`) para não interferir em mocks do Jest.
 */
export async function scaleSingleflight<T>(
  key: string,
  ttlSeconds: number,
  fn: () => Promise<T>,
): Promise<T> {
  if (process.env.NODE_ENV === 'test') {
    return fn();
  }

  const now = Date.now();
  const hit = localCache.get(key);
  if (hit && hit.exp > now) {
    return hit.value as T;
  }
  if (hit) {
    localCache.delete(key);
  }

  const existingPromise = inFlightPromises.get(key);
  if (existingPromise) {
    return existingPromise as Promise<T>;
  }

  const promise = (async () => {
    try {
      const result = await fn();
      if (ttlSeconds > 0) {
        if (localCache.size >= MAX_LOCAL_KEYS) {
          const oldest = localCache.keys().next().value;
          if (oldest) localCache.delete(oldest);
        }
        localCache.set(key, { exp: Date.now() + ttlSeconds * 1000, value: result });
      }
      return result;
    } finally {
      inFlightPromises.delete(key);
    }
  })();

  inFlightPromises.set(key, promise);
  return promise;
}
