import {
  createOnlineRoom,
  joinOnlineRoom,
  spectateRoom,
  fetchRoomState,
  fetchRoomList,
  sendOnlineMove,
  copyRoomCode,
  sanitizeName,
  savePlayerName,
  saveLocalNames,
  getLocalNames,
} from './online.js';
import {
  login,
  register,
  logout,
  checkSession,
  enterGuestMode,
  isLoggedIn,
  isGuestMode,
  getCurrentUser,
} from './auth.js';

(() => {
  const SIZE = 15;
  const EMPTY = 0;
  const BLACK = 1;
  const WHITE = 2;

  const canvas = document.getElementById('board');
  const ctx = canvas.getContext('2d');
  const authScreenEl = document.getElementById('auth-screen');
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
  const roomBadgeNameEl = document.getElementById('room-badge-name');
  const spectatorBadgeEl = document.getElementById('spectator-badge');
  const lobbyErrorEl = document.getElementById('lobby-error');
  const lobbyWaitingEl = document.getElementById('lobby-waiting');
  const roomCodeTextEl = document.getElementById('room-code-text');
  const waitingStatusEl = document.getElementById('waiting-status');
  const panelCreateEl = document.getElementById('panel-create');
  const panelJoinEl = document.getElementById('panel-join');
  const panelListEl = document.getElementById('panel-list');
  const roomListEl = document.getElementById('room-list');
  const storageWarningEl = document.getElementById('storage-warning');
  const roomNameInput = document.getElementById('room-name-input');
  const waitingRoomTitleEl = document.getElementById('waiting-room-title');
  const nameBlackInput = document.getElementById('name-black');
  const nameWhiteInput = document.getElementById('name-white');
  const nameWhiteField = document.getElementById('name-white-field');
  const onlineNameInput = document.getElementById('online-name');
  const onlineNameSetup = document.getElementById('online-name-setup');
  const userBarEl = document.getElementById('user-bar');
  const userGreetingEl = document.getElementById('user-greeting');
  const authErrorEl = document.getElementById('auth-error');
  const authTitleEl = document.getElementById('auth-title');
  const authSubmitBtn = document.getElementById('auth-submit-btn');
  const authUsernameInput = document.getElementById('auth-username');
  const authPasswordInput = document.getElementById('auth-password');

  let authMode = 'login';

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
  let onlineRoomName = '';
  let onlineMyColor = null;
  let isSpectator = false;
  let onlineNames = { black: '흑', white: '백' };
  let pollTimer = null;
  let waitPollTimer = null;
  let roomListTimer = null;
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
    if (roomListTimer) {
      clearInterval(roomListTimer);
      roomListTimer = null;
    }
  }

  function switchLobbyTab(tab) {
    document.querySelectorAll('.lobby-tab').forEach(t => {
      t.classList.toggle('active', t.dataset.tab === tab);
    });
    panelListEl.classList.toggle('hidden', tab !== 'list');
    panelCreateEl.classList.toggle('hidden', tab !== 'create');
    panelJoinEl.classList.toggle('hidden', tab !== 'join');
    lobbyWaitingEl.classList.add('hidden');
    hideLobbyError();

    if (tab === 'list') {
      refreshRoomList();
      if (!roomListTimer) {
        roomListTimer = setInterval(refreshRoomList, 3000);
      }
    } else if (tab === 'create' && isLoggedIn()) {
      if (!roomNameInput.value.trim()) {
        roomNameInput.placeholder = `${getCurrentUser().username}의 방`;
      }
    } else if (roomListTimer) {
      clearInterval(roomListTimer);
      roomListTimer = null;
    }
  }

  async function refreshRoomList() {
    try {
      const { rooms, redisConfigured } = await fetchRoomList();
      if (!redisConfigured) {
        storageWarningEl.textContent = '⚠️ Upstash Redis 미연결 — Vercel Storage에서 Redis를 연결하고 재배포해 주세요. (로컬/AI/같은기기 대전은 가능)';
        storageWarningEl.classList.remove('hidden');
      } else {
        storageWarningEl.classList.add('hidden');
      }

      if (rooms.length === 0) {
        roomListEl.innerHTML = '<li class="room-list-empty">참가·관전 가능한 방이 없습니다.</li>';
        return;
      }

      roomListEl.innerHTML = rooms.map(room => {
        const isPlaying = room.status === 'playing';
        const meta = isPlaying
          ? `${room.id} · ${escapeHtml(room.blackName)} vs ${escapeHtml(room.whiteName || '?')} · ${room.moveCount}수`
          : `${room.id} · 방장: ${escapeHtml(room.blackName)}`;
        const actionLabel = isPlaying ? '👁 관전' : '참가 →';
        const actionClass = isPlaying ? 'spectate' : 'join';
        return `
        <li class="room-list-item" data-room-id="${room.id}" data-action="${actionClass}">
          <div>
            <div class="room-list-name">${escapeHtml(room.roomName || room.id)}</div>
            <div class="room-list-meta">${meta}${room.spectatorCount ? ` · 관전 ${room.spectatorCount}명` : ''}</div>
          </div>
          <span class="room-list-status ${actionClass}">${actionLabel}</span>
        </li>`;
      }).join('');

      roomListEl.querySelectorAll('.room-list-item').forEach(item => {
        item.addEventListener('click', () => {
          if (item.dataset.action === 'spectate') {
            spectateRoomById(item.dataset.roomId);
          } else {
            joinRoomById(item.dataset.roomId);
          }
        });
      });
    } catch (err) {
      roomListEl.innerHTML = `<li class="room-list-empty">${err.message}</li>`;
    }
  }

  async function spectateRoomById(roomId) {
    hideLobbyError();
    try {
      const result = await spectateRoom(roomId);
      stopPolling();
      if (result.role === 'black' || result.role === 'white') {
        startOnlineGame(roomId, result.role, result);
      } else {
        startSpectateGame(roomId, result);
      }
    } catch (err) {
      showLobbyError(err.message);
      refreshRoomList();
    }
  }

  async function joinRoomById(roomId) {
    hideLobbyError();
    const playerName = getOnlineName();
    if (!playerName) {
      showLobbyError('닉네임을 입력하세요.');
      return;
    }
    savePlayerName(playerName);
    try {
      const result = await joinOnlineRoom(roomId, playerName);
      stopPolling();
      startOnlineGame(roomId, result.color, result);
    } catch (err) {
      showLobbyError(err.message);
      refreshRoomList();
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

  function loadSavedNames() {
    const names = getLocalNames();
    nameBlackInput.value = names.black === '플레이어 1' ? '' : names.black;
    nameWhiteInput.value = names.white === '플레이어 2' ? '' : names.white;
    onlineNameInput.value = nameBlackInput.value;
  }

  function getOnlineName() {
    if (isLoggedIn()) return sanitizeName(getCurrentUser().username, '');
    return sanitizeName(onlineNameInput.value, '');
  }

  function getLocalBlackName() {
    return sanitizeName(nameBlackInput.value, '플레이어 1');
  }

  function getLocalWhiteName() {
    return sanitizeName(nameWhiteInput.value, '플레이어 2');
  }

  function updatePlayerLabels(blackLabel, whiteLabel) {
    blackNameEl.textContent = blackLabel;
    whiteNameEl.textContent = whiteLabel;
  }

  function updateOnlineNamesFromState(state) {
    onlineNames = {
      black: state.blackName || '흑',
      white: state.whiteName || '백',
    };
    updatePlayerLabels(onlineNames.black, onlineNames.white);
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function updateRoomBadge(name, code) {
    onlineRoomName = name || code || '';
    roomBadgeNameEl.textContent = onlineRoomName;
    roomBadgeCodeEl.textContent = code || '';
  }

  function applyRemoteState(state) {
    board = state.board;
    currentPlayer = state.currentPlayer;
    lastMove = state.lastMove;
    gameOver = state.status === 'finished';
    lastSyncedMoveCount = state.moveCount;
    updateOnlineNamesFromState(state);
    if (state.roomName) updateRoomBadge(state.roomName, state.id);

    if (gameOver && state.winner) {
      if (isSpectator) {
        showSpectatorResult(state.winner);
      } else {
        const iWon = state.winner === onlineMyColor;
        showOnlineResult(iWon, state.winner);
      }
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
      } else if (state.status === 'playing' && (gameMode === 'online' || gameMode === 'spectate') && !gameEl.classList.contains('hidden')) {
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
    if (gameMode === 'spectate') return false;
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

    if (gameMode === 'spectate') {
      const turnName = currentPlayer === BLACK ? onlineNames.black : onlineNames.white;
      statusEl.textContent = `${turnName}님 차례 (관전 중)`;
    } else if (aiThinking) {
      statusEl.textContent = 'AI 생각 중...';
    } else if (gameMode === 'online') {
      const myName = onlineMyColor === BLACK ? onlineNames.black : onlineNames.white;
      if (currentPlayer === onlineMyColor) {
        statusEl.textContent = `${myName}님 차례`;
      } else {
        const oppName = onlineMyColor === BLACK ? onlineNames.white : onlineNames.black;
        statusEl.textContent = `${oppName}님 차례...`;
      }
    } else if (gameMode === 'pvc') {
      statusEl.textContent = currentPlayer === BLACK
        ? `${getLocalBlackName()}님 차례`
        : 'AI 차례';
    } else {
      statusEl.textContent = currentPlayer === BLACK
        ? `${getLocalBlackName()}님 차례`
        : `${getLocalWhiteName()}님 차례`;
    }

    const canUndo = gameMode !== 'online' && gameMode !== 'spectate' && history.length > 0 && !aiThinking;
    undoBtn.disabled = !canUndo;
    undoBtn.classList.toggle('hidden', gameMode === 'online' || gameMode === 'spectate');

    restartBtn.classList.toggle('hidden', gameMode === 'online' || gameMode === 'spectate');
    spectatorBadgeEl.classList.toggle('hidden', gameMode !== 'spectate');
  }

  function showSpectatorResult(winner) {
    const winnerName = winner === BLACK ? onlineNames.black : onlineNames.white;
    resultTitleEl.textContent = '게임 종료';
    resultMessageEl.textContent = `${winnerName}님 승리`;
    overlayEl.classList.remove('hidden');
  }

  function showOnlineResult(iWon, winner) {
    const winnerName = winner === BLACK ? onlineNames.black : onlineNames.white;
    resultTitleEl.textContent = iWon ? '승리!' : '패배';
    resultMessageEl.textContent = iWon
      ? '축하합니다! 승리했습니다!'
      : `${winnerName}님 승리`;
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
      const winnerName = isBlack ? getLocalBlackName() : getLocalWhiteName();
      resultTitleEl.textContent = '승리!';
      resultMessageEl.textContent = `${winnerName}님 승리!`;
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
    isSpectator = false;

    roomBadgeEl.classList.add('hidden');
    spectatorBadgeEl.classList.add('hidden');

    if (mode === 'pvc') {
      saveLocalNames(nameBlackInput.value, nameWhiteInput.value);
      updatePlayerLabels(getLocalBlackName(), 'AI');
    } else if (mode === 'online') {
      updatePlayerLabels(onlineNames.black, onlineNames.white);
      roomBadgeEl.classList.remove('hidden');
      roomBadgeCodeEl.textContent = onlineRoomId;
      startPolling();
    } else {
      saveLocalNames(nameBlackInput.value, nameWhiteInput.value);
      updatePlayerLabels(getLocalBlackName(), getLocalWhiteName());
    }

    showGameScreen();
    drawBoard();
    updateUI();
  }

  function startSpectateGame(roomId, state) {
    onlineRoomId = roomId;
    onlineMyColor = null;
    isSpectator = true;
    gameMode = 'spectate';
    initBoard();
    stopPolling();

    updateOnlineNamesFromState(state);
    roomBadgeEl.classList.remove('hidden');
    spectatorBadgeEl.classList.remove('hidden');
    updateRoomBadge(state?.roomName, roomId);

    showGameScreen();
    applyRemoteState(state);
    startPolling();
  }

  function startOnlineGame(roomId, myColor, state) {
    onlineRoomId = roomId;
    onlineMyColor = myColor === 'black' ? BLACK : WHITE;
    isSpectator = false;
    gameMode = 'online';
    initBoard();
    stopPolling();

    if (state) {
      updateOnlineNamesFromState(state);
    } else {
      updatePlayerLabels(
        onlineMyColor === BLACK ? getOnlineName() : '상대',
        onlineMyColor === WHITE ? getOnlineName() : '상대'
      );
    }

    roomBadgeEl.classList.remove('hidden');
    spectatorBadgeEl.classList.add('hidden');
    updateRoomBadge(state?.roomName, roomId);

    showGameScreen();
    if (state) applyRemoteState(state);
    else {
      drawBoard();
      updateUI();
    }
    startPolling();
    if (!state) pollRoom();
  }

  function goToMenu() {
    stopPolling();
    onlineRoomId = null;
    onlineMyColor = null;
    isSpectator = false;
    gameMode = null;
    nameWhiteField.classList.remove('hidden');

    authScreenEl.classList.add('hidden');
    menuEl.classList.remove('hidden');
    gameEl.classList.add('hidden');
    onlineLobbyEl.classList.add('hidden');
    overlayEl.classList.add('hidden');
    lobbyWaitingEl.classList.add('hidden');
    panelCreateEl.classList.remove('hidden');
    panelJoinEl.classList.add('hidden');
    roomBadgeEl.classList.add('hidden');
    spectatorBadgeEl.classList.add('hidden');
    hideLobbyError();
    updateUserBar();
  }

  function showAuthScreen(message) {
    authScreenEl.classList.remove('hidden');
    menuEl.classList.add('hidden');
    gameEl.classList.add('hidden');
    onlineLobbyEl.classList.add('hidden');
    overlayEl.classList.add('hidden');
    if (message) showAuthError(message);
  }

  function showAuthError(msg) {
    authErrorEl.textContent = msg;
    authErrorEl.classList.remove('hidden');
  }

  function hideAuthError() {
    authErrorEl.classList.add('hidden');
    authErrorEl.textContent = '';
  }

  function applyUserToNames() {
    if (isLoggedIn()) {
      const username = getCurrentUser().username;
      nameBlackInput.value = username;
      onlineNameInput.value = username;
      onlineNameSetup.classList.add('hidden');
    } else {
      onlineNameSetup.classList.remove('hidden');
    }
  }

  function updateUserBar() {
    if (isLoggedIn()) {
      userGreetingEl.textContent = `👤 ${getCurrentUser().username}님`;
      document.getElementById('logout-btn').textContent = '로그아웃';
    } else if (isGuestMode()) {
      userGreetingEl.textContent = '게스트 모드';
      document.getElementById('logout-btn').textContent = '로그인';
    }
  }

  function enterMenuAsGuest() {
    enterGuestMode();
    authScreenEl.classList.add('hidden');
    menuEl.classList.remove('hidden');
    applyUserToNames();
    updateUserBar();
  }

  function enterMenuAsUser() {
    authScreenEl.classList.add('hidden');
    menuEl.classList.remove('hidden');
    applyUserToNames();
    updateUserBar();
  }

  function showOnlineLobby() {
    if (!isLoggedIn()) {
      showAuthScreen('온라인 대전은 로그인 후 이용할 수 있습니다.');
      return;
    }
    menuEl.classList.add('hidden');
    onlineLobbyEl.classList.remove('hidden');
    applyUserToNames();
    switchLobbyTab('list');
  }

  function showLobbyError(msg) {
    lobbyErrorEl.textContent = msg;
    lobbyErrorEl.classList.remove('hidden');
  }

  function hideLobbyError() {
    lobbyErrorEl.classList.add('hidden');
    lobbyErrorEl.textContent = '';
  }

  function showWaitingRoom(roomId, roomName) {
    if (roomListTimer) {
      clearInterval(roomListTimer);
      roomListTimer = null;
    }
    panelListEl.classList.add('hidden');
    panelCreateEl.classList.add('hidden');
    panelJoinEl.classList.add('hidden');
    lobbyWaitingEl.classList.remove('hidden');
    roomCodeTextEl.textContent = roomId;
    waitingRoomTitleEl.textContent = roomName || roomId;
    waitingStatusEl.textContent = '상대를 기다리는 중...';
    onlineRoomId = roomId;
    onlineRoomName = roomName || '';

    waitPollTimer = setInterval(async () => {
      try {
        const state = await fetchRoomState(roomId);
        if (state.status === 'playing') {
          stopPolling();
          startOnlineGame(roomId, 'black', state);
        }
      } catch {
        /* keep waiting */
      }
    }, POLL_INTERVAL);
  }

  canvas.addEventListener('click', (e) => {
    if (gameMode === 'pvc' && currentPlayer === WHITE) return;
    if (gameMode === 'online' && currentPlayer !== onlineMyColor) return;
    if (gameMode === 'spectate') return;
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
      } else if (btn.dataset.mode === 'pvc') {
        nameWhiteField.classList.add('hidden');
        if (isLoggedIn()) nameBlackInput.value = getCurrentUser().username;
        startGame(btn.dataset.mode);
      } else {
        nameWhiteField.classList.remove('hidden');
        if (isLoggedIn()) nameBlackInput.value = getCurrentUser().username;
        startGame(btn.dataset.mode);
      }
    });
  });

  document.querySelectorAll('.auth-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      authMode = tab.dataset.auth;
      authTitleEl.textContent = authMode === 'login' ? '로그인' : '회원가입';
      authSubmitBtn.textContent = authMode === 'login' ? '로그인' : '가입하기';
      authPasswordInput.autocomplete = authMode === 'login' ? 'current-password' : 'new-password';
      hideAuthError();
    });
  });

  authSubmitBtn.addEventListener('click', async () => {
    hideAuthError();
    const username = authUsernameInput.value.trim();
    const password = authPasswordInput.value;
    if (!username || !password) {
      showAuthError('아이디와 비밀번호를 입력하세요.');
      return;
    }
    try {
      if (authMode === 'register') {
        await register(username, password);
        await login(username, password);
      } else {
        await login(username, password);
      }
      authPasswordInput.value = '';
      enterMenuAsUser();
    } catch (err) {
      showAuthError(err.message);
    }
  });

  document.getElementById('guest-btn').addEventListener('click', () => {
    hideAuthError();
    enterMenuAsGuest();
  });

  document.getElementById('logout-btn').addEventListener('click', async () => {
    if (isLoggedIn()) {
      await logout();
      showAuthScreen();
    } else {
      showAuthScreen();
    }
  });

  authPasswordInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') authSubmitBtn.click();
  });

  document.querySelectorAll('.lobby-tab').forEach(tab => {
    tab.addEventListener('click', () => switchLobbyTab(tab.dataset.tab));
  });

  document.getElementById('refresh-room-list-btn').addEventListener('click', refreshRoomList);

  document.getElementById('lobby-back-btn').addEventListener('click', goToMenu);
  document.getElementById('cancel-wait-btn').addEventListener('click', () => {
    stopPolling();
    onlineRoomId = null;
    switchLobbyTab('list');
  });

  document.getElementById('create-room-btn').addEventListener('click', async () => {
    hideLobbyError();
    const playerName = getOnlineName();
    if (!playerName) {
      showLobbyError('닉네임을 입력하세요.');
      onlineNameInput.focus();
      return;
    }
    savePlayerName(playerName);
    const roomName = roomNameInput.value.trim();
    try {
      const { roomId, roomName: createdName } = await createOnlineRoom(playerName, roomName);
      showWaitingRoom(roomId, createdName || roomName || `${playerName}의 방`);
    } catch (err) {
      showLobbyError(err.message);
    }
  });

  document.getElementById('join-room-btn').addEventListener('click', async () => {
    hideLobbyError();
    const playerName = getOnlineName();
    if (!playerName) {
      showLobbyError('닉네임을 입력하세요.');
      onlineNameInput.focus();
      return;
    }
    savePlayerName(playerName);
    const code = document.getElementById('room-code-input').value.trim().toUpperCase();
    if (code.length !== 6) {
      showLobbyError('6자리 방 코드를 입력하세요.');
      return;
    }
    try {
      const result = await joinOnlineRoom(code, playerName);
      stopPolling();
      startOnlineGame(code, result.color, result);
    } catch (err) {
      showLobbyError(err.message);
    }
  });

  document.getElementById('spectate-room-btn').addEventListener('click', async () => {
    hideLobbyError();
    const code = document.getElementById('room-code-input').value.trim().toUpperCase();
    if (code.length !== 6) {
      showLobbyError('6자리 방 코드를 입력하세요.');
      return;
    }
    await spectateRoomById(code);
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
    if (gameMode === 'online' || gameMode === 'spectate') {
      goToMenu();
      showOnlineLobby();
    } else {
      startGame(gameMode);
    }
  });
  backMenuBtn.addEventListener('click', goToMenu);

  nameBlackInput.addEventListener('input', () => {
    onlineNameInput.value = nameBlackInput.value;
  });

  onlineNameInput.addEventListener('input', () => {
    nameBlackInput.value = onlineNameInput.value;
  });

  async function initApp() {
    loadSavedNames();
    const user = await checkSession();
    if (user) enterMenuAsUser();
    else showAuthScreen();
  }

  initApp();
})();
