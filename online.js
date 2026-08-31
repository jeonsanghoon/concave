const NAME_KEY = 'omok-player-name';
const NAME_BLACK_KEY = 'omok-name-black';
const NAME_WHITE_KEY = 'omok-name-white';

import { getCurrentUser, isLoggedIn } from './auth.js';

export function getPlayerId() {
  if (isLoggedIn()) return getCurrentUser().id;

  let id = localStorage.getItem('omok-player-id');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('omok-player-id', id);
  }
  return id;
}

export function sanitizeName(name, fallback = '플레이어') {
  const trimmed = (name || '').trim().slice(0, 12);
  return trimmed || fallback;
}

export function getPlayerName() {
  return sanitizeName(localStorage.getItem(NAME_KEY));
}

export function savePlayerName(name) {
  const sanitized = sanitizeName(name, '');
  if (sanitized) localStorage.setItem(NAME_KEY, sanitized);
  return sanitized;
}

export function getLocalNames() {
  return {
    black: sanitizeName(localStorage.getItem(NAME_BLACK_KEY), '플레이어 1'),
    white: sanitizeName(localStorage.getItem(NAME_WHITE_KEY), '플레이어 2'),
  };
}

export function saveLocalNames(black, white) {
  localStorage.setItem(NAME_BLACK_KEY, sanitizeName(black, '플레이어 1'));
  localStorage.setItem(NAME_WHITE_KEY, sanitizeName(white, '플레이어 2'));
}

function parseApiError(res, data, fallback) {
  const msg = data.message || data.error || fallback;
  const errorMap = {
    ROOM_NOT_FOUND: '방을 찾을 수 없습니다. 방 목록을 새로고침해 보세요.',
    ROOM_FULL: '방이 가득 찼습니다.',
    STORAGE_UNAVAILABLE: 'Vercel Storage에서 Upstash Redis를 연결한 후 재배포해 주세요.',
    'playerName required': '닉네임을 입력하세요.',
  };
  throw new Error(errorMap[data.error] || msg);
}

export async function createOnlineRoom(playerName, roomName) {
  const res = await fetch('/api/room/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ playerId: getPlayerId(), playerName, roomName }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) parseApiError(res, data, '방 생성 실패');
  return data;
}

export async function joinOnlineRoom(roomId, playerName) {
  const res = await fetch(`/api/room/${roomId.toUpperCase()}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ playerId: getPlayerId(), playerName, action: 'join' }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) parseApiError(res, data, '참가 실패');
  return data;
}

export async function fetchRoomList() {
  const res = await fetch('/api/room/list');
  const data = await res.json().catch(() => ({}));
  if (res.status === 503 && data.error === 'STORAGE_UNAVAILABLE') {
    return { rooms: [], redisConfigured: false };
  }
  if (!res.ok) throw new Error(data.message || data.error || '방 목록 조회 실패');
  return data;
}

export async function fetchRoomState(roomId) {
  const res = await fetch(`/api/room/${roomId}?playerId=${getPlayerId()}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) parseApiError(res, data, '상태 조회 실패');
  return data;
}

export async function sendOnlineMove(roomId, row, col) {
  const res = await fetch(`/api/room/${roomId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ playerId: getPlayerId(), action: 'move', row, col }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) parseApiError(res, data, '착수 실패');
  return data;
}

export async function copyRoomCode(code) {
  try {
    await navigator.clipboard.writeText(code);
    return true;
  } catch {
    return false;
  }
}
