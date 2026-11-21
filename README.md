# ZwzzxyBot

Minecraft 1.21.11 无头客户端（mineflayer + 移植自 Baritone 的寻路/挖矿逻辑）。

- **复杂寻路 / 采矿**：矿石扫描、`GoalCompositeAny` 多目标择优、下挖竖井、分支矿道、反矿透（只挖暴露矿）
- **鞘翅飞行**：`!飞 x y z` 起飞并安全降落
- **自动登录**：AuthMe `/register` + `/login`，识别登录/注册提示自动补发
- **断线自恢复**：指数退避重连，最后一条指令持久化，重启后继续
- **两种控制方式**：游戏内聊天指令（仅 `owners` 可用）+ 本机 HTTP 接口
- **卡死自救援**：watchdog 检测长时间不动会自动挖开、跳跃、重新寻路

## 环境要求

- Node.js 18+（建议 20/22）
- 一个允许离线登录的 Minecraft 服务器（本地 Paper / 远程服均可）
- 如果服务器装了 AuthMe，需要在配置里填登录密码

> 仓库**不包含**测试用的服务端（`mc-server/` 已在 `.gitignore` 里）。要自己准备服务端，并下载 `paper.jar` 放到对应目录。

## 快速开始

```bash
npm install
cp config.example.json config.json   # Windows: copy config.example.json config.json
# 编辑 config.json，至少填 host / port / username / password / owners
npm start
```

## 配置

`config.json`（已 gitignore，不会进仓库）：

| 字段 | 说明 |
| --- | --- |
| `host` / `port` | 服务器地址与端口，默认 `127.0.0.1:25565` |
| `version` | 客户端版本，默认 `1.21.11` |
| `username` | 机器人离线登录名 |
| `password` | AuthMe 登录/注册密码，留空则跳过自动登录 |
| `proxy` | HTTP CONNECT 代理，例如 `http://127.0.0.1:18080`，留空直连 |
| `stateFile` | 运行模式持久化文件，相对路径按项目目录解析，默认 `.bot-state.json` |
| `owners` | 允许下指令的玩家名列表，默认 `zwzzxy`、`Server`（控制台） |
| `autoConnect` | 默认 `true`（启动就连 `host`）；设 `false` 则只开 HTTP 控制口，等 `join` 指令再进服 |

环境变量优先级高于 `config.json`：`MC_CONFIG`、`MC_HOST`、`MC_PORT`、`MC_USER`、`MC_PASSWORD`、`MC_VERSION`、`MC_PROXY`、`MC_OWNERS`、`MC_STATE_FILE`、`MC_CTL_PORT`、`MC_AUTOCONNECT`。

> 本仓库的 `headless.js` / `baritone.js` 同时被 QQ 机器人项目 `MaNing522/xiaona-bot` 内嵌使用（放在 `src/mcheadless/`），**改动要两边同步提交**。那边以 `MC_AUTOCONNECT=false` 启动，全部进出服与任务都由 AI 通过 HTTP 下发。

## 游戏内指令

只有 `owners` 里的玩家能下指令：公屏消息以 `!` 或 `！` 开头，或直接私聊机器人（私聊可以不带前缀，回复也走私聊）。

| 指令 | 作用 |
| --- | --- |
| `!进服 <host> [port] [version]` | 连接（或换到）指定服务器 |
| `!退服` | 断开当前服务器，停止所有任务 |
| `!状态` | 报告位置、血量、饥饿、当前任务 |
| `!停` | 停止当前任务 |
| `!去 x y z` | 寻路到坐标 |
| `!飞 x y z` | 鞘翅飞过去并降落 |
| `!跟随 [玩家]` | 跟随玩家（默认跟随 lastFollow） |
| `!过来` | 走到指令发送者身边 |
| `!收集 <方块> [数量]` | 扫描并挖掘指定方块，如 `!收集 diamond_ore 8` |
| `!发育` | 自动发育：砍树、挖矿、做钻石套 |
| `!打 [玩家]` | 近战攻击目标 |
| `!重锤 [玩家]` | 用重锤跳劈 |
| `!代发 <内容>` | 让机器人发一条公屏消息 |
| `!服务器命令 <cmd>` | 执行服务器命令（如 `spawn`、`home`），自动补 `/` |
| `!矿透 开/关/auto` | 切换反矿透策略（auto 会探测服务器是否反矿透） |
| `!丢垃圾 [n]` | 丢弃背包里的杂物 |
| `!静默` / `!日志` / `!简报` | 切换回复模式：不说话 / 完整日志 / 只说结果 |
| `!帮助` | 指令列表 |

## 本机 HTTP 控制

默认只绑 `127.0.0.1:2319`（`MC_CTL_PORT` 可改），**不要直接暴露到公网**。

```bash
curl http://127.0.0.1:2319/state
curl "http://127.0.0.1:2319/cmd?cmd=status"
curl -X POST http://127.0.0.1:2319/cmd -H 'content-type: application/json' -d '{"cmd":"goto 100 64 100"}'
```

`/cmd` 会立即返回 `{ ok, pending, reply, state }`；`pending: true` 表示指令已接受、还在执行（寻路这类耗时任务）。

## 文件说明

| 文件 | 说明 |
| --- | --- |
| `headless.js` | 主程序：连接、登录、任务状态机、指令分发、HTTP 控制 |
| `baritone.js` | Baritone 关键逻辑移植：矿石扫描、`Goal*`、`prune`、`blacklist` |
| `baritone-ref/` | Baritone 原版 Java 参考源码，仅供对照，不参与运行 |
| `config.example.json` | 配置模板 |
| `.gitignore` | 已排除 `config.json`、`.bot-state*`、`mc-server/`、日志等 |

## 免责声明

请只在**你有权限**的服务器上使用。绕反作弊、自动采矿等功能可能违反服务器规则，后果自负。
