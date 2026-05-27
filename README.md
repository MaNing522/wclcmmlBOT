以下是完整的 `README.md` 文件内容，可直接复制到你的 GitHub 仓库根目录。
(别问为什么有这条，问就是盐都不盐了)

<div align="center">
  
# 🤖 wclcmml 超级 Bot

**一个功能完备的 Minecraft 机器人，支持自动战斗、智能存储、AI 对话、网页控制台**

[![Node.js](https://img.shields.io/badge/Node.js-22+-blue?logo=node.js)](https://nodejs.org)
[![Mineflayer](https://img.shields.io/badge/Mineflayer-4.37-brightgreen?logo=minecraft)](https://github.com/PrismarineJS/mineflayer)
[![License](https://img.shields.io/badge/License-MIT-green)](#)

</div>

---

## 📌 简介

基于 [Mineflayer](https://github.com/PrismarineJS/mineflayer) 开发的 Minecraft 机器人，可连接任意 Java Edition 服务器（1.21+），提供**生存辅助、仓库管理、自动任务、聊天互动**等丰富功能，并通过**美观的网页控制台**实时监控和远程操控。

---

## ✨ 特色功能

| 类别 | 功能 |
| :--- | :--- |
| 🎯 战斗 | 自动清怪、追杀玩家、PVP 攻击 |
| 🌾 生存 | 自动进食、装备穿戴、钓鱼、农场（收割+播种）、睡觉、重生 |
| 📦 存储 | 仓库矩阵扫描、一键存放/批量拿取、存放箱/拿取箱分离 |
| 💬 聊天 | AI 对话（智谱 GLM / 兼容 OpenAI）、离线留言、娱乐指令（骰子/抽签/猜数字/戳一戳） |
| 🌐 网页控制 | 实时状态、背包/玩家查看、远程命令、配置编辑器、仓库可视化 |
| 🔐 权限 | 主人、操作员(OP)、持久/临时密码认证、临时授权 |
| 🧠 智能 | 危险路径规避、多轮对话记忆、TPS 监控、自动重连 |

---

## 🚀 快速开始

### 1️⃣ 环境要求
- Node.js **22+**（推荐）
- npm 或 yarn

### 2️⃣ 克隆 & 安装
```bash
git clone https://github.com/MaNing522/wclcmmlBOT.git
cd wclcmmlBOT
npm install
```

### 3️⃣ 配置
编辑 `config.json`，至少修改：
- `server.host` / `server.port` – 服务器地址和端口
- `server.username` – Bot 的游戏 ID
- `master` – 你的游戏 ID（主人）

根据需要开启 `autoFish`、`autoFarm`、`storageEnabled` 等。

### 4️⃣ 启动
```bash
node bot.js
```
或运行一键脚本：`start.bat` (Windows) 或 `./start.sh` (Linux/macOS)

启动后打开浏览器访问：**http://localhost:8848**

---

## ⚙️ 主要配置项

| 配置节 | 说明 |
| :--- | :--- |
| `server` | 连接目标服务器的主机、端口、版本、账号 |
| `master` | 主人游戏名（最高权限） |
| `storageEnabled` | 启用仓库矩阵系统 |
| `autoFish` / `autoFarm` | 自动钓鱼/农场开关及参数 |
| `ai` | AI 聊天（需填写 `apiKey`）及对话记忆设置 |
| `pathfinder.mode` | 路径模式：`safe`（安全）或 `fast`（快速） |
| `messageBoard` | 留言板开关与上线延迟 |
| `webControl` | 网页服务端口、API Key 验证 |

> 完整配置见 `config.json` 内注释。

---

## 📝 常用指令

### 公开指令（所有人可用）

| 指令 | 作用 |
| :--- | :--- |
| `!tps` | 查看服务器 TPS |
| `!status [玩家]` | 查看状态 |
| `!player` | 在线玩家列表 |
| `!chat <消息>` | AI 对话 |
| `!tell <玩家> <内容>` | 离线留言 |
| `!dice [面数]` | 掷骰子 |
| `!lottery [签文]` | 抽签 |
| `!guess start / 数字` | 猜数字游戏 |
| `!poke <玩家>` | 戳一下 |
| `!profile [玩家]` | 玩家资料卡 |
| `!fish on/off` | 自动钓鱼 |
| `!farm on/off` | 自动农场 |
| `!pathmode safe/fast` | 路径模式切换 |
| `!clearchat` | 清空 AI 记忆 |

### OP / 控制台指令

| 指令 | 作用 |
| :--- | :--- |
| `!op / !deop <玩家>` | 管理操作员 |
| `!mark <名称>` / `!pos <名称>` | 记录/发送坐标 |
| `!send <消息>` | 让 Bot 发言 |
| `!come / !follow / !stop` | 移动控制 |
| `!spam / !spamall / !stopspam` | 刷屏 |
| `!monster on/off` | 自动清怪 |
| `!kill / !hunt <玩家>` | 攻击/追杀 |
| `!dropall` | 丢弃所有物品 |
| `!lag on/off` | 卡顿模式 |

### 存储指令（需启用 `storageEnabled`）

| 指令 | 作用 |
| :--- | :--- |
| `存放` | 背包全部存入仓库 |
| `检查` | 查看仓库物品 |
| `拿取 <物品> <数量> ...` | 批量拿取 |
| `拿取 全部` | 取回所有物品 |
| `!storage check/deposit/take/takeall/update` | 英文指令 |

---

## 🖥️ 网页控制台

访问 `http://localhost:8848` 可看到：

- **主控台** – Bot 状态、背包、在线玩家、快捷指令
- **聊天控制台** – 发送消息/指令，实时日志
- **配置编辑器** – 在线修改 `config.json`（保存后重启生效）
- **仓库库存** – 可视化物品列表
- **存储操作** – 存放/拿取/检查
- **操作员管理** – 管理 OP 和密码
- **玩家数据** – 上线次数、在线时长
- **帮助** – 指令参考

---

## 📂 项目结构

```
├── bot.js                 # 主入口
├── baritoneMovements.js   # 寻路配置（含智能规避）
├── config.json            # 配置文件
├── data/                  # 数据存储（OP列表、统计、留言等）
├── modules/               # 核心功能模块
│   ├── autoAttack.js
│   ├── autoFish.js
│   ├── autoFarm.js
│   ├── chatHandler.js
│   ├── storage.js
│   ├── webServer.js
│   └── ...
├── *.html                 # 网页前端页面
├── start.bat / start.sh   # 一键启动脚本
└── README.md
```

---

## ❓ 常见问题

**1. Bot 连接不上服务器？**  
检查config.json中的server.host、port、version是否正确，以及网络是否通畅。

**2. 存储功能没反应？**  
确保storageEnabled: true，仓库区域的两个对角坐标正确覆盖了所有箱子，存放箱/拿取箱旁有对应文字的告示牌。

**3. AI 不回复或报错？**  
确认ai.enabled: true，且apiKey有效；智谱 API 需要国内网络访问，可检查是否能连接open.bigmodel.cn。

**4. 自动农场不工作？**  
确保autoFarm.enabled: true，Bot 背包有对应种子，且作物在配置的range内。

**5. 如何停止所有自动任务？**  
使用!stop停止移动，!monster off关闭清怪，!fish off/!farm off关闭对应功能。

---

## 🤝 贡献与支持

欢迎提交 Issue 和 Pull Request。如有疑问，可联系作者 [@MaNing522](https://github.com/MaNing522)或者发送邮件到邮箱basiccoppercarbonate2026@outlook
.com
---

## 📄 许可证

MIT License © 2025 MaNing522
```
