export function getPlayerId() {
  let id = localStorage.getItem('omok-player-id');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('omok-player-id', id);
  }
  return id;
}

export async function createOnlineRoom() {
  const res = await fetch('/api/room/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ playerId: getPlayerId() }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || '방 생성 실패');
  }
  return res.json();
}

export async function joinOnlineRoom(roomId) {
  const res = await fetch(`/api/room/${roomId.toUpperCase()}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ playerId: getPlayerId(), action: 'join' }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || '참가 실패');
  }
  return res.json();
}

export async function fetchRoomState(roomId) {
  const res = await fetch(`/api/room/${roomId}?playerId=${getPlayerId()}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || '상태 조회 실패');
  }
  return res.json();
}

export async function sendOnlineMove(roomId, row, col) {
  const res = await fetch(`/api/room/${roomId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ playerId: getPlayerId(), action: 'move', row, col }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || '착수 실패');
  }
  return res.json();
}

export async function copyRoomCode(code) {
  try {
    await navigator.clipboard.writeText(code);
    return true;
  } catch {
    return false;
  }
}
