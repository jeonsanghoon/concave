import { getStorageStatus } from '../../lib/vercelCheck.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const status = getStorageStatus();
  const ready = status.redisConfigured;

  return res.status(ready ? 200 : 503).json({
    ok: ready,
    service: 'concave-omok',
    features: {
      localPvp: true,
      ai: true,
      online: status.redisConfigured,
      auth: status.redisConfigured,
      roomList: status.redisConfigured,
    },
    ...status,
  });
}
