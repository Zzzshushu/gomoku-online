# 五子棋对战平台

一个支持**人机对战**和**联机对战**的五子棋游戏。

## 功能特性

### 🤖 人机对战
- 三个难度等级：简单、普通、困难
- AI 使用 Minimax + Alpha-Beta 剪枝算法
- 流畅的Canvas渲染
- 悔棋功能

### 🌐 联机对战
- WebSocket 实时通信
- 房间系统（创建/加入房间）
- 房间号分享，好友对战
- 游戏状态同步

## 技术栈

- **前端**: 原生 JavaScript + HTML5 Canvas
- **后端**: Node.js + ws (WebSocket)
- **通信**: JSON over WebSocket

## 快速开始

### 1. 安装依赖

```bash
cd 五子棋联机版
npm install
```

### 2. 启动服务器

```bash
npm start
```

### 3. 访问游戏

打开浏览器访问: http://localhost:3001

## 项目结构

```
五子棋联机版/
├── server.js           # WebSocket服务器
├── package.json        # 依赖配置
├── ARCHITECTURE.md     # 架构设计文档
├── README.md           # 本文档
└── public/
    ├── index.html      # 游戏页面
    ├── css/
    │   └── style.css   # 样式文件
    └── js/
        ├── ai.js       # AI算法
        ├── board.js    # 棋盘渲染
        ├── game.js     # 游戏主逻辑
        └── network.js  # 网络通信
```

## 游戏说明

### 人机对战
1. 选择"人机对战"模式
2. 选择难度（简单/普通/困难）
3. 执黑先手，点击棋盘落子
4. AI自动应对

### 联机对战
1. 选择"联机对战"模式
2. **创建房间**：获得房间号，分享给好友
3. **加入房间**：输入房间号进入游戏
4. 两名玩家轮流落子，先连成5子获胜

## WebSocket 协议

### 客户端 → 服务器

| 消息类型 | 描述 | 负载 |
|---------|------|------|
| CREATE_ROOM | 创建房间 | `{ playerName }` |
| JOIN_ROOM | 加入房间 | `{ roomId, playerName }` |
| LIST_ROOMS | 获取房间列表 | - |
| MAKE_MOVE | 落子 | `{ row, col }` |
| LEAVE_ROOM | 离开房间 | - |

### 服务器 → 客户端

| 消息类型 | 描述 | 负载 |
|---------|------|------|
| ROOM_CREATED | 房间创建成功 | `{ roomId, color }` |
| GAME_START | 游戏开始 | `{ players, firstPlayer }` |
| MOVE_MADE | 落子通知 | `{ player, row, col }` |
| GAME_OVER | 游戏结束 | `{ winner, winLine }` |
| ROOM_LIST | 房间列表 | `{ rooms }` |
| ERROR | 错误信息 | `{ code, message }` |

## 团队技术提升总结

本项目展示了以下工程实践：

1. **代码组织** - 模块化拆分（UI/业务/网络/AI）
2. **状态管理** - 清晰的游戏状态流转
3. **前后端分离** - RESTful + WebSocket 混合通信
4. **错误处理** - 完整的异常捕获和用户提示
5. **用户体验** - 流畅的UI和即时反馈

如需进一步提升，可考虑：
- 添加 TypeScript 类型定义
- 编写单元测试（Jest）
- 添加 ESLint + Prettier 代码规范
- 实现断线重连机制
- 添加观战功能
