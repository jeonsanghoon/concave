import { Redis } from '@upstash/redis';

const ROOM_TTL = 60 * 60 * 24;
const ROOM_PREFIX = 'omok:room:';
const ROOM_INDEX_KEY = 'omok:room:index';

const memoryRooms = globalThis.__omokRooms ?? (globalThis.__omokRooms = new Map());
const memoryRoomIndex = globalThis.__omokRoomIndex ?? (globalThis.__omokRoomIndex = new Set());

function getRedisConfig() {
  const url = process.env.UPSTASH_REDIS_REST_URL
    || process.env.KV_REST_API_URL
    || process.env.KV_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
    || process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  return { url, token };
}

function getRedis() {
  const config = getRedisConfig();
  if (!config) return null;
  return new Redis(config);
}

const redis = getRedis();

export function getRedisClient() {
  return redis;
}

export function isRedisConfigured() {
  return !!redis;
}

export function getRedisEnvHint() {
  const keys = Object.keys(process.env).filter(k =>
    /REDIS|UPSTASH|KV_/i.test(k)
  );
  return keys;
}

export async function getRoom(id) {
  const roomId = id.toUpperCase();
  if (redis) {
    return await redis.get(`${ROOM_PREFIX}${roomId}`);
  }
  return memoryRooms.get(roomId) ?? null;
}

export async function saveRoom(room) {
  const roomId = room.id.toUpperCase();
  if (redis) {
    await redis.set(`${ROOM_PREFIX}${roomId}`, room, { ex: ROOM_TTL });
    return;
  }
  memoryRooms.set(roomId, room);
}

export async function deleteRoom(id) {
  const roomId = id.toUpperCase();
  if (redis) {
    await redis.del(`${ROOM_PREFIX}${roomId}`);
  } else {
    memoryRooms.delete(roomId);
  }
  await removeFromRoomIndex(roomId);
}

export async function verifyRoomSaved(id) {
  const room = await getRoom(id);
  return !!room;
}

export async function addToRoomIndex(roomId) {
  const id = roomId.toUpperCase();
  if (redis) {
    await redis.sadd(ROOM_INDEX_KEY, id);
    return;
  }
  memoryRoomIndex.add(id);
}

export async function removeFromRoomIndex(roomId) {
  const id = roomId.toUpperCase();
  if (redis) {
    await redis.srem(ROOM_INDEX_KEY, id);
    return;
  }
  memoryRoomIndex.delete(id);
}

export async function listWaitingRooms() {
  let ids = [];
  if (redis) {
    ids = await redis.smembers(ROOM_INDEX_KEY) ?? [];
  } else {
    ids = [...memoryRoomIndex];
  }

  const waiting = [];
  for (const id of ids) {
    const room = await getRoom(id);
    if (!room) {
      await removeFromRoomIndex(id);
      continue;
    }
    if (room.status === 'waiting') {
      waiting.push({
        id: room.id,
        roomName: room.roomName || room.id,
        blackName: room.blackName || '플레이어',
        status: room.status,
        createdAt: room.createdAt,
      });
    } else if (room.status === 'finished') {
      await deleteRoom(room.id);
    } else if (room.status === 'playing') {
      await removeFromRoomIndex(room.id);
    }
  }

  return waiting.sort((a, b) => b.createdAt - a.createdAt);
}

export function generateRoomId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let id = '';
  for (let i = 0; i < 6; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}
