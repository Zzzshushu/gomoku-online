/**
 * 网络通信模块 - WebSocket管理
 */

class NetworkManager {
  constructor(game) {
    this.game = game;
    this.ws = null;
    this.roomId = null;
    this.playerColor = 1;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 3;
  }

  connect() {
    return new Promise((resolve, reject) => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.hostname || 'localhost';
      const port = 3001;
      const wsUrl = `${protocol}//${host}:${port}`;

      console.log('连接服务器:', wsUrl);

      try {
        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
          console.log('WebSocket已连接');
          this.isConnected = true;
          this.reconnectAttempts = 0;
          this.setupMessageHandler();
          resolve();
        };

        this.ws.onerror = (error) => {
          console.error('WebSocket错误:', error);
          reject(error);
        };

        this.ws.onclose = () => {
          console.log('WebSocket已断开');
          this.isConnected = false;
          this.handleDisconnect();
        };
      } catch (e) {
        reject(e);
      }
    });
  }

  setupMessageHandler() {
    this.ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        this.handleMessage(message);
      } catch (e) {
        console.error('消息解析错误:', e);
      }
    };
  }

  handleMessage(message) {
    switch (message.type) {
      case 'ROOM_CREATED':
        this.roomId = message.roomId;
        this.playerColor = message.color;
        this.game.onlinePlayerColor = message.color;
        this.game.roomId = message.roomId;
        showWaitingScreen(message.roomId);
        showToast('房间创建成功，等待对手...', 'success');
        break;

      case 'GAME_START':
        this.roomId = message.roomId;
        this.game.roomId = message.roomId;
        hideWaitingScreen();
        this.game.resetGame();
        
        // 确定玩家颜色
        const me = message.players.find(p => p.name === '我' || p.name === getPlayerName());
        if (me) {
          this.playerColor = me.color;
          this.game.onlinePlayerColor = me.color;
        }

        // 先手判断
        this.game.isMyTurn = message.firstPlayer === this.playerColor;
        showToast('游戏开始！' + (this.game.isMyTurn ? '你执黑先行' : '对手执黑先行'), 'success');
        this.game.render();
        break;

      case 'MOVE_MADE':
        if (message.player !== this.playerColor) {
          this.game.receiveOpponentMove(message.row, message.col);
        }
        break;

      case 'GAME_OVER':
        this.game.handleGameOver(message.winner, message.winLine, message.reason);
        
        if (message.winner === this.playerColor) {
          showToast('🎉 恭喜获胜！', 'success');
        } else if (message.winner === 0) {
          showToast('平局！', 'info');
        } else {
          showToast('对手获胜，再接再厉！', 'info');
        }
        break;

      case 'ROOM_LIST':
        updateRoomList(message.rooms);
        break;

      case 'OPPONENT_LEFT':
        showToast('对手离开了房间', 'info');
        this.game.resetGame();
        this.game.roomId = null;
        this.roomId = null;
        showModeSelect();
        break;

      case 'ERROR':
        showToast(message.message || '发生错误', 'error');
        break;

      case 'ROOM_LEFT':
        this.roomId = null;
        this.game.roomId = null;
        showToast('已离开房间', 'info');
        break;
    }
  }

  handleDisconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      showToast(`连接断开，${3 - this.reconnectAttempts}秒后重连...`, 'info');
      setTimeout(() => this.connect(), 3000);
    } else {
      showToast('连接失败，请刷新页面重试', 'error');
    }
  }

  send(message) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  createRoom(playerName) {
    this.send({
      type: 'CREATE_ROOM',
      playerName: playerName
    });
  }

  joinRoom(roomId, playerName) {
    this.send({
      type: 'JOIN_ROOM',
      roomId: roomId,
      playerName: playerName
    });
  }

  listRooms() {
    this.send({ type: 'LIST_ROOMS' });
  }

  makeMove(row, col) {
    this.send({
      type: 'MAKE_MOVE',
      row: row,
      col: col
    });
  }

  leaveRoom() {
    this.send({ type: 'LEAVE_ROOM' });
    this.roomId = null;
    this.game.roomId = null;
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
  }
}

// 全局变量
let game = null;
let network = null;

function getPlayerName() {
  return localStorage.getItem('gomoku-player-name') || '玩家' + Math.floor(Math.random() * 1000);
}

function setPlayerName(name) {
  localStorage.setItem('gomoku-player-name', name);
}

// ============ UI相关 ============
function showModeSelect() {
  hideAllPages();
  document.getElementById('modeSelect').style.display = 'block';
}

function showAIMode() {
  hideAllPages();
  document.getElementById('aiMode').style.display = 'block';
  if (!game) {
    initGame();
  }
  game.setMode('ai');
  game.resetGame();
}

function showOnlineMode() {
  hideAllPages();
  document.getElementById('onlineMode').style.display = 'block';
  
  if (!network) {
    initNetwork();
  }
  
  if (network && !network.isConnected) {
    network.connect().then(() => {
      network.listRooms();
    }).catch(() => {
      showToast('服务器连接失败，请确保服务器已启动', 'error');
    });
  } else if (network) {
    network.listRooms();
  }
}

function showCreateRoom() {
  hideAllPages();
  document.getElementById('createRoom').style.display = 'block';
}

function showJoinRoom() {
  hideAllPages();
  document.getElementById('joinRoom').style.display = 'block';
  
  if (network) {
    network.listRooms();
  }
}

function showGame() {
  hideAllPages();
  document.getElementById('gameMode').style.display = 'block';
  
  if (!game) {
    initGame();
  }
  if (game.mode === 'ai') {
    showAIMode();
    return;
  }
  
  if (!network) {
    initNetwork();
  }
  
  network.connect().then(() => {
    game.setMode('online');
    game.resetGame();
    network.createRoom(getPlayerName());
  }).catch(() => {
    showToast('连接服务器失败', 'error');
  });
}

function showWaitingScreen(roomId) {
  const overlay = document.getElementById('waitingOverlay');
  if (overlay) {
    document.getElementById('roomIdDisplay').textContent = roomId;
    overlay.style.display = 'flex';
  }
}

function hideWaitingScreen() {
  const overlay = document.getElementById('waitingOverlay');
  if (overlay) {
    overlay.style.display = 'none';
  }
}

function hideAllPages() {
  document.querySelectorAll('.page').forEach(p => p.style.display = 'none');
}

function updateRoomList(rooms) {
  const list = document.getElementById('roomList');
  if (!list) return;

  if (rooms.length === 0) {
    list.innerHTML = '<div class="empty-rooms">暂无等待中的房间<br><br><button class="btn btn-primary" onclick="showCreateRoom()">创建房间</button></div>';
    return;
  }

  list.innerHTML = rooms.map(room => `
    <div class="room-item" onclick="joinRoom('${room.id}')">
      <div class="room-info">
        <div class="room-name">${escapeHtml(room.playerName)} 的房间</div>
        <div class="room-time">${formatTime(room.createTime)}</div>
      </div>
      <button class="join-btn">加入</button>
    </div>
  `).join('');
}

function joinRoom(roomId) {
  if (!network) {
    initNetwork();
  }

  network.connect().then(() => {
    network.joinRoom(roomId, getPlayerName());
    showGame();
  }).catch(() => {
    showToast('连接服务器失败', 'error');
  });
}

function createRoom() {
  const playerName = document.getElementById('playerNameCreate').value.trim() || getPlayerName();
  setPlayerName(playerName);

  if (!network) {
    initNetwork();
  }

  network.connect().then(() => {
    network.createRoom(playerName);
    showGame();
  }).catch(() => {
    showToast('连接服务器失败', 'error');
  });
}

function joinRoomById() {
  const roomId = document.getElementById('roomIdInput').value.trim().toUpperCase();
  const playerName = document.getElementById('playerNameJoin').value.trim() || getPlayerName();

  if (!roomId) {
    showToast('请输入房间号', 'error');
    return;
  }

  setPlayerName(playerName);

  if (!network) {
    initNetwork();
  }

  network.connect().then(() => {
    network.joinRoom(roomId, playerName);
    showGame();
  }).catch(() => {
    showToast('连接服务器失败', 'error');
  });
}

function leaveGame() {
  if (network && network.roomId) {
    network.leaveRoom();
  }
  showModeSelect();
}

function copyRoomId() {
  if (network && network.roomId) {
    navigator.clipboard.writeText(network.roomId).then(() => {
      showToast('房间号已复制', 'success');
    });
  }
}

function shareRoomToFriend() {
  if (network && network.roomId) {
    const roomId = network.roomId;
    const shareUrl = window.location.origin + '?room=' + roomId;
    const shareText = '🎮 五子棋对战邀请！\n\n房间号：' + roomId + '\n\n点击链接加入游戏：\n' + shareUrl;
    
    // 尝试使用微信开放标签（需要微信公众号配置）
    if (typeof wx !== 'undefined') {
      // 微信 JSSDK 分享
      wx.ready(() => {
        wx.updateAppMessageShareData({
          title: '🎮 五子棋对战邀请',
          desc: '房间号：' + roomId + ' 快来和我对战！',
          link: shareUrl,
          imgUrl: window.location.origin + '/icon.png'
        });
      });
    }
    
    // 尝试使用 Web Share API
    if (navigator.share) {
      navigator.share({
        title: '五子棋对战邀请',
        text: shareText,
        url: shareUrl
      }).catch(() => {});
    } else {
      // 降级：复制分享文本
      navigator.clipboard.writeText(shareText).then(() => {
        showToast('分享内容已复制，发送给好友吧！', 'success');
      });
    }
  }
}

function exitToMenu() {
  if (network) {
    network.leaveRoom();
    network.disconnect();
  }
  network = null;
  showModeSelect();
}

// ============ 工具函数 ============
function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = 'toast ' + type + ' show';
  setTimeout(() => {
    toast.className = 'toast ' + type;
  }, 3000);
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatTime(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = Math.floor((now - date) / 1000);

  if (diff < 60) return '刚刚';
  if (diff < 3600) return Math.floor(diff / 60) + '分钟前';
  return date.toLocaleTimeString();
}

// ============ 初始化 ============
function initGame() {
  const canvas = document.getElementById('gameCanvas');
  game = new GomokuGame(canvas);
}

function initNetwork() {
  if (!game) {
    initGame();
  }
  network = new NetworkManager(game);
}

// ============ 微信分享功能 ============
function shareToWechat(roomId) {
  const shareData = {
    title: '🎮 五子棋对战邀请 - 房间号：' + roomId,
    desc: '我在五子棋等你，快来和我对战！房间号：' + roomId,
    link: window.location.origin + '?room=' + roomId,
    imgUrl: window.location.origin + '/icon.png'
  };

  // 尝试使用微信 JSSDK（需要后端提供签名）
  if (typeof wx !== 'undefined' && wx.updateAppMessageShareData) {
    wx.updateAppMessageShareData(shareData);
  }

  // 复制分享链接
  copyShareLink(roomId);
}

function copyShareLink(roomId) {
  const shareUrl = window.location.origin + '?room=' + roomId;
  
  if (navigator.share) {
    // 移动端原生分享
    navigator.share({
      title: '五子棋对战邀请',
      text: '房间号：' + roomId + ' 快来和我对战！',
      url: shareUrl
    }).catch(() => {
      // 用户取消分享，静默处理
    });
  } else {
    // 复制链接到剪贴板
    navigator.clipboard.writeText(shareUrl).then(() => {
      showToast('分享链接已复制，发送给好友吧！', 'success');
    }).catch(() => {
      showToast('房间号：' + roomId, 'info');
    });
  }
}

// ============ URL参数处理 ============
function handleUrlParams() {
  const params = new URLSearchParams(window.location.search);
  const roomId = params.get('room');
  const mode = params.get('mode');

  if (roomId) {
    // 直接进入房间
    setTimeout(() => {
      showJoinRoom();
      document.getElementById('roomIdInput').value = roomId;
      // 自动尝试加入
      joinRoomById();
    }, 500);
  } else if (mode === 'ai') {
    // 直接进入AI模式
    setTimeout(() => showAIMode(), 500);
  }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
  // 显示默认页面
  showModeSelect();
  
  // 处理URL参数（支持直接进入房间）
  handleUrlParams();
});
