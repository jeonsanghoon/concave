import { createRoom } from '../../lib/gameLogic.js';
import { generateRoomId, getRoom, saveRoom } from '../../lib/store.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { playerId } = req.body ?? {};
  if (!playerId) return res.status(400).json({ error: 'playerId required' });

  let roomId;
  let attempts = 0;
  do {
    roomId = generateRoomId();
    attempts++;
    if (attempts > 10) return res.status(500).json({ error: 'Failed to create room' });
  } while (await getRoom(roomId));

  const room = createRoom(roomId, playerId);
  await saveRoom(room);

  return res.status(200).json({
    roomId,
    color: 'black',
    status: 'waiting',
  });
}
