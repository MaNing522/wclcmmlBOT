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

app.use(express.static(path.join(__dirname, 'web-gui')));

let clients = [];
let bot = null;
let reconnectTimer = null;
let statusInterval = null;
let reconnectDisabled = false;
let consecutiveFailures = 0;
const MAX_FAILURES = 10;

// ---------- WebSocket ----------
wss.on('connection', (ws) => {
  console.log('🌐 Web 客户端已连接');
  clients.push(ws);
  if (bot && bot.entity) sendStatusToClient(ws);
  ws.on('close', () => {
    clients = clients.filter(c => c !== ws);
    console.log('🌐 Web 客户端断开');
  });
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      handleWebMessage(data);
    } catch (err) {
      console.error('WebSocket 消息解析失败:', err);
    }
  });
});

function broadcast(channel, data) {
  const payload = JSON.stringify({ channel, data });
  clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) client.send(payload);
  });
}

function sendStatusToClient(ws) {
  if (!bot || !bot.entity) {
    ws.send(JSON.stringify({ channel: 'status', data: { online: false } }));
    return;
  }
  try {
    const { x, y, z } = bot.entity.position;
    const health = bot.health || 20;
    const food = bot.food || 20;
    ws.send(JSON.stringify({
      channel: 'status',
      data: { online: true, position: { x, y, z }, health, food }
    }));
  } catch {
    ws.send(JSON.stringify({ channel: 'status', data: { online: false } }));
  }
}

function handleWebMessage(data) {
  const { type, payload } = data;
  if (type === 'command') {
    if (!bot) { broadcast('log', '⚠️ 机器人未连接'); return; }
    let cmd = payload;
    if (cmd.startsWith('!') || cmd.startsWith('！')) cmd = cmd.slice(1).trim();
    // 模拟来自主人的消息（web 命令视为主人）
    chatController.executeCommand(bot, config.bot.owner, cmd, false);
  } else if (type === 'chat') {
    if (!bot) { broadcast('log', '⚠️ 机器人未连接'); return; }
    bot.chat(payload);
    broadcast('log', `💬 机器人说: "${payload}"`);
  }
}

function sendToGui(channel, data) {
  broadcast(channel, data);
}

function sendStatus() {
  if (!bot || !bot.entity) {
    broadcast('status', { online: false });
    return;
  }
  try {
    const { x, y, z } = bot.entity.position;
    const health = bot.health || 20;
    const food = bot.food || 20;
    broadcast('status', {
      online: true,
      position: { x, y, z },
      health,
      food
    });
  } catch {
    broadcast('status', { online: false });
  }
}

function getNextReconnectDelay() {
  const maxDelay = config.reconnect.maxDelay || 60000;
  const multiplier = config.reconnect.backoffMultiplier || 1.5;
  let delay = currentReconnectDelay;
  let next = Math.min(delay * multiplier, maxDelay);
  currentReconnectDelay = next;
  return delay;
}
let currentReconnectDelay = config.reconnect.initialDelay || 5000;

function initBot() {
  if (reconnectDisabled) {
    console.log('🚫 重连已禁用');
    return;
  }
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
      const delay = Math.floor(Math.random() * (3000) + 2000);
      const msg = `💀 死亡，${(delay/1000).toFixed(1)}秒后重生`;
      logger.log(msg);
      sendToGui('log', msg);
      if (bot.pathfinder) bot.pathfinder.setGoal(null);
      setTimeout(() => {
        if (bot && bot.respawn) {
          bot.respawn();
          sendToGui('log', '🔄 已重生');
        }
      }, delay);
    }
  });

  bot.once('spawn', () => {
    const defaultMove = new Movements(bot);
    defaultMove.digCost = 150;
    defaultMove.jumpCost = 1.2;
    defaultMove.fallDamageCheck = true;
    defaultMove.canSwim = true;
    defaultMove.canDig = false;
    defaultMove.canPlace = false;
    bot.pathfinder.setMovements(defaultMove);

    sendStatus();
    if (statusInterval) clearInterval(statusInterval);
    statusInterval = setInterval(sendStatus, 1000);

    const msg = `🤖 ${bot.username} 已上线！`;
    logger.log(msg);
    sendToGui('log', msg);
    sendToGui('status', { online: true, username: bot.username });

    consecutiveFailures = 0;
    currentReconnectDelay = config.reconnect.initialDelay || 5000;
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  });

  bot.on('chat', (username, message) => {
    sendToGui('log', `[聊天] ${username}: ${message}`);
  });

  bot.on('error', (err) => {
    const msg = `❌ 错误: ${err.message}`;
    logger.errorLog(msg);
    sendToGui('log', msg);
  });

  bot.on('end', (reason) => {
    const reasonStr = reason.toString();
    const msg = `🔌 断开: ${reasonStr}`;
    logger.log(msg);
    sendToGui('log', msg);
    sendToGui('status', { online: false });
    if (statusInterval) {
      clearInterval(statusInterval);
      statusInterval = null;
    }

    if (/login|register|password|authenticate|验证|登录|kick|banned|whitelist|disconnect/i.test(reasonStr)) {
      reconnectDisabled = true;
      logger.log(`⚠️ 永久断开，停止重连: ${reasonStr}`);
      sendToGui('log', `⚠️ 永久断开，停止重连`);
      return;
    }

    if (config.reconnect.enabled && !reconnectDisabled) {
      consecutiveFailures++;
      if (consecutiveFailures > MAX_FAILURES) {
        reconnectDisabled = true;
        const finalMsg = `❌ 连续失败 ${consecutiveFailures} 次，停止重连`;
        logger.log(finalMsg);
        sendToGui('log', finalMsg);
        return;
      }
      const delay = getNextReconnectDelay();
      const retryMsg = `🔄 ${(delay/1000).toFixed(1)}秒后第 ${consecutiveFailures} 次重连`;
      logger.log(retryMsg);
      sendToGui('log', retryMsg);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      reconnectTimer = setTimeout(() => initBot(), delay);
    }
  });
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🌐 Web 控制台: http://localhost:${PORT}`);
  console.log('⏳ 启动机器人...');
  initBot();
});

process.on('SIGINT', () => {
  console.log('🛑 正在关闭...');
  reconnectDisabled = true;
  if (reconnectTimer) clearTimeout(reconnectTimer);
  if (statusInterval) clearInterval(statusInterval);
  if (bot) bot.end('服务器关闭');
  setTimeout(() => server.close(() => process.exit(0)), 1000);
});