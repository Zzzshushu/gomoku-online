# 五子棋对战平台 - 技术架构设计

## 项目概述
- 目标：实现人机对战 + 联机对战双模式
- 技术栈：HTML5 Canvas + Node.js + WebSocket
- 用户需求：支持与AI对战、支持玩家之间联机对战

## 系统架构

```
┌─────────────────────────────────────────────────────────────┐
│                        前端 (Client)                         │
├─────────────────────────────────────────────────────────────┤
│  game.js (主游戏逻辑)                                        │
│    ├── AI模式 - 本地AI落子                                    │
│    └── 联机模式 - 接收服务器广播、发送落子                     │
│  board.js (棋盘渲染)                                         │
│  network.js (网络通信层)                                     │
└─────────────────────────────────────────────────────────────┘
                              ↕ WebSocket
┌─────────────────────────────────────────────────────────────┐
│                     后端 (Server)                            │
├─────────────────────────────────────────────────────────────┤
│  server.js                                                  │
│    ├── 房间管理 (Room Manager)                               │
│    ├── 游戏状态同步 (Game State Sync)                        │
│    └── WebSocket Server (ws库)                              │
└─────────────────────────────────────────────────────────────┘
```

## 游戏模式

### 1. 人机对战模式 (AI Mode)
- 玩家执黑先手
- AI使用Minimax + Alpha-Beta剪枝算法
- 支持三个难度：简单(N=1)、普通(N=2)、困难(N=3)

### 2. 联机对战模式 (Online Mode)
- 玩家创建房间或加入已有房间
- 房间ID用于好友邀请
- 两名玩家轮流落子
- 服务器作为裁判，验证每一步合法性
- 支持观战功能

## 消息协议 (WebSocket)

### 客户端 → 服务器
| 消息类型 | 描述 | 负载 |
|---------|------|------|
| CREATE_ROOM | 创建房间 | `{ playerName }` |
| JOIN_ROOM | 加入房间 | `{ roomId, playerName }` |
| MAKE_MOVE | 落子 | `{ row, col }` |
| LEAVE_ROOM | 离开房间 | - |
| CHAT | 聊天消息 | `{ message }` |

### 服务器 → 客户端
| 消息类型 | 描述 | 负载 |
|---------|------|------|
| ROOM_CREATED | 房间创建成功 | `{ roomId }` |
| ROOM_JOINED | 加入房间成功 | `{ roomId, color, opponent }` |
| GAME_START | 游戏开始 | `{ firstPlayer }` |
| OPPONENT_MOVE | 对手落子 | `{ row, col, timestamp }` |
| GAME_OVER | 游戏结束 | `{ winner, winLine }` |
| ROOM_CLOSED | 房间关闭 | `{ reason }` |
| ERROR | 错误信息 | `{ code, message }` |

## 数据结构

### 房间 (Room)
```javascript
{
  id: string,           // 房间ID (6位随机)
  players: [Player, Player],
  boardState: number[][], // 15x15棋盘
  currentPlayer: 1 | 2, // 当前落子方
  status: 'waiting' | 'playing' | 'finished',
  winner: 0 | 1 | 2,
  createTime: timestamp
}
```

### 玩家 (Player)
```javascript
{
  id: string,           // WebSocket连接ID
  name: string,        // 玩家名称
  color: 1 | 2,         // 1=黑棋, 2=白棋
  ws: WebSocket         // 连接对象
}
```

## API端点

| 端点 | 方法 | 描述 |
|------|------|------|
| / | GET | 主页 |
| /game | GET | 游戏页面 |
| /api/rooms | GET | 获取可用房间列表 |
| /ws | WebSocket | 游戏通信 |

## 安全考虑
- 房间密码保护（可选）
- 落子合法性验证
- 断线重连支持
- 超时判负

## 部署
- 前端：静态文件服务器
- 后端：Node.js + ws
- 端口：3000 (HTTP) + 3001 (WebSocket)
