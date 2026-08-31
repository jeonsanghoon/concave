const AI = (() => {
  const SIZE = 15;
  const EMPTY = 0;
  const BLACK = 1;
  const WHITE = 2;

  const DIRECTIONS = [
    [0, 1], [1, 0], [1, 1], [1, -1]
  ];

  const SCORE = {
    FIVE: 100000,
    OPEN_FOUR: 10000,
    CLOSED_FOUR: 1000,
    OPEN_THREE: 1000,
    CLOSED_THREE: 100,
    OPEN_TWO: 100,
    CLOSED_TWO: 10,
    ONE: 1
  };

  function countLine(board, row, col, dr, dc, player) {
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

  function evaluatePoint(board, row, col, player) {
    if (board[row][col] !== EMPTY) return 0;

    let score = 0;
    const opponent = player === BLACK ? WHITE : BLACK;

    for (const [dr, dc] of DIRECTIONS) {
      const forward = countLine(board, row, col, dr, dc, player);
      const backward = countLine(board, row, col, -dr, -dc, player);
      const total = forward + backward + 1;

      const fEndR = row + (forward + 1) * dr;
      const fEndC = col + (forward + 1) * dc;
      const bEndR = row - (backward + 1) * dr;
      const bEndC = col - (backward + 1) * dc;

      const fOpen = fEndR >= 0 && fEndR < SIZE && fEndC >= 0 && fEndC < SIZE && board[fEndR][fEndC] === EMPTY;
      const bOpen = bEndR >= 0 && bEndR < SIZE && bEndC >= 0 && bEndC < SIZE && board[bEndR][bEndC] === EMPTY;

      if (total >= 5) {
        score += SCORE.FIVE;
      } else if (total === 4) {
        score += (fOpen && bOpen) ? SCORE.OPEN_FOUR : SCORE.CLOSED_FOUR;
      } else if (total === 3) {
        score += (fOpen && bOpen) ? SCORE.OPEN_THREE : SCORE.CLOSED_THREE;
      } else if (total === 2) {
        score += (fOpen && bOpen) ? SCORE.OPEN_TWO : SCORE.CLOSED_TWO;
      } else if (total === 1) {
        score += SCORE.ONE;
      }

      // Block opponent threats
      const oppForward = countLine(board, row, col, dr, dc, opponent);
      const oppBackward = countLine(board, row, col, -dr, -dc, opponent);
      const oppTotal = oppForward + oppBackward + 1;

      if (oppTotal >= 4) {
        score += SCORE.OPEN_FOUR * 0.95;
      } else if (oppTotal === 3) {
        const ofOpen = fEndR >= 0 && fEndR < SIZE && fEndC >= 0 && fEndC < SIZE && board[fEndR][fEndC] === EMPTY;
        const obOpen = bEndR >= 0 && bEndR < SIZE && bEndC >= 0 && bEndC < SIZE && board[bEndR][bEndC] === EMPTY;
        if (ofOpen && obOpen) score += SCORE.OPEN_THREE * 0.9;
      }
    }

    // Prefer center
    const centerDist = Math.abs(row - 7) + Math.abs(col - 7);
    score += (14 - centerDist) * 2;

    return score;
  }

  function getCandidateMoves(board) {
    const candidates = new Set();
    let hasStone = false;

    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        if (board[r][c] !== EMPTY) {
          hasStone = true;
          for (let dr = -2; dr <= 2; dr++) {
            for (let dc = -2; dc <= 2; dc++) {
              const nr = r + dr;
              const nc = c + dc;
              if (nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE && board[nr][nc] === EMPTY) {
                candidates.add(`${nr},${nc}`);
              }
            }
          }
        }
      }
    }

    if (!hasStone) {
      return [{ row: 7, col: 7 }];
    }

    return Array.from(candidates).map(key => {
      const [row, col] = key.split(',').map(Number);
      return { row, col };
    });
  }

  function findWinningMove(board, player) {
    const candidates = getCandidateMoves(board);
    for (const { row, col } of candidates) {
      board[row][col] = player;
      if (checkWinAt(board, row, col, player)) {
        board[row][col] = EMPTY;
        return { row, col };
      }
      board[row][col] = EMPTY;
    }
    return null;
  }

  function checkWinAt(board, row, col, player) {
    for (const [dr, dc] of DIRECTIONS) {
      let count = 1;
      count += countLine(board, row, col, dr, dc, player);
      count += countLine(board, row, col, -dr, -dc, player);
      if (count >= 5) return true;
    }
    return false;
  }

  function getBestMove(board, aiPlayer) {
    const winMove = findWinningMove(board, aiPlayer);
    if (winMove) return winMove;

    const opponent = aiPlayer === BLACK ? WHITE : BLACK;
    const blockMove = findWinningMove(board, opponent);
    if (blockMove) return blockMove;

    const candidates = getCandidateMoves(board);
    let bestScore = -Infinity;
    let bestMove = candidates[0];

    for (const { row, col } of candidates) {
      const attackScore = evaluatePoint(board, row, col, aiPlayer);
      const defenseScore = evaluatePoint(board, row, col, opponent);
      const total = attackScore + defenseScore * 0.95;

      if (total > bestScore) {
        bestScore = total;
        bestMove = { row, col };
      }
    }

    return bestMove;
  }

  return { getBestMove, SIZE, BLACK, WHITE, EMPTY };
})();
