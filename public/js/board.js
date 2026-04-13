/**
 * 棋盘渲染模块
 */

class Board {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.size = 15;
    this.gridSize = 0;
    this.padding = 0;
    this.boardPixelSize = 0;
    this.stoneRadius = 0;
    this.lastMove = null;
    this.winLine = null;
  }

  resize(screenW, screenH, dpr) {
    const w = this.canvas.width;
    const h = this.canvas.height;
    const minDim = Math.min(w, h);
    this.padding = minDim * 0.05;
    this.boardPixelSize = minDim - this.padding * 2;
    this.gridSize = this.boardPixelSize / (this.size - 1);
    this.stoneRadius = this.gridSize * 0.44;
  }

  toPixel(row, col) {
    return {
      x: this.padding + col * this.gridSize,
      y: this.padding + row * this.gridSize
    };
  }

  toGrid(px, py) {
    const col = Math.round((px - this.padding) / this.gridSize);
    const row = Math.round((py - this.padding) / this.gridSize);
    return { row, col };
  }

  inBounds(row, col) {
    return row >= 0 && row < this.size && col >= 0 && col < this.size;
  }

  draw(boardState) {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    // 背景 - 木色渐变
    const bgGrad = ctx.createLinearGradient(0, 0, w, h);
    bgGrad.addColorStop(0, '#DEB887');
    bgGrad.addColorStop(0.5, '#D2A66A');
    bgGrad.addColorStop(1, '#C89B5E');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // 棋盘边框
    const origin = this.toPixel(0, 0);
    const end = this.toPixel(this.size - 1, this.size - 1);
    ctx.strokeStyle = '#5C3A1E';
    ctx.lineWidth = 2;
    const pad = this.gridSize * 0.5;
    ctx.strokeRect(origin.x - pad, origin.y - pad, end.x - origin.x + pad * 2, end.y - origin.y + pad * 2);

    // 网格线
    ctx.strokeStyle = '#5C3A1E';
    ctx.lineWidth = 1;
    for (let i = 0; i < this.size; i++) {
      const start = this.toPixel(i, 0);
      const finish = this.toPixel(i, this.size - 1);
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(finish.x, finish.y);
      ctx.stroke();

      const startV = this.toPixel(0, i);
      const finishV = this.toPixel(this.size - 1, i);
      ctx.beginPath();
      ctx.moveTo(startV.x, startV.y);
      ctx.lineTo(finishV.x, finishV.y);
      ctx.stroke();
    }

    // 星位
    const starPoints = [
      [3, 3], [3, 7], [3, 11],
      [7, 3], [7, 7], [7, 11],
      [11, 3], [11, 7], [11, 11]
    ];
    ctx.fillStyle = '#5C3A1E';
    for (const [r, c] of starPoints) {
      const p = this.toPixel(r, c);
      ctx.beginPath();
      ctx.arc(p.x, p.y, this.gridSize * 0.12, 0, Math.PI * 2);
      ctx.fill();
    }

    // 绘制所有棋子
    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        if (boardState[r][c] !== 0) {
          this.drawStone(r, c, boardState[r][c]);
        }
      }
    }

    // 最后一步标记
    if (this.lastMove) {
      const p = this.toPixel(this.lastMove.row, this.lastMove.col);
      ctx.strokeStyle = '#FF4444';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, this.stoneRadius * 0.35, 0, Math.PI * 2);
      ctx.stroke();
    }

    // 胜利连线
    if (this.winLine) {
      this.drawWinLine(this.winLine);
    }
  }

  drawStone(row, col, player) {
    const ctx = this.ctx;
    const p = this.toPixel(row, col);
    const r = this.stoneRadius;

    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.4)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;

    if (player === 1) {
      const grad = ctx.createRadialGradient(p.x - r * 0.3, p.y - r * 0.3, r * 0.1, p.x, p.y, r);
      grad.addColorStop(0, '#555');
      grad.addColorStop(0.6, '#222');
      grad.addColorStop(1, '#000');
      ctx.fillStyle = grad;
    } else {
      const grad = ctx.createRadialGradient(p.x - r * 0.3, p.y - r * 0.3, r * 0.1, p.x, p.y, r);
      grad.addColorStop(0, '#FFF');
      grad.addColorStop(0.6, '#EEE');
      grad.addColorStop(1, '#CCC');
      ctx.fillStyle = grad;
    }

    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    if (player === 2) {
      ctx.strokeStyle = '#999';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  drawWinLine(line) {
    const ctx = this.ctx;
    if (line.length < 2) return;
    const start = this.toPixel(line[0][0], line[0][1]);
    const end = this.toPixel(line[line.length - 1][0], line[line.length - 1][1]);

    ctx.save();
    ctx.strokeStyle = 'rgba(255, 50, 50, 0.8)';
    ctx.lineWidth = this.stoneRadius * 0.4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
    ctx.restore();
  }

  drawGhost(row, col, player) {
    const ctx = this.ctx;
    const p = this.toPixel(row, col);
    ctx.save();
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = player === 1 ? '#000' : '#FFF';
    ctx.beginPath();
    ctx.arc(p.x, p.y, this.stoneRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  clearWinLine() {
    this.winLine = null;
    this.lastMove = null;
  }
}
