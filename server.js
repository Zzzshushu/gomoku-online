/**
 * 五子棋联机对战服务器
 * WebSocket + 房间管理
 */

const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3001;
const BOARD_SIZE = 15;

// ============ 房间管理器 ============
class RoomManager {
  constructor() {
    this.rooms = new Map();
  }

  generateRoomId() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  }

  createRoom(player, playerName) {
    let roomId;
    do {
      roomId = this.generateRoomId();
    } while (this.rooms.has(roomId));

    const room = {
      id: roomId,
      players: [{ id: player.id, name: playerName, color: 1, ws: player.ws }],
      boardState: this.createEmptyBoard(),
      currentPlayer: 1,
      status: 'waiting',
      winner: 0,
      moveHistory: [],
      createTime: Date.now()
    };

    this.rooms.set(roomId, room);
    return room;
  }

  joinRoom(roomId, player, playerName) {
    const room = this.rooms.get(roomId);
    if (!room) {
      return { error: 'ROOM_NOT_FOUND', message: '房间不存在' };
    }
    if (room.players.length >= 2) {
      return { error: 'ROOM_FULL', message: '房间已满' };
    }
    if (room.status !== 'waiting') {
      return { error: 'GAME_STARTED', message: '游戏已开始' };
    }

    room.players.push({ id: player.id, name: playerName, color: 2, ws: player.ws });
    return room;
  }

  leaveRoom(playerId) {
    for (const [roomId, room] of this.rooms) {
      const playerIndex = room.players.findIndex(p => p.id === playerId);
      if (playerIndex !== -1) {
        const opponent = room.players[1 - playerIndex];
        room.players.splice(playerIndex, 1);

        if (opponent && opponent.ws.readyState === WebSocket.OPEN) {
          this.sendToPlayer(opponent, {
            type: 'OPPONENT_LEFT',
            reason: '对手离开了房间'
          });
        }

        if (room.players.length === 0) {
          this.rooms.delete(roomId);
        } else if (room.status === 'playing') {
          const winner = opponent ? opponent.color : 0;
          room.status = 'finished';
          room.winner = winner;
          this.broadcastToRoom(room, {
            type: 'GAME_OVER',
            winner: winner,
            reason: '对手离开'
          });
        }
        return roomId;
      }
    }
    return null;
  }

  getRoomByPlayer(playerId) {
    for (const room of this.rooms.values()) {
      if (room.players.some(p => p.id === playerId)) {
        return room;
      }
    }
    return null;
  }

  getAvailableRooms() {
    const rooms = [];
    for (const room of this.rooms.values()) {
      if (room.status === 'waiting' && room.players.length === 1) {
        rooms.push({
          id: room.id,
          playerName: room.players[0].name,
          createTime: room.createTime
        });
      }
    }
    return rooms;
  }

  createEmptyBoard() {
    return Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(0));
  }

  makeMove(room, playerId, row, col) {
    const player = room.players.find(p => p.id === playerId);
    if (!player) {
      return { error: 'PLAYER_NOT_IN_ROOM' };
    }

    if (room.currentPlayer !== player.color) {
      return { error: 'NOT_YOUR_TURN', message: '还没轮到你落子' };
    }

    if (row < 0 || row >= BOARD_SIZE || col < 0 || col >= BOARD_SIZE) {
      return { error: 'INVALID_POSITION' };
    }

    if (room.boardState[row][col] !== 0) {
      return { error: 'POSITION_OCCUPIED' };
    }

    room.boardState[row][col] = player.color;
    room.moveHistory.push({ row, col, player: player.color, time: Date.now() });

    const winResult = this.checkWin(room.boardState, row, col, player.color);
    if (winResult) {
      room.status = 'finished';
      room.winner = player.color;
      return { success: true, win: true, winner: player.color, winLine: winResult };
    }

    if (room.moveHistory.length >= BOARD_SIZE * BOARD_SIZE) {
      room.status = 'finished';
      room.winner = 0;
      return { success: true, draw: true };
    }

    room.currentPlayer = room.currentPlayer === 1 ? 2 : 1;

    return { success: true };
  }

  checkWin(board, row, col, player) {
    const directions = [[0, 1], [1, 0], [1, 1], [1, -1]];

    for (const [dr, dc] of directions) {
      let count = 1;
      let line = [[row, col]];

      let r = row + dr, c = col + dc;
      while (this.inBounds(r, c) && board[r][c] === player) {
        count++;
        line.push([r, c]);
        r += dr;
        c += dc;
      }

      r = row - dr;
      c = col - dc;
      while (this.inBounds(r, c) && board[r][c] === player) {
        count++;
        line.unshift([r, c]);
        r -= dr;
        c -= dc;
      }

      if (count >= 5) return line;
    }

    return null;
  }

  inBounds(r, c) {
    return r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE;
  }

  sendToPlayer(player, message) {
    if (player.ws.readyState === WebSocket.OPEN) {
      player.ws.send(JSON.stringify(message));
    }
  }

  broadcastToRoom(room, message) {
    for (const player of room.players) {
      this.sendToPlayer(player, message);
    }
  }
}

// ============ WebSocket 服务器 ============
const roomManager = new RoomManager();

const server = http.createServer((req, res) => {
  let filePath = req.url === '/' ? '/index.html' : req.url;
  filePath = path.join(__dirname, 'public', filePath);

  const extname = path.extname(filePath);
  const contentTypes = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif'
  };

  const contentType = contentTypes[extname] || 'text/plain';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404);
        res.end('404 Not Found');
      } else {
        res.writeHead(500);
        res.end('Server Error');
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    }
  });
});

const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
  const playerId = Math.random().toString(36).substring(2, 10);
  console.log(`[+] 玩家连接: ${playerId}`);

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data);
      handleMessage(ws, playerId, message);
    } catch (e) {
      console.error('消息解析错误:', e);
    }
  });

  ws.on('close', () => {
    console.log(`[-] 玩家断开: ${playerId}`);
    const room = roomManager.leaveRoom(playerId);
    if (room) {
      console.log(`房间 ${room.id} 已清理`);
    }
  });

  ws.on('error', (err) => {
    console.error('WebSocket错误:', err);
  });
});

function handleMessage(ws, playerId, message) {
  const room = roomManager.getRoomByPlayer(playerId);

  switch (message.type) {
    case 'CREATE_ROOM': {
      if (room) {
        roomManager.sendToPlayer({ ws }, { type: 'ERROR', code: 'ALREADY_IN_ROOM' });
        return;
      }
      const newRoom = roomManager.createRoom({ id: playerId, ws }, message.playerName || '玩家');
      roomManager.sendToPlayer({ ws }, {
        type: 'ROOM_CREATED',
        roomId: newRoom.id,
        color: 1,
        status: 'waiting'
      });
      console.log(`[房间] ${newRoom.id} 创建成功`);
      break;
    }

    case 'JOIN_ROOM': {
      if (room) {
        roomManager.sendToPlayer({ ws }, { type: 'ERROR', code: 'ALREADY_IN_ROOM' });
        return;
      }
      const joinResult = roomManager.joinRoom(message.roomId.toUpperCase(), { id: playerId, ws }, message.playerName || '玩家');
      if (joinResult.error) {
        roomManager.sendToPlayer({ ws }, { type: 'ERROR', code: joinResult.error, message: joinResult.message });
        return;
      }
      roomManager.broadcastToRoom(joinResult, {
        type: 'GAME_START',
        roomId: joinResult.id,
        players: joinResult.players.map(p => ({ name: p.name, color: p.color })),
        firstPlayer: 1
      });
      joinResult.status = 'playing';
      console.log(`[房间] ${joinResult.id} 游戏开始`);
      break;
    }

    case 'LIST_ROOMS': {
      const rooms = roomManager.getAvailableRooms();
      roomManager.sendToPlayer({ ws }, { type: 'ROOM_LIST', rooms });
      break;
    }

    case 'MAKE_MOVE': {
      if (!room) {
        roomManager.sendToPlayer({ ws }, { type: 'ERROR', code: 'NOT_IN_ROOM' });
        return;
      }
      if (room.status !== 'playing') {
        roomManager.sendToPlayer({ ws }, { type: 'ERROR', code: 'GAME_NOT_STARTED' });
        return;
      }

      const result = roomManager.makeMove(room, playerId, message.row, message.col);
      if (result.error) {
        roomManager.sendToPlayer({ ws }, { type: 'ERROR', code: result.error, message: result.message });
        return;
      }

      const player = room.players.find(p => p.id === playerId);

      roomManager.broadcastToRoom(room, {
        type: 'MOVE_MADE',
        player: player.color,
        row: message.row,
        col: message.col,
        currentPlayer: room.currentPlayer
      });

      if (result.win) {
        roomManager.broadcastToRoom(room, {
          type: 'GAME_OVER',
          winner: result.winner,
          winLine: result.winLine
        });
      } else if (result.draw) {
        roomManager.broadcastToRoom(room, {
          type: 'GAME_OVER',
          winner: 0,
          reason: '平局'
        });
      }
      break;
    }

    case 'LEAVE_ROOM': {
      if (room) {
        roomManager.leaveRoom(playerId);
        roomManager.sendToPlayer({ ws }, { type: 'ROOM_LEFT' });
      }
      break;
    }

    case 'CHAT': {
      if (room) {
        const player = room.players.find(p => p.id === playerId);
        roomManager.broadcastToRoom(room, {
          type: 'CHAT',
          player: player.name,
          color: player.color,
          message: message.text
        });
      }
      break;
    }

    default:
      console.log(`[未知消息] ${message.type}`);
  }
}

server.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════╗
║           五子棋联机对战服务器 启动成功                 ║
╠═══════════════════════════════════════════════════════╣
║  HTTP 服务器:  http://localhost:${PORT}                    ║
║  WebSocket:    ws://localhost:${PORT}                      ║
╚═══════════════════════════════════════════════════════╝
  `);
});
