import { Redis } from '@upstash/redis';

const ROOM_TTL = 60 * 60 * 24; // 24 hours
const ROOM_PREFIX = 'omok:room:';

const memoryRooms = globalThis.__omokRooms ?? (globalThis.__omokRooms = new Map());

function getRedis() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

const redis = getRedis();

export async function getRoom(id) {
  if (redis) {
    return await redis.get(`${ROOM_PREFIX}${id}`);
  }
  return memoryRooms.get(id) ?? null;
}

export async function saveRoom(room) {
  if (redis) {
    await redis.set(`${ROOM_PREFIX}${room.id}`, room, { ex: ROOM_TTL });
    return;
  }
  memoryRooms.set(room.id, room);
}

export async function deleteRoom(id) {
  if (redis) {
    await redis.del(`${ROOM_PREFIX}${id}`);
    return;
  }
  memoryRooms.delete(id);
}

export function generateRoomId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let id = '';
  for (let i = 0; i < 6; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

export function isRedisConfigured() {
  return !!redis;
}
