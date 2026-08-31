export const SIZE = 15;
export const EMPTY = 0;
export const BLACK = 1;
export const WHITE = 2;

const DIRECTIONS = [[0, 1], [1, 0], [1, 1], [1, -1]];

export function createEmptyBoard() {
  return Array.from({ length: SIZE }, () => Array(SIZE).fill(EMPTY));
}

function countDirection(board, row, col, dr, dc, player) {
  let count = 0;
  let r = row + dr;
  let c = col + dc;
  while (r >= 0 && r < SIZE && c >= 0 && c < SIZE && board[r][c] === player) {
    count++;
    r += dr;
    c += dc;
  }
  return count;
}

export function checkWin(board, row, col, player) {
  for (const [dr, dc] of DIRECTIONS) {
    const count = 1
      + countDirection(board, row, col, dr, dc, player)
      + countDirection(board, row, col, -dr, -dc, player);
    if (count >= 5) return true;
  }
  return false;
}

export function createRoom(id, hostPlayerId, hostName, roomName) {
  return {
    id,
    roomName: roomName || `${hostName || '플레이어'}의 방`,
    board: createEmptyBoard(),
    currentPlayer: BLACK,
    blackPlayer: hostPlayerId,
    whitePlayer: null,
    blackName: hostName || '플레이어',
    whiteName: null,
    status: 'waiting',
    winner: null,
    lastMove: null,
    moveCount: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

export function joinRoom(room, playerId, playerName) {
  if (room.blackPlayer === playerId) {
    return { room, color: BLACK };
  }
  if (room.whitePlayer === playerId) {
    return { room, color: WHITE };
  }
  if (room.whitePlayer) {
    throw new Error('ROOM_FULL');
  }
  room.whitePlayer = playerId;
  room.whiteName = playerName || '플레이어';
  room.status = 'playing';
  room.updatedAt = Date.now();
  return { room, color: WHITE };
}

export function applyMove(room, playerId, row, col) {
  if (room.status !== 'playing') throw new Error('NOT_PLAYING');
  if (room.winner) throw new Error('GAME_OVER');

  const color = room.blackPlayer === playerId ? BLACK : room.whitePlayer === playerId ? WHITE : null;
  if (!color) throw new Error('NOT_IN_ROOM');
  if (color !== room.currentPlayer) throw new Error('NOT_YOUR_TURN');

  if (row < 0 || row >= SIZE || col < 0 || col >= SIZE) throw new Error('INVALID_MOVE');
  if (room.board[row][col] !== EMPTY) throw new Error('OCCUPIED');

  room.board[row][col] = color;
  room.lastMove = { row, col };
  room.moveCount++;
  room.updatedAt = Date.now();

  if (checkWin(room.board, row, col, color)) {
    room.winner = color;
    room.status = 'finished';
    return room;
  }

  room.currentPlayer = color === BLACK ? WHITE : BLACK;
  return room;
}

export function roomToClient(room, playerId) {
  const myColor = room.blackPlayer === playerId ? BLACK : room.whitePlayer === playerId ? WHITE : null;
  return {
    id: room.id,
    roomName: room.roomName || room.id,
    board: room.board,
    currentPlayer: room.currentPlayer,
    status: room.status,
    winner: room.winner,
    lastMove: room.lastMove,
    moveCount: room.moveCount,
    myColor,
    blackName: room.blackName || '흑',
    whiteName: room.whiteName || '백',
    blackJoined: !!room.blackPlayer,
    whiteJoined: !!room.whitePlayer,
    isMyTurn: myColor === room.currentPlayer && room.status === 'playing',
  };
}
