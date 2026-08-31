import { isRedisConfigured } from './store.js';

export function requireRedisOnVercel(res) {
  if (process.env.VERCEL && !isRedisConfigured()) {
    res.status(503).json({
      error: 'STORAGE_UNAVAILABLE',
      message: 'Vercel 대시보드 → Storage → Upstash Redis를 연결한 후 재배포해 주세요.',
      redisConfigured: false,
    });
    return false;
  }
  return true;
}

export function getStorageStatus() {
  return {
    redisConfigured: isRedisConfigured(),
    vercel: !!process.env.VERCEL,
    authSecretConfigured: !!(process.env.AUTH_SECRET && process.env.AUTH_SECRET !== 'omok-dev-secret-change-me'),
  };
}
