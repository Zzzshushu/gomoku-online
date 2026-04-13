# 部署指南 - 微信/浏览器直接对战

## 快速开始（本地测试）

```bash
cd c:\Users\Administrator\WorkBuddy\20260413174720\五子棋联机版
npm install
npm start
# 访问 http://localhost:3001
```

---

## 部署到公网（让微信好友能访问）

### 方式一：ngrok 快速分享（免费，推荐）

1. 下载 ngrok：https://ngrok.com/download 并注册账号
2. 认证你的 ngrok（免费版需要）：
   ```bash
   ngrok config add-authtoken YOUR_TOKEN
   ```
3. 启动游戏：
   ```bash
   npm start
   ```
4. 新开终端，运行 ngrok：
   ```bash
   ngrok http 3001
   ```
5. 复制显示的 HTTPS 链接（如 `https://abc123.ngrok-free.app`）
6. 分享给好友！

### 方式二：Railway 部署（免费，永久在线，推荐）

1. 注册 https://railway.app
2. 创建新项目 → Deploy from GitHub 或直接上传代码
3. Railway 自动检测 Node.js 项目
4. 部署后获得公网 URL，直接分享

### 方式三：Render 部署（免费）

1. 注册 https://render.com
2. 创建 Web Service → 连接代码仓库
3. 设置：
   - Build Command: `npm install`
   - Start Command: `npm start`
4. 获取 URL 分享

---

## 分享给好友

### 方式1：分享链接（推荐）

部署后，复制链接发送给好友：
```
https://your-game-url.com
```

好友打开后：
1. 选择「联机对战」→「加入房间」
2. 输入你分享的房间号

### 方式2：通过链接直接进入房间

创建房间后，点击「分享给微信好友」按钮，自动生成带房间号的链接：
```
https://your-game-url.com?room=ABC123
```

好友点击链接，直接进入对应房间！

---

## 分享文案模板

```
🎮 五子棋对战邀请！

点击进入游戏：https://你的域名.com

房间号：XXXXXX

【对战规则】
1. 点击上方链接
2. 选择「联机对战」→「加入房间」
3. 输入房间号
4. 开始对战！

先连成5子获胜！
```

---

## 微信内打开注意

- ⚠️ 必须使用 **HTTPS**（微信安全要求）
- Android 微信：直接点击链接即可
- iOS 微信：可能需要点击右上角 → 「在Safari中打开」
- 如果 WebSocket 连接失败，提示用户用系统浏览器打开

---

## 微信分享配置（可选）

如需自定义微信分享标题/描述，需要：

1. 拥有一个已备案的域名
2. 在微信公众平台配置 JS 安全域名
3. 后端提供签名接口（可后续添加）

当前已配置基础 Open Graph 标签，微信分享时会显示：
- 标题：五子棋对战 - 邀请你来战！
- 描述：和朋友一起玩五子棋，支持人机对战和联机对战

---

## 技术说明

- 前端：单页应用，无需后端渲染
- WebSocket：实时双向同步
- 房间系统：创建房间 → 分享房间号 → 好友加入
- 状态同步：服务器权威模式，确保公平
- 微信兼容：支持触摸操作、自动重连
