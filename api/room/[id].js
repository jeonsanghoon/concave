import { joinRoom, applyMove, roomToClient, BLACK, WHITE } from '../../lib/gameLogic.js';
import { getRoom, saveRoom } from '../../lib/store.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { id } = req.query;
  const playerId = req.method === 'GET' ? req.query.playerId : req.body?.playerId;

  if (!id || !playerId) {
    return res.status(400).json({ error: 'room id and playerId required' });
  }

  const room = await getRoom(id.toUpperCase());
  if (!room) return res.status(404).json({ error: 'ROOM_NOT_FOUND' });

  if (req.method === 'GET') {
    return res.status(200).json(roomToClient(room, playerId));
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { action, row, col } = req.body ?? {};

  try {
    if (action === 'join') {
      const result = joinRoom(room, playerId);
      await saveRoom(result.room);
      return res.status(200).json({
        ...roomToClient(result.room, playerId),
        color: result.color === BLACK ? 'black' : 'white',
      });
    }

    if (action === 'move') {
      if (typeof row !== 'number' || typeof col !== 'number') {
        return res.status(400).json({ error: 'row and col required' });
      }
      const updated = applyMove(room, playerId, row, col);
      await saveRoom(updated);
      return res.status(200).json(roomToClient(updated, playerId));
    }

    return res.status(400).json({ error: 'Unknown action' });
  } catch (err) {
    const code = err.message;
    const status = ['ROOM_FULL', 'NOT_IN_ROOM', 'NOT_YOUR_TURN', 'INVALID_MOVE', 'OCCUPIED', 'NOT_PLAYING', 'GAME_OVER'].includes(code)
      ? 400
      : 500;
    return res.status(status).json({ error: code });
  }
}
