import { isRedisConfigured } from '../../lib/store.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const redisConfigured = isRedisConfigured();

  return res.status(200).json({
    ok: redisConfigured,
    service: 'concave-omok',
    redisConfigured,
    vercel: !!process.env.VERCEL,
    features: {
      localPvp: true,
      ai: true,
      online: redisConfigured,
      auth: redisConfigured,
      roomList: redisConfigured,
    },
  });
}
