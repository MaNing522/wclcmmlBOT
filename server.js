const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const mineflayer = require('mineflayer');
const pathfinder = require('mineflayer-pathfinder').pathfinder;
const Movements = require('mineflayer-pathfinder').Movements;
const config = require('./config');
const chatController = require('./chatController');
const actionExecutor = require('./actionExecutor');
const aiParser = require('./aiParser');
const loginHandler = require('./loginHandler');
const logger = require('./logger');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// 静态文件目录
app.use(express.static(path.join(__dirname, 'public')));

// 机器人实例
let bot = null;
let reconnectTimer = null;
let reconnectAttempts = 0;
let currentReconnectDelay = config.reconnect.initialDelay || 5000;
let statusInterval = null;
let wsClients = [];

// ---------- WebSocket 广播 ----------
function broadcast(data) {
  const message = JSON.stringify(data);
  wsClients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

function sendStatus() {
  if (!bot || !bot.entity) {
    broadcast({ type: 'status', data: { online: false } });
    return;
  }
  try {
    const { x, y, z } = bot.entity.position;
    const health = bot.health || 20;
    const food = bot.food || 20;
    broadcast({ type: 'status', data: { online: true, position: { x, y, z }, health, food } });
  } catch (err) {
    broadcast({ type: 'status', data: { online: false } });
  }
}

function sendLog(message, level = 'info') {
  broadcast({ type: 'log', data: { message, level } });
  logger.log(message);
}

// ---------- 初始化机器人 ----------
function initBot() {
  if (bot) {
    bot.end('重新启动');
    bot = null;
  }
  if (statusInterval) {
    clearInterval(statusInterval);
    statusInterval = null;
  }

  bot = mineflayer.createBot({
    host: config.server.host,
    port: config.server.port,
    username: config.bot.username,
    version: config.server.version,
    checkTimeoutInterval: 60 * 1000
  });

  bot.loadPlugin(pathfinder);
  chatController.load(bot);
  actionExecutor.load(bot);
  loginHandler.load(bot);

  bot.on('death', () => {
    if (config.features.autoRespawn) {
      const delayMin = config.features.respawnDelayMin || 2000;
      const delayMax = config.features.respawnDelayMax || 5000;
      const delay = Math.floor(Math.random() * (delayMax - delayMin + 1)) + delayMin;
      sendLog(`💀 玩家死亡，将在 ${(delay/1000).toFixed(1)} 秒后重生`);
      setTimeout(() => {
        if (bot && bot.respawn) {
          bot.respawn();
          sendLog('🔄 已发送重生请求');
        }
      }, delay);
    } else {
      sendLog('💀 玩家死亡，自动重生已禁用');
    }
  });

  bot.once('spawn', () => {
    const defaultMove = new Movements(bot);
    defaultMove.canDig = false;
    defaultMove.canPlace = false;
    bot.pathfinder.setMovements(defaultMove);

    sendStatus();
    if (statusInterval) clearInterval(statusInterval);
    statusInterval = setInterval(sendStatus, 1000);

    sendLog(`🤖 机器人 ${bot.username} 已上线！`);
    reconnectAttempts = 0;
    currentReconnectDelay = config.reconnect.initialDelay || 5000;
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  });

  bot.on('chat', (username, message) => {
    sendLog(`[聊天] ${username}: ${message}`);
  });

  bot.on('error', (err) => {
    sendLog(`❌ 错误: ${err.message}`, 'error');
  });

  bot.on('end', (reason) => {
    sendLog(`🔌 断开连接: ${reason}`);
    broadcast({ type: 'status', data: { online: false } });
    if (statusInterval) {
      clearInterval(statusInterval);
      statusInterval = null;
    }

    if (config.reconnect.enabled) {
      const maxAttempts = config.reconnect.maxAttempts || 0;
      reconnectAttempts++;
      if (maxAttempts > 0 && reconnectAttempts > maxAttempts) {
        sendLog(`❌ 达到最大重连次数 (${maxAttempts})，停止重连`);
        return;
      }
      const delay = getNextReconnectDelay();
      sendLog(`🔄 将在 ${(delay/1000).toFixed(1)} 秒后尝试第 ${reconnectAttempts} 次重连 (延迟策略)`);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      reconnectTimer = setTimeout(() => initBot(), delay);
    }
  });
}

function getNextReconnectDelay() {
  const maxDelay = config.reconnect.maxDelay || 60000;
  const multiplier = config.reconnect.backoffMultiplier || 1.5;
  let delay = currentReconnectDelay;
  let next = Math.min(delay * multiplier, maxDelay);
  currentReconnectDelay = next;
  return delay;
}

// ---------- WebSocket 连接处理 ----------
wss.on('connection', (ws) => {
  wsClients.push(ws);
  console.log('🔌 新客户端连接，当前客户端数:', wsClients.length);

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      switch (data.type) {
        case 'command':
          if (!bot) {
            sendLog('⚠️ 机器人未连接，请等待重连');
            return;
          }
          let cmd = data.payload;
          if (cmd.startsWith('!') || cmd.startsWith('！')) {
            cmd = cmd.slice(1).trim();
          }
          aiParser.parseAndExecute(bot, cmd);
          break;
        case 'message':
          if (!bot) {
            sendLog('⚠️ 机器人未连接，无法发送消息');
            return;
          }
          bot.chat(data.payload);
          sendLog(`💬 机器人说: "${data.payload}"`);
          break;
        default:
          console.warn('未知消息类型:', data.type);
      }
    } catch (err) {
      console.error('处理WebSocket消息错误:', err);
    }
  });

  ws.on('close', () => {
    wsClients = wsClients.filter(client => client !== ws);
    console.log('🔌 客户端断开，当前客户端数:', wsClients.length);
  });

  // 发送当前状态
  sendStatus();
});

// ---------- 启动 HTTP 服务器 ----------
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🌐 网页控制台已启动: http://localhost:${PORT}`);
  console.log(`📱 局域网访问: http://<你的IP>:${PORT}`);
  // 自动启动机器人
  initBot();
});

// 优雅关闭
process.on('SIGINT', () => {
  if (bot) bot.end('服务器关闭');
  server.close(() => process.exit(0));
});