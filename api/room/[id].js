import { joinRoom, applyMove, roomToClient, BLACK, WHITE } from '../../lib/gameLogic.js';
import { getRoom, saveRoom, removeFromRoomIndex } from '../../lib/store.js';
import { requireRedisOnVercel } from '../../lib/vercelCheck.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!requireRedisOnVercel(res)) return;

  const { id } = req.query;
  const playerId = req.method === 'GET' ? req.query.playerId : req.body?.playerId;

  if (!id || !playerId) {
    return res.status(400).json({ error: 'room id and playerId required' });
  }

  const roomId = id.toUpperCase();

  try {
    const room = await getRoom(roomId);
    if (!room) {
      return res.status(404).json({
        error: 'ROOM_NOT_FOUND',
        message: '방을 찾을 수 없습니다. 코드를 확인하거나 방 목록에서 선택해 주세요.',
      });
    }

    if (req.method === 'GET') {
      return res.status(200).json(roomToClient(room, playerId));
    }

    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const { action, row, col, playerName } = req.body ?? {};

    if (action === 'join') {
      if (!playerName?.trim()) {
        return res.status(400).json({ error: 'playerName required', message: '닉네임을 입력하세요.' });
      }

      if (room.status === 'finished') {
        return res.status(400).json({ error: 'GAME_OVER', message: '이미 종료된 방입니다.' });
      }

      if (room.status === 'playing' && room.blackPlayer !== playerId && room.whitePlayer !== playerId) {
        return res.status(400).json({ error: 'ROOM_FULL', message: '방이 가득 찼습니다.' });
      }

      const result = joinRoom(room, playerId, playerName.trim().slice(0, 12));
      await saveRoom(result.room);

      if (result.room.status === 'playing') {
        await removeFromRoomIndex(roomId);
      }

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
      if (updated.status === 'finished') {
        await removeFromRoomIndex(roomId);
      }
      return res.status(200).json(roomToClient(updated, playerId));
    }

    return res.status(400).json({ error: 'Unknown action' });
  } catch (err) {
    const code = err.message;
    const messages = {
      ROOM_FULL: '방이 가득 찼습니다.',
      NOT_IN_ROOM: '방에 참가하지 않았습니다.',
      NOT_YOUR_TURN: '내 차례가 아닙니다.',
      INVALID_MOVE: '잘못된 위치입니다.',
      OCCUPIED: '이미 돌이 있습니다.',
      NOT_PLAYING: '게임이 시작되지 않았습니다.',
      GAME_OVER: '게임이 종료되었습니다.',
    };
    const status = Object.keys(messages).includes(code) ? 400 : 500;
    return res.status(status).json({ error: code, message: messages[code] || code });
  }
}
