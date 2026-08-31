import {
  createOnlineRoom,
  joinOnlineRoom,
  fetchRoomState,
  sendOnlineMove,
  copyRoomCode,
} from './online.js';

(() => {
  const SIZE = 15;
  const EMPTY = 0;
  const BLACK = 1;
  const WHITE = 2;

  const canvas = document.getElementById('board');
  const ctx = canvas.getContext('2d');
  const menuEl = document.getElementById('menu');
  const gameEl = document.getElementById('game');
  const onlineLobbyEl = document.getElementById('online-lobby');
  const statusEl = document.getElementById('status');
  const blackNameEl = document.getElementById('black-name');
  const whiteNameEl = document.getElementById('white-name');
  const overlayEl = document.getElementById('overlay');
  const resultTitleEl = document.getElementById('result-title');
  const resultMessageEl = document.getElementById('result-message');
  const undoBtn = document.getElementById('undo-btn');
  const restartBtn = document.getElementById('restart-btn');
  const menuBtn = document.getElementById('menu-btn');
  const playAgainBtn = document.getElementById('play-again-btn');
  const backMenuBtn = document.getElementById('back-menu-btn');
  const roomBadgeEl = document.getElementById('room-badge');
  const roomBadgeCodeEl = document.getElementById('room-badge-code');
  const lobbyErrorEl = document.getElementById('lobby-error');
  const lobbyWaitingEl = document.getElementById('lobby-waiting');
  const roomCodeTextEl = document.getElementById('room-code-text');
  const waitingStatusEl = document.getElementById('waiting-status');
  const panelCreateEl = document.getElementById('panel-create');
  const panelJoinEl = document.getElementById('panel-join');

  const PADDING = 30;
  const CELL = (canvas.width - PADDING * 2) / (SIZE - 1);
  const STONE_RADIUS = CELL * 0.42;
  const POLL_INTERVAL = 1500;

  let board = [];
  let currentPlayer = BLACK;
  let gameMode = null;
  let gameOver = false;
  let history = [];
  let lastMove = null;
  let aiThinking = false;

  let onlineRoomId = null;
  let onlineMyColor = null;
  let pollTimer = null;
  let waitPollTimer = null;
  let lastSyncedMoveCount = 0;

  function initBoard() {
    board = Array.from({ length: SIZE }, () => Array(SIZE).fill(EMPTY));
    currentPlayer = BLACK;
    gameOver = false;
    history = [];
    lastMove = null;
    aiThinking = false;
    lastSyncedMoveCount = 0;
  }

  function stopPolling() {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
    if (waitPollTimer) {
      clearInterval(waitPollTimer);
      waitPollTimer = null;
    }
  }

  function drawBoard() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    grad.addColorStop(0, '#e8c872');
    grad.addColorStop(0.5, '#dcb35c');
    grad.addColorStop(1, '#c9a040');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = '#3d2e1a';
    ctx.lineWidth = 1;

    for (let i = 0; i < SIZE; i++) {
      const pos = PADDING + i * CELL;
      ctx.beginPath();
      ctx.moveTo(PADDING, pos);
      ctx.lineTo(canvas.width - PADDING, pos);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(pos, PADDING);
      ctx.lineTo(pos, canvas.height - PADDING);
      ctx.stroke();
    }

    const stars = [3, 7, 11];
    ctx.fillStyle = '#3d2e1a';
    for (const r of stars) {
      for (const c of stars) {
        const x = PADDING + c * CELL;
        const y = PADDING + r * CELL;
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        if (board[r][c] !== EMPTY) {
          drawStone(r, c, board[r][c], r === lastMove?.row && c === lastMove?.col);
        }
      }
    }
  }

  function drawStone(row, col, player, isLast) {
    const x = PADDING + col * CELL;
    const y = PADDING + row * CELL;

    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.4)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetY = 2;

    ctx.beginPath();
    ctx.arc(x, y, STONE_RADIUS, 0, Math.PI * 2);

    if (player === BLACK) {
      const grad = ctx.createRadialGradient(x - 3, y - 3, 1, x, y, STONE_RADIUS);
      grad.addColorStop(0, '#555');
      grad.addColorStop(1, '#111');
      ctx.fillStyle = grad;
    } else {
      const grad = ctx.createRadialGradient(x - 3, y - 3, 1, x, y, STONE_RADIUS);
      grad.addColorStop(0, '#fff');
      grad.addColorStop(1, '#bbb');
      ctx.fillStyle = grad;
    }
    ctx.fill();
    ctx.restore();

    if (isLast) {
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#e74c3c';
      ctx.fill();
    }
  }

  function canvasToBoard(x, y) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const cx = (x - rect.left) * scaleX;
    const cy = (y - rect.top) * scaleY;

    const col = Math.round((cx - PADDING) / CELL);
    const row = Math.round((cy - PADDING) / CELL);

    if (row < 0 || row >= SIZE || col < 0 || col >= SIZE) return null;
    return { row, col };
  }

  function countDirection(row, col, dr, dc, player) {
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

  function checkWin(row, col, player) {
    const dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
    for (const [dr, dc] of dirs) {
      const count = 1
        + countDirection(row, col, dr, dc, player)
        + countDirection(row, col, -dr, -dc, player);
      if (count >= 5) return true;
    }
    return false;
  }

  function applyRemoteState(state) {
    board = state.board;
    currentPlayer = state.currentPlayer;
    lastMove = state.lastMove;
    gameOver = state.status === 'finished';
    lastSyncedMoveCount = state.moveCount;

    if (gameOver && state.winner) {
      const iWon = state.winner === onlineMyColor;
      showOnlineResult(iWon, state.winner);
    }

    drawBoard();
    updateUI();
  }

  async function pollRoom() {
    if (!onlineRoomId) return;
    try {
      const state = await fetchRoomState(onlineRoomId);
      if (state.moveCount !== lastSyncedMoveCount || state.status === 'finished') {
        applyRemoteState(state);
      } else if (state.status === 'playing' && gameMode === 'online' && !gameEl.classList.contains('hidden')) {
        currentPlayer = state.currentPlayer;
        updateUI();
      }
    } catch {
      statusEl.textContent = '연결 끊김 — 재연결 중...';
    }
  }

  function startPolling() {
    stopPolling();
    pollTimer = setInterval(pollRoom, POLL_INTERVAL);
  }

  async function placeStoneLocal(row, col) {
    if (gameOver || board[row][col] !== EMPTY || aiThinking) return false;

    board[row][col] = currentPlayer;
    history.push({ row, col, player: currentPlayer });
    lastMove = { row, col };

    if (checkWin(row, col, currentPlayer)) {
      gameOver = true;
      drawBoard();
      showResult(currentPlayer);
      updateUI();
      return true;
    }

    currentPlayer = currentPlayer === BLACK ? WHITE : BLACK;
    drawBoard();
    updateUI();

    if (gameMode === 'pvc' && currentPlayer === WHITE && !gameOver) {
      aiMove();
    }

    return true;
  }

  async function placeStoneOnline(row, col) {
    if (gameOver || board[row][col] !== EMPTY) return false;
    if (currentPlayer !== onlineMyColor) return false;

    try {
      const state = await sendOnlineMove(onlineRoomId, row, col);
      applyRemoteState(state);
      return true;
    } catch (err) {
      statusEl.textContent = err.message === 'NOT_YOUR_TURN' ? '상대 차례입니다' : '착수 실패';
      setTimeout(updateUI, 1500);
      return false;
    }
  }

  function placeStone(row, col) {
    if (gameMode === 'online') return placeStoneOnline(row, col);
    return placeStoneLocal(row, col);
  }

  function aiMove() {
    aiThinking = true;
    updateUI();
    statusEl.textContent = 'AI 생각 중...';

    setTimeout(() => {
      const move = AI.getBestMove(board, WHITE);
      if (move) {
        aiThinking = false;
        placeStoneLocal(move.row, move.col);
      }
    }, 400);
  }

  function undo() {
    if (gameMode === 'online') return;
    if (aiThinking) return;

    const stepsToUndo = gameMode === 'pvc' ? 2 : 1;
    if (history.length < stepsToUndo) return;

    for (let i = 0; i < stepsToUndo; i++) {
      const last = history.pop();
      board[last.row][last.col] = EMPTY;
    }

    gameOver = false;
    currentPlayer = history.length > 0
      ? (history[history.length - 1].player === BLACK ? WHITE : BLACK)
      : BLACK;
    lastMove = history.length > 0
      ? { row: history[history.length - 1].row, col: history[history.length - 1].col }
      : null;

    drawBoard();
    updateUI();
  }

  function updateUI() {
    const blackActive = currentPlayer === BLACK && !gameOver;
    const whiteActive = currentPlayer === WHITE && !gameOver;

    document.querySelector('.black-player').classList.toggle('active', blackActive);
    document.querySelector('.white-player').classList.toggle('active', whiteActive);

    if (gameOver) return;

    if (aiThinking) {
      statusEl.textContent = 'AI 생각 중...';
    } else if (gameMode === 'online') {
      if (currentPlayer === onlineMyColor) {
        statusEl.textContent = onlineMyColor === BLACK ? '내 차례 (흑)' : '내 차례 (백)';
      } else {
        statusEl.textContent = '상대 차례...';
      }
    } else if (gameMode === 'pvc') {
      statusEl.textContent = currentPlayer === BLACK ? '당신의 차례 (흑)' : 'AI 차례 (백)';
    } else {
      statusEl.textContent = currentPlayer === BLACK ? '흑의 차례' : '백의 차례';
    }

    const canUndo = gameMode !== 'online' && history.length > 0 && !aiThinking;
    undoBtn.disabled = !canUndo;
    undoBtn.classList.toggle('hidden', gameMode === 'online');

    restartBtn.classList.toggle('hidden', gameMode === 'online');
  }

  function showOnlineResult(iWon, winner) {
    resultTitleEl.textContent = iWon ? '승리!' : '패배';
    resultMessageEl.textContent = iWon
      ? '축하합니다! 상대를 이겼습니다.'
      : `${winner === BLACK ? '흑' : '백'}(상대) 승리`;
    overlayEl.classList.remove('hidden');
  }

  function showResult(winner) {
    const isBlack = winner === BLACK;
    if (gameMode === 'pvc') {
      resultTitleEl.textContent = isBlack ? '승리!' : '패배';
      resultMessageEl.textContent = isBlack
        ? '축하합니다! AI를 이겼습니다.'
        : 'AI에게 졌습니다. 다시 도전해 보세요!';
    } else {
      resultTitleEl.textContent = '승리!';
      resultMessageEl.textContent = `${isBlack ? '흑' : '백'}이 이겼습니다!`;
    }
    overlayEl.classList.remove('hidden');
  }

  function showGameScreen() {
    menuEl.classList.add('hidden');
    onlineLobbyEl.classList.add('hidden');
    gameEl.classList.remove('hidden');
    overlayEl.classList.add('hidden');
  }

  function startGame(mode) {
    gameMode = mode;
    initBoard();
    stopPolling();
    onlineRoomId = null;
    onlineMyColor = null;

    roomBadgeEl.classList.add('hidden');

    if (mode === 'pvc') {
      blackNameEl.textContent = '나 (흑)';
      whiteNameEl.textContent = 'AI (백)';
    } else if (mode === 'online') {
      blackNameEl.textContent = onlineMyColor === BLACK ? '나 (흑)' : '상대 (흑)';
      whiteNameEl.textContent = onlineMyColor === WHITE ? '나 (백)' : '상대 (백)';
      roomBadgeEl.classList.remove('hidden');
      roomBadgeCodeEl.textContent = onlineRoomId;
      startPolling();
    } else {
      blackNameEl.textContent = '흑';
      whiteNameEl.textContent = '백';
    }

    showGameScreen();
    drawBoard();
    updateUI();
  }

  function startOnlineGame(roomId, myColor) {
    onlineRoomId = roomId;
    onlineMyColor = myColor === 'black' ? BLACK : WHITE;
    gameMode = 'online';
    initBoard();
    stopPolling();

    blackNameEl.textContent = onlineMyColor === BLACK ? '나 (흑)' : '상대 (흑)';
    whiteNameEl.textContent = onlineMyColor === WHITE ? '나 (백)' : '상대 (백)';
    roomBadgeEl.classList.remove('hidden');
    roomBadgeCodeEl.textContent = roomId;

    showGameScreen();
    drawBoard();
    updateUI();
    startPolling();
    pollRoom();
  }

  function goToMenu() {
    stopPolling();
    onlineRoomId = null;
    onlineMyColor = null;
    gameMode = null;

    menuEl.classList.remove('hidden');
    gameEl.classList.add('hidden');
    onlineLobbyEl.classList.add('hidden');
    overlayEl.classList.add('hidden');
    lobbyWaitingEl.classList.add('hidden');
    panelCreateEl.classList.remove('hidden');
    panelJoinEl.classList.add('hidden');
    hideLobbyError();
  }

  function showOnlineLobby() {
    menuEl.classList.add('hidden');
    onlineLobbyEl.classList.remove('hidden');
    lobbyWaitingEl.classList.add('hidden');
    panelCreateEl.classList.remove('hidden');
    panelJoinEl.classList.add('hidden');
    hideLobbyError();
  }

  function showLobbyError(msg) {
    lobbyErrorEl.textContent = msg;
    lobbyErrorEl.classList.remove('hidden');
  }

  function hideLobbyError() {
    lobbyErrorEl.classList.add('hidden');
    lobbyErrorEl.textContent = '';
  }

  function showWaitingRoom(roomId) {
    panelCreateEl.classList.add('hidden');
    panelJoinEl.classList.add('hidden');
    lobbyWaitingEl.classList.remove('hidden');
    roomCodeTextEl.textContent = roomId;
    waitingStatusEl.textContent = '상대를 기다리는 중...';
    onlineRoomId = roomId;

    waitPollTimer = setInterval(async () => {
      try {
        const state = await fetchRoomState(roomId);
        if (state.status === 'playing') {
          stopPolling();
          startOnlineGame(roomId, 'black');
        }
      } catch {
        /* keep waiting */
      }
    }, POLL_INTERVAL);
  }

  canvas.addEventListener('click', (e) => {
    if (gameMode === 'pvc' && currentPlayer === WHITE) return;
    if (gameMode === 'online' && currentPlayer !== onlineMyColor) return;
    const pos = canvasToBoard(e.clientX, e.clientY);
    if (pos) placeStone(pos.row, pos.col);
  });

  canvas.addEventListener('mousemove', (e) => {
    if (gameOver || aiThinking) {
      canvas.style.cursor = 'default';
      return;
    }
    if (gameMode === 'pvc' && currentPlayer === WHITE) {
      canvas.style.cursor = 'wait';
      return;
    }
    if (gameMode === 'online' && currentPlayer !== onlineMyColor) {
      canvas.style.cursor = 'default';
      return;
    }
    const pos = canvasToBoard(e.clientX, e.clientY);
    canvas.style.cursor = (pos && board[pos.row][pos.col] === EMPTY) ? 'pointer' : 'default';
  });

  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.dataset.mode === 'online') {
        showOnlineLobby();
      } else {
        startGame(btn.dataset.mode);
      }
    });
  });

  document.querySelectorAll('.lobby-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.lobby-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const isCreate = tab.dataset.tab === 'create';
      panelCreateEl.classList.toggle('hidden', !isCreate);
      panelJoinEl.classList.toggle('hidden', isCreate);
      lobbyWaitingEl.classList.add('hidden');
      hideLobbyError();
    });
  });

  document.getElementById('lobby-back-btn').addEventListener('click', goToMenu);
  document.getElementById('cancel-wait-btn').addEventListener('click', () => {
    stopPolling();
    onlineRoomId = null;
    lobbyWaitingEl.classList.add('hidden');
    panelCreateEl.classList.remove('hidden');
    hideLobbyError();
  });

  document.getElementById('create-room-btn').addEventListener('click', async () => {
    hideLobbyError();
    try {
      const { roomId } = await createOnlineRoom();
      showWaitingRoom(roomId);
    } catch (err) {
      showLobbyError(err.message);
    }
  });

  document.getElementById('join-room-btn').addEventListener('click', async () => {
    hideLobbyError();
    const code = document.getElementById('room-code-input').value.trim().toUpperCase();
    if (code.length !== 6) {
      showLobbyError('6자리 방 코드를 입력하세요.');
      return;
    }
    try {
      const result = await joinOnlineRoom(code);
      stopPolling();
      startOnlineGame(code, result.color);
    } catch (err) {
      const messages = {
        ROOM_NOT_FOUND: '방을 찾을 수 없습니다.',
        ROOM_FULL: '방이 가득 찼습니다.',
      };
      showLobbyError(messages[err.message] || err.message);
    }
  });

  document.getElementById('copy-code-btn').addEventListener('click', async () => {
    const ok = await copyRoomCode(roomCodeTextEl.textContent);
    waitingStatusEl.textContent = ok ? '코드가 복사되었습니다!' : '복사 실패';
    setTimeout(() => {
      waitingStatusEl.textContent = '상대를 기다리는 중...';
    }, 2000);
  });

  document.getElementById('room-code-input').addEventListener('input', (e) => {
    e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
  });

  undoBtn.addEventListener('click', undo);
  restartBtn.addEventListener('click', () => startGame(gameMode));
  menuBtn.addEventListener('click', goToMenu);
  playAgainBtn.addEventListener('click', () => {
    if (gameMode === 'online') {
      goToMenu();
      showOnlineLobby();
    } else {
      startGame(gameMode);
    }
  });
  backMenuBtn.addEventListener('click', goToMenu);
})();
