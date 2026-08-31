import { createRoom } from '../../lib/gameLogic.js';
import { generateRoomId, getRoom, saveRoom, addToRoomIndex, verifyRoomSaved } from '../../lib/store.js';
import { requireRedisOnVercel } from '../../lib/vercelCheck.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!requireRedisOnVercel(res)) return;

  const { playerId, playerName, roomName } = req.body ?? {};
  if (!playerId) return res.status(400).json({ error: 'playerId required' });
  if (!playerName?.trim()) return res.status(400).json({ error: 'playerName required' });

  const sanitizedRoomName = (roomName || '').trim().slice(0, 20)
    || `${playerName.trim().slice(0, 12)}의 방`;

  try {
    let roomId;
    let attempts = 0;
    do {
      roomId = generateRoomId();
      attempts++;
      if (attempts > 10) return res.status(500).json({ error: 'Failed to create room' });
    } while (await getRoom(roomId));

    const room = createRoom(roomId, playerId, playerName.trim().slice(0, 12), sanitizedRoomName);
    await saveRoom(room);
    await addToRoomIndex(roomId);

    const saved = await verifyRoomSaved(roomId);
    if (!saved) {
      return res.status(503).json({
        error: 'STORAGE_UNAVAILABLE',
        message: '방 저장에 실패했습니다. Redis 연결을 확인해 주세요.',
      });
    }

    return res.status(200).json({
      roomId,
      roomName: sanitizedRoomName,
      color: 'black',
      status: 'waiting',
    });
  } catch (err) {
    console.error('create room error:', err);
    return res.status(500).json({ error: 'SERVER_ERROR', message: '방 생성 중 오류가 발생했습니다.' });
  }
}
