/**
 * AI模块 - 极大极小搜索 + Alpha-Beta剪枝
 */

class GomokuAI {
  constructor(size = 15) {
    this.size = size;
    this.scores = {
      FIVE: 10000000,
      LIVE_FOUR: 1000000,
      RUSH_FOUR: 500000,
      LIVE_THREE: 50000,
      SLEEP_THREE: 5000,
      LIVE_TWO: 5000,
      SLEEP_TWO: 500,
      LIVE_ONE: 100,
      SLEEP_ONE: 10
    };
    this.maxDepth = 2;
  }

  setDifficulty(level) {
    switch (level) {
      case 'easy': this.maxDepth = 1; break;
      case 'normal': this.maxDepth = 2; break;
      case 'hard': this.maxDepth = 3; break;
    }
  }

  getMove(boardState, aiPlayer) {
    const humanPlayer = aiPlayer === 1 ? 2 : 1;
    const emptySpots = this.getCandidateMoves(boardState);

    if (emptySpots.length === 0) {
      return { row: 7, col: 7 };
    }

    const totalStones = boardState.flat().filter(v => v !== 0).length;
    if (totalStones === 0) {
      return { row: 7, col: 7 };
    }

    // 必杀/必防检查
    for (const [r, c] of emptySpots) {
      boardState[r][c] = aiPlayer;
      if (this.checkWin(boardState, r, c, aiPlayer)) {
        boardState[r][c] = 0;
        return { row: r, col: c };
      }
      boardState[r][c] = 0;

      boardState[r][c] = humanPlayer;
      if (this.checkWin(boardState, r, c, humanPlayer)) {
        boardState[r][c] = 0;
        return { row: r, col: c };
      }
      boardState[r][c] = 0;
    }

    let bestScore = -Infinity;
    let bestMove = emptySpots[0];

    for (const [r, c] of emptySpots) {
      boardState[r][c] = aiPlayer;
      const score = this.minimax(
        boardState, this.maxDepth - 1, -Infinity, Infinity, false, aiPlayer
      );
      boardState[r][c] = 0;

      if (score > bestScore) {
        bestScore = score;
        bestMove = [r, c];
      }
    }

    return { row: bestMove[0], col: bestMove[1] };
  }

  minimax(board, depth, alpha, beta, isMaximizing, aiPlayer) {
    const humanPlayer = aiPlayer === 1 ? 2 : 1;

    if (depth === 0) {
      return this.evaluateBoard(board, aiPlayer);
    }

    const moves = this.getCandidateMoves(board);
    const scoredMoves = moves.map(([r, c]) => {
      board[r][c] = aiPlayer;
      const s1 = this.evaluatePoint(board, r, c, aiPlayer);
      board[r][c] = humanPlayer;
      const s2 = this.evaluatePoint(board, r, c, humanPlayer);
      board[r][c] = 0;
      return { move: [r, c], score: s1 + s2 };
    });
    scoredMoves.sort((a, b) => b.score - a.score);
    const topMoves = scoredMoves.slice(0, 10).map(m => m.move);

    if (isMaximizing) {
      let maxEval = -Infinity;
      for (const [r, c] of topMoves) {
        board[r][c] = aiPlayer;
        if (this.checkWin(board, r, c, aiPlayer)) {
          board[r][c] = 0;
          return this.scores.FIVE;
        }
        const eval_ = this.minimax(board, depth - 1, alpha, beta, false, aiPlayer);
        board[r][c] = 0;
        maxEval = Math.max(maxEval, eval_);
        alpha = Math.max(alpha, eval_);
        if (beta <= alpha) break;
      }
      return maxEval;
    } else {
      let minEval = Infinity;
      for (const [r, c] of topMoves) {
        board[r][c] = humanPlayer;
        if (this.checkWin(board, r, c, humanPlayer)) {
          board[r][c] = 0;
          return -this.scores.FIVE;
        }
        const eval_ = this.minimax(board, depth - 1, alpha, beta, true, aiPlayer);
        board[r][c] = 0;
        minEval = Math.min(minEval, eval_);
        beta = Math.min(beta, eval_);
        if (beta <= alpha) break;
      }
      return minEval;
    }
  }

  getCandidateMoves(board) {
    const candidates = new Set();
    const range = 2;

    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        if (board[r][c] !== 0) {
          for (let dr = -range; dr <= range; dr++) {
            for (let dc = -range; dc <= range; dc++) {
              const nr = r + dr;
              const nc = c + dc;
              if (nr >= 0 && nr < this.size && nc >= 0 && nc < this.size && board[nr][nc] === 0) {
                candidates.add(nr * this.size + nc);
              }
            }
          }
        }
      }
    }

    return Array.from(candidates).map(v => [Math.floor(v / this.size), v % this.size]);
  }

  evaluateBoard(board, aiPlayer) {
    let score = 0;
    const humanPlayer = aiPlayer === 1 ? 2 : 1;

    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        if (board[r][c] === aiPlayer) {
          score += this.evaluatePoint(board, r, c, aiPlayer);
        } else if (board[r][c] === humanPlayer) {
          score -= this.evaluatePoint(board, r, c, humanPlayer);
        }
      }
    }

    return score;
  }

  evaluatePoint(board, row, col, player) {
    let totalScore = 0;
    const directions = [[0, 1], [1, 0], [1, 1], [1, -1]];

    for (const [dr, dc] of directions) {
      const pattern = this.getPattern(board, row, col, dr, dc, player);
      totalScore += this.scorePattern(pattern);
    }

    return totalScore;
  }

  getPattern(board, row, col, dr, dc, player) {
    const opponent = player === 1 ? 2 : 1;
    let count = 1;
    let block = 0;
    let empty1 = 0;
    let empty2 = 0;

    let r = row + dr, c = col + dc;
    let foundEmpty = false;
    while (this.inBounds(r, c) && board[r][c] !== opponent) {
      if (board[r][c] === player) {
        if (foundEmpty) {
          empty2++;
        } else {
          count++;
        }
      } else if (board[r][c] === 0) {
        if (!foundEmpty) {
          foundEmpty = true;
        } else {
          break;
        }
      }
      r += dr;
      c += dc;
    }
    if (!this.inBounds(r, c) || board[r][c] === opponent) {
      if (!foundEmpty) block++;
    }

    r = row - dr; c = col - dc;
    foundEmpty = false;
    while (this.inBounds(r, c) && board[r][c] !== opponent) {
      if (board[r][c] === player) {
        if (foundEmpty) {
          empty1++;
        } else {
          count++;
        }
      } else if (board[r][c] === 0) {
        if (!foundEmpty) {
          foundEmpty = true;
        } else {
          break;
        }
      }
      r -= dr;
      c -= dc;
    }
    if (!this.inBounds(r, c) || board[r][c] === opponent) {
      if (!foundEmpty) block++;
    }

    return { count, block, empty1, empty2 };
  }

  scorePattern(pattern) {
    const { count, block, empty1, empty2 } = pattern;

    if (count >= 5) return this.scores.FIVE;
    if (block === 2 && empty1 === 0 && empty2 === 0) return 0;
    if (count === 4 && block === 0) return this.scores.LIVE_FOUR;
    if (count === 4 && block === 1) return this.scores.RUSH_FOUR;
    if (count === 3 && block === 0) return this.scores.LIVE_THREE;
    if (count === 3 && block === 1) return this.scores.SLEEP_THREE;
    if (count === 3 && block === 0 && (empty1 > 0 || empty2 > 0)) return this.scores.LIVE_THREE;
    if (count === 2 && block === 0) return this.scores.LIVE_TWO;
    if (count === 2 && block === 1) return this.scores.SLEEP_TWO;
    if (count === 1 && block === 0) return this.scores.LIVE_ONE;
    if (count === 1 && block === 1) return this.scores.SLEEP_ONE;

    return 0;
  }

  checkWin(board, row, col, player) {
    const directions = [[0, 1], [1, 0], [1, 1], [1, -1]];

    for (const [dr, dc] of directions) {
      let count = 1;

      let r = row + dr, c = col + dc;
      while (this.inBounds(r, c) && board[r][c] === player) {
        count++;
        r += dr;
        c += dc;
      }

      r = row - dr; c = col - dc;
      while (this.inBounds(r, c) && board[r][c] === player) {
        count++;
        r -= dr;
        c -= dc;
      }

      if (count >= 5) return true;
    }

    return false;
  }

  getWinLine(board, row, col, player) {
    const directions = [[0, 1], [1, 0], [1, 1], [1, -1]];

    for (const [dr, dc] of directions) {
      const line = [[row, col]];

      let r = row + dr, c = col + dc;
      while (this.inBounds(r, c) && board[r][c] === player) {
        line.push([r, c]);
        r += dr;
        c += dc;
      }

      r = row - dr; c = col - dc;
      while (this.inBounds(r, c) && board[r][c] === player) {
        line.unshift([r, c]);
        r -= dr;
        c -= dc;
      }

      if (line.length >= 5) return line;
    }

    return null;
  }

  inBounds(r, c) {
    return r >= 0 && r < this.size && c >= 0 && c < this.size;
  }
}
