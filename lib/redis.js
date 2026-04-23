import Redis from 'ioredis';

const TTL = parseInt(process.env.REDIS_TTL || '3600', 10);

let redis = null;
let redisAvailable = false;

export const initRedis = () => {
  const url = process.env.REDIS_URL || 'redis://localhost:6379';
  redis = new Redis(url, { lazyConnect: true, enableOfflineQueue: false });

  redis.on('connect', () => { redisAvailable = true; });
  redis.on('error', () => { redisAvailable = false; });

  redis.connect().catch(() => {
    console.warn('[redis] unavailable, running in disk-only mode');
  });
};

export const cacheGet = async (key) => {
  if (!redisAvailable) return null;
  try {
    const val = await redis.get(key);
    return val ? JSON.parse(val) : null;
  } catch {
    return null;
  }
};

export const cacheSet = async (key, value, ttl = TTL) => {
  if (!redisAvailable) return;
  try {
    await redis.set(key, JSON.stringify(value), 'EX', ttl);
  } catch {
    // ignore write failures
  }
};

export const cacheDel = async (...keys) => {
  if (!redisAvailable) return;
  try {
    await redis.del(...keys);
  } catch {
    // ignore
  }
};
