import { listPublicRooms, isRedisConfigured } from '../../lib/store.js';
import { requireRedisOnVercel } from '../../lib/vercelCheck.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!requireRedisOnVercel(res)) return;

  try {
    const rooms = await listPublicRooms();
    return res.status(200).json({
      rooms,
      redisConfigured: isRedisConfigured(),
    });
  } catch (err) {
    console.error('list rooms error:', err);
    return res.status(500).json({ error: 'SERVER_ERROR', message: '방 목록을 불러오지 못했습니다.' });
  }
}
