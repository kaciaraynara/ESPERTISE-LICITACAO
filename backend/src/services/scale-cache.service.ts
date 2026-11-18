import Redis from 'ioredis';

const MAX_LOCAL_KEYS = 500;
const localCache = new Map<string, { exp: number; value: any }>();

let redisClient: Redis | null = null;
function getRedis(): Redis | null {
  const url = process.env.REDIS_URL?.trim();
  if (!url) return null;
  if (!redisClient) {
    try {
      redisClient = new Redis(url, { maxRetriesPerRequest: 1, connectTimeout: 2000, lazyConnect: true });
      redisClient.on('error', () => {});
    } catch {
      return null;
    }
  }
  return redisClient;
}

export async function scaleCacheGet<T = any>(key: string): Promise<T | null> {
  const hit = localCache.get(key);
  if (hit && hit.exp > Date.now()) {
    return hit.value as T;
  }
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
      // segue para fallback local
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
      // ignora erro pontual de rede no Redis
    }
  }
}
