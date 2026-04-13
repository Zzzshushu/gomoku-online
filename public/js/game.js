/**
 * 五子棋游戏主逻辑
 * 支持人机对战和联机对战
 */

class GomokuGame {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.board = new Board(canvas);
    this.ai = new GomokuAI(15);

    // 游戏状态
    this.mode = 'ai'; // 'ai' | 'online'
    this.boardState = this.createEmptyBoard();
    this.currentPlayer = 1;
    this.gameOver = false;
    this.winner = 0;
    this.moveHistory = [];
    this.hoverPos = null;
    this.aiThinking = false;

    // AI模式设置
    this.difficulty = 'normal';
    this.playerScore = 0;
    this.aiScore = 0;
    this.drawCount = 0;
    this.playerColor = 1;

    // 联机模式设置
    this.onlinePlayerColor = 1;
    this.ws = null;
    this.roomId = null;
    this.isMyTurn = false;

    // 屏幕尺寸
    this.resize();
    this.setupEvents();
  }

  createEmptyBoard() {
    return Array.from({ length: 15 }, () => Array(15).fill(0));
  }

  setMode(mode) {
    this.mode = mode;
    this.resetGame();
  }

  resetGame() {
    this.boardState = this.createEmptyBoard();
    this.currentPlayer = 1;
    this.gameOver = false;
    this.winner = 0;
    this.moveHistory = [];
    this.hoverPos = null;
    this.aiThinking = false;
    this.board.winLine = null;
    this.board.lastMove = null;
    this.render();
  }

  resize() {
    const dpr = window.devicePixelRatio || 1;
    const parent = this.canvas.parentElement;
    const screenW = parent ? parent.clientWidth : 400;
    const screenH = parent ? parent.clientHeight : 500;

    this.canvas.width = screenW * dpr;
    this.canvas.height = screenH * dpr;
    this.canvas.style.width = screenW + 'px';
    this.canvas.style.height = screenH + 'px';
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    this.board.resize(screenW, screenH, dpr);
    this.render();
  }

  setupEvents() {
    this.canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      if (e.touches.length > 0) {
        const touch = e.touches[0];
        const rect = this.canvas.getBoundingClientRect();
        this.handleTap(touch.clientX - rect.left, touch.clientY - rect.top);
      }
    }, { passive: false });

    this.canvas.addEventListener('click', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      this.handleTap(e.clientX - rect.left, e.clientY - rect.top);
    });

    this.canvas.addEventListener('mousemove', (e) => {
      if (this.gameOver || this.aiThinking) return;
      
      // AI模式检查
      if (this.mode === 'ai' && this.currentPlayer !== this.playerColor) return;
      
      // 联机模式检查
      if (this.mode === 'online' && !this.isMyTurn) return;

      const rect = this.canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      if (y < this.board.boardPixelSize + this.board.padding * 2) {
        const { row, col } = this.board.toGrid(x, y);
        if (this.board.inBounds(row, col) && this.boardState[row][col] === 0) {
          this.hoverPos = { row, col };
        } else {
          this.hoverPos = null;
        }
      } else {
        this.hoverPos = null;
      }
      this.render();
    });

    this.canvas.addEventListener('mouseleave', () => {
      this.hoverPos = null;
      this.render();
    });

    window.addEventListener('resize', () => this.resize());
  }

  handleTap(x, y) {
    // 棋盘内点击
    const boardAreaH = this.canvas.height / (window.devicePixelRatio || 1);
    if (y > boardAreaH - 50) return; // 避开底部UI区域

    if (this.gameOver) return;

    // AI模式
    if (this.mode === 'ai') {
      if (this.currentPlayer !== this.playerColor || this.aiThinking) return;
    }

    // 联机模式
    if (this.mode === 'online') {
      if (!this.isMyTurn) {
        showToast('还没轮到你落子', 'info');
        return;
      }
    }

    const { row, col } = this.board.toGrid(x, y);
    if (!this.board.inBounds(row, col)) return;
    if (this.boardState[row][col] !== 0) return;

    if (this.mode === 'ai') {
      this.makeMoveAIMode(row, col);
    } else {
      this.makeMoveOnline(row, col);
    }
  }

  // AI模式落子
  makeMoveAIMode(row, col) {
    this.placeStone(row, col, this.playerColor);

    if (!this.gameOver) {
      this.aiThinking = true;
      this.render();
      setTimeout(() => {
        const aiMove = this.ai.getMove(this.boardState, this.currentPlayer);
        this.placeStone(aiMove.row, aiMove.col, this.currentPlayer);
        this.aiThinking = false;
        this.render();
      }, 150);
    }
  }

  // 联机模式落子
  makeMoveOnline(row, col) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      showToast('网络连接失败', 'error');
      return;
    }

    this.ws.send(JSON.stringify({
      type: 'MAKE_MOVE',
      row: row,
      col: col
    }));
  }

  placeStone(row, col, player) {
    this.boardState[row][col] = player;
    this.moveHistory.push({ row, col, player });
    this.board.lastMove = { row, col };
    this.currentPlayer = player === 1 ? 2 : 1;

    // 检查胜利
    if (this.ai.checkWin(this.boardState, row, col, player)) {
      this.gameOver = true;
      this.winner = player;
      this.board.winLine = this.ai.getWinLine(this.boardState, row, col, player);

      if (this.mode === 'ai') {
        if (player === this.playerColor) {
          this.playerScore++;
        } else {
          this.aiScore++;
        }
      }

      // 联机模式更新轮次
      this.isMyTurn = false;
    } else if (this.moveHistory.length >= 15 * 15) {
      this.gameOver = true;
      this.winner = 0;
      this.isMyTurn = false;

      if (this.mode === 'ai') {
        this.drawCount++;
      }
    }

    this.hoverPos = null;
    this.render();
  }

  // 从服务器接收对手落子
  receiveOpponentMove(row, col) {
    const opponentColor = this.onlinePlayerColor === 1 ? 2 : 1;
    this.placeStone(row, col, opponentColor);
    this.isMyTurn = true;
    this.render();
  }

  // 游戏结束处理
  handleGameOver(winner, winLine, reason) {
    this.gameOver = true;
    this.winner = winner;
    this.isMyTurn = false;
    
    if (winLine) {
      this.board.winLine = winLine;
    }
    
    this.render();
  }

  setDifficulty(level) {
    this.difficulty = level;
    this.ai.setDifficulty(level);
    this.render();
  }

  undo() {
    if (this.mode !== 'ai' || this.moveHistory.length < 2 || this.gameOver) return;
    
    for (let i = 0; i < 2; i++) {
      const move = this.moveHistory.pop();
      this.boardState[move.row][move.col] = 0;
    }
    this.currentPlayer = this.playerColor;
    this.board.lastMove = this.moveHistory.length > 0
      ? this.moveHistory[this.moveHistory.length - 1]
      : null;
    this.board.winLine = null;
    this.render();
  }

  restart() {
    if (this.mode === 'ai') {
      this.resetGame();
      if (this.playerColor === 2) {
        this.aiThinking = true;
        this.render();
        setTimeout(() => {
          const move = this.ai.getMove(this.boardState, 1);
          this.placeStone(move.row, move.col, 1);
          this.aiThinking = false;
          this.render();
        }, 100);
      }
    } else {
      // 联机模式重开
      this.resetGame();
    }
  }

  // ============ 渲染相关 ============
  render() {
    const ctx = this.ctx;
    const dpr = window.devicePixelRatio || 1;
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const screenW = this.canvas.width / dpr;
    const screenH = this.canvas.height / dpr;

    ctx.clearRect(0, 0, screenW, screenH);
    this.board.draw(this.boardState);

    if (this.hoverPos && !this.gameOver && !this.aiThinking) {
      const canShowGhost = this.mode === 'ai' 
        ? this.currentPlayer === this.playerColor 
        : this.isMyTurn;
      
      if (canShowGhost) {
        this.board.drawGhost(this.hoverPos.row, this.hoverPos.col, this.currentPlayer);
      }
    }

    this.drawUI(ctx, screenW, screenH);
    ctx.restore();
  }

  drawUI(ctx, w, h) {
    // 减小UI区域高度，使其更好地适应屏幕
    const uiHeight = 100;
    const y0 = h - uiHeight;

    // 底部背景
    const uiGrad = ctx.createLinearGradient(0, y0, 0, h);
    uiGrad.addColorStop(0, 'rgba(44, 26, 18, 0.95)');
    uiGrad.addColorStop(1, 'rgba(30, 18, 12, 0.98)');
    ctx.fillStyle = uiGrad;
    ctx.fillRect(0, y0, w, uiHeight);

    // 状态信息
    ctx.fillStyle = '#FFF';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (this.mode === 'online' && !this.roomId) {
      ctx.fillText('连接中...', w / 2, y0 + 15);
    } else if (this.gameOver) {
      const myColor = this.mode === 'ai' ? this.playerColor : this.onlinePlayerColor;
      if (this.winner === myColor) {
        ctx.fillStyle = '#FFD700';
        ctx.fillText('🎉 恭喜，你赢了！', w / 2, y0 + 15);
      } else if (this.winner !== 0) {
        ctx.fillStyle = '#FF6B6B';
        ctx.fillText('AI 获胜！再试试？', w / 2, y0 + 15);
      } else {
        ctx.fillStyle = '#90CAF9';
        ctx.fillText('平局！', w / 2, y0 + 15);
      }
    } else if (this.aiThinking) {
      ctx.fillStyle = '#FFB74D';
      ctx.fillText('AI 思考中...', w / 2, y0 + 15);
    } else {
      const isMyTurn = this.mode === 'ai' 
        ? this.currentPlayer === this.playerColor 
        : this.isMyTurn;
      
      if (isMyTurn) {
        ctx.fillStyle = '#4CAF50';
        ctx.fillText('● 轮到你了', w / 2, y0 + 15);
      } else {
        ctx.fillStyle = '#90CAF9';
        ctx.fillText('○ 对手回合', w / 2, y0 + 15);
      }
    }

    // 比分（仅AI模式）
    if (this.mode === 'ai') {
      ctx.font = '11px sans-serif';
      ctx.fillStyle = '#BCAAA4';
      ctx.fillText(
        '比分  你 ' + this.playerScore + ' : ' + this.aiScore + ' AI  |  平 ' + this.drawCount,
        w / 2, y0 + 32
      );
    }

    const gap = w * 0.06;
    const btnW = w * 0.42;
    const btnH = 32;
    const btnY = y0 + 45;

    // 按钮 - 减小尺寸
    this.drawButton(ctx, '悔棋', gap, btnY, btnW, btnH, '#5D4037', '#795548');
    this.drawButton(ctx, '再来一局', w - gap - btnW, btnY, btnW, btnH, '#1B5E20', '#2E7D32');

    // AI难度选择（仅AI模式）
    if (this.mode === 'ai') {
      const diffY = btnY + btnH + 10;
      ctx.font = '10px sans-serif';
      ctx.fillStyle = '#BCAAA4';
      ctx.fillText('难度', w / 2, diffY);

      const diffW = (w - gap * 4) / 3;
      const diffs = [
        { label: '简单', key: 'easy', color: '#1565C0' },
        { label: '普通', key: 'normal', color: '#E65100' },
        { label: '困难', key: 'hard', color: '#B71C1C' }
      ];

      diffs.forEach((d, i) => {
        const dx = gap + i * (diffW + gap);
        const isActive = this.difficulty === d.key;
        const bgColor = isActive ? d.color : '#4E342E';
        this.drawButton(ctx, d.label, dx, diffY + 8, diffW, 24, bgColor, bgColor);
      });
    }
  }

  drawButton(ctx, text, x, y, w, h, color1, color2, textColor = '#FFF') {
    const r = 8;
    ctx.save();

    const grad = ctx.createLinearGradient(x, y, x, y + h);
    grad.addColorStop(0, color1);
    grad.addColorStop(1, color2);
    ctx.fillStyle = grad;

    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = textColor;
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x + w / 2, y + h / 2);
    ctx.restore();
  }
}
