好的，这里是完整的 **README.md**，您可以直接放在项目根目录。（当然是盐都不盐了）

---

```markdown
# wclcmmlBOT - Minecraft AI 寻路机器人

基于 Node.js + Mineflayer 的 Minecraft 无头机器人，集成智谱 AI (GLM-4-Flash) 实现自然语言指令解析，支持 Web 图形化控制台、自动登录、自动重生、动态重连，并针对 GrimAC 反作弊进行深度优化。

---

## ✨ 功能特性

- **🤖 AI 指令解析** - 通过智谱 AI GLM-4-Flash 将自然语言转换为 Minecraft 动作
- **🎮 双通道控制** - 支持游戏内聊天命令 (`!`) 和 Web 控制台
- **📡 Web 实时控制台** - 浏览器查看状态、发送命令、实时日志
- **🔄 自动登录** - 支持 `/register` + `/login`，仅首次进服执行
- **💀 自动重生** - 死亡后随机延迟重生
- **🔌 智能重连** - 指数退避策略，避免无限重连
- **🛡️ 反作弊优化** - 针对 GrimAC 的 Simulation / Timer / GroundSpoof 检测调优
- **📋 日志系统** - 按天滚动，自动轮转
- **📱 私聊支持** - 可通过 `/tell Bot !命令` 私聊控制

---

## 📦 技术栈

| 技术 | 用途 |
|------|------|
| Node.js | 运行时环境 |
| Mineflayer | Minecraft 客户端模拟 |
| mineflayer-pathfinder | 寻路引擎 |
| Express + WebSocket | Web 控制台服务器 |
| 智谱 AI GLM-4-Flash | 自然语言解析 |
| Axios | HTTP 请求 |

---

## 🚀 快速开始

### 1. 克隆项目
```bash
git clone https://github.com/MaNing522/wclcmmlBOT.git
cd wclcmmlBOT
```

### 2. 安装依赖
```bash
npm install
# 或使用 yarn
yarn install
```

### 3. 配置文件 (`config.js`)
```javascript
module.exports = {
  server: {
    host: '你的服务器IP',    // 例如 'play.example.com'
    port: 25565,
    version: '1.21.11'      // 必须与服务器版本匹配
  },
  bot: {
    username: 'Bot',        // 机器人名字
    owner: 'zwzzxy',        // 你的游戏ID（大小写敏感）
    admins: ['zwzzxy']      // 管理员列表
  },
  ai: {
    apiKey: '你的智谱AI API Key',  // 从 https://open.bigmodel.cn/ 获取
    model: 'glm-4-flash',
    apiUrl: 'https://open.bigmodel.cn/api/paas/v4/chat/completions'
  },
  login: {
    enabled: true,
    password: '你的登录密码',      // 服务器登录密码
    registerCommand: '/register',
    loginCommand: '/login'
  }
  // ... 其他配置保持默认
};
```

### 4. 启动机器人
```bash
npm start
# 或
yarn web
```

### 5. 打开 Web 控制台
浏览器访问 `http://localhost:3000`

---

## 🎮 游戏内使用

在游戏聊天框发送以 `!` 或 `！` 开头的命令：

| 命令示例 | 效果 |
|----------|------|
| `！过来` | 机器人跟随你 |
| `！走到 100 64 200` | 移动到指定坐标 |
| `！说大家好` | 发送聊天消息 |
| `！私聊 zwzzxy 说秘密` | 私聊指定玩家 |
| `！攻击 zwzzxy` | 攻击指定玩家 |

> 私聊控制：`/tell Bot !过来`

---

## 🌐 Web 控制台

| 功能 | 说明 |
|------|------|
| 状态面板 | 实时显示在线状态、坐标、生命值、饥饿值 |
| 快速按钮 | 一键发送常用命令（状态/回家/停止/跟随） |
| 命令输入 | 发送 `!` 开头的 AI 命令 |
| 消息发送 | 让机器人发送普通聊天消息 |
| 日志区域 | 实时滚动显示所有事件 |

---

## 🛡️ 反作弊优化说明

针对 GrimAC 的主要检测项已做以下优化：

| 检测项 | 优化策略 |
|--------|----------|
| **Simulation** | 终点随机偏移 (0.8格)，允许较大寻路误差 (1.0格) |
| **Timer** | 移除所有移动中的定时器，让 `pathfinder` 自主运行 |
| **GroundSpoof** | 禁用 `canDig` / `canPlace`，避免误触方块碰撞 |

如需进一步降低触发，可在 `config.js` 中增大 `moveRandomOffset` 或调整服务器 Grim 配置 (`simulation.threshold` / `timer.drift`)。

---

## 📂 项目结构

```
wclcmmlBOT/
├── main.js                 # Web 服务器 + 机器人核心
├── config.js               # 主配置文件
├── chatController.js       # 命令接收与权限控制
├── aiParser.js             # 智谱 AI 指令解析
├── actionExecutor.js       # 动作执行器（移动/攻击/交互等）
├── loginHandler.js         # 自动登录模块
├── logger.js               # 日志系统
├── utils.js                # 工具函数
├── web-gui/                # Web 控制台前端
│   ├── index.html
│   ├── style.css
│   └── client.js
├── logs/                   # 日志目录（自动创建）
└── package.json
```

---

## 📋 日志

日志文件位于 `logs/YYYY-MM-DD.log`，按天滚动，单文件超过 10MB 自动轮转。

---

## ⚙️ 高级配置

### 重连策略 (`config.reconnect`)
```javascript
reconnect: {
  enabled: true,
  initialDelay: 5000,      // 首次重连延迟（毫秒）
  maxDelay: 120000,        // 最大延迟（2分钟）
  backoffMultiplier: 1.5,  // 退避倍数
  maxAttempts: 10          // 最大尝试次数
}
```

### 反作弊参数 (`config.antiCheat`)
```javascript
antiCheat: {
  moveRandomOffset: 0.8,   // 终点随机偏移（越大越自然）
  attackDistance: 2.8      // 最大攻击距离
}
```

---

## 🤝 贡献

欢迎提交 Issue 和 Pull Request。

---

## 📜 许可证

MIT License

---

## 📞 联系

- 作者: zwzzxy
- GitHub: [MaNing522](https://github.com/MaNing522)
- 项目地址: [wclcmmlBOT](https://github.com/MaNing522/wclcmmlBOT)
```

---
