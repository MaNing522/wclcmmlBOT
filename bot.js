require('events').EventEmitter.defaultMaxListeners = 0;

const originalError = console.error;
console.error = function (...args) {
  if (args.map(String).join(' ').includes('PartialReadError')) return;
  originalError.apply(console, args);
};
const originalStderrWrite = process.stderr.write.bind(process.stderr);
process.stderr.write = function (chunk, encoding, callback) {
  if (typeof chunk === 'string' && chunk.includes('PartialReadError')) return true;
  return originalStderrWrite(chunk, encoding, callback);
};

const dns = require('dns').promises;
const mineflayer = require('mineflayer');
const pathfinder = require('mineflayer-pathfinder').pathfinder;
const pvp = require('mineflayer-pvp').plugin;
const { createBaritoneLikeMovements } = require('./baritoneMovements');
const config = require('./config.json');
const { setBot, getBot, loadState, addKnownPlayer, loadKnownPlayers } = require('./modules/state');
const { sendChat } = require('./modules/messageQueue');
const { onChat, onWhisper, consoleChat } = require('./modules/chatHandler');
const { survivalTasks } = require('./modules/survival');
const { enableAutoSleep } = require('./modules/autoSleep');
const { startWebServer } = require('./modules/webServer');
const { tick } = require('./modules/tps');
const { logEvent } = require('./modules/logger');
const mcDataLib = require('minecraft-data');
const readline = require('readline');
const { playerJoined: statsJoined, playerLeft: statsLeft } = require('./modules/playerStats');

// 新增功能模块
const { startAutoFish, stopAutoFish } = require('./modules/autoFish');
const { startAutoFarm, stopAutoFarm } = require('./modules/autoFarm');
const { startContextMemory, cleanupContextMemory } = require('./modules/contextMemory');

let isExiting = false;
let reconnectTimer = null;
let rl = null;
const lastMasterLeft = {};
let reconnectAttempts = 0;
const baseDelay = 3500;
const maxDelay = 60000;

async function resolveServerAddress(host, port) {
  if (port === 25565) {
    try {
      const records = await dns.resolveSrv(`_minecraft._tcp.${host}`);
      if (records && records.length > 0) {
        const best = records[0];
        console.log(`[SRV] 解析到 ${host} → ${best.name}:${best.port}`);
        return { host: best.name, port: best.port };
      }
    } catch (e) {
      console.log(`[SRV] 无记录或解析失败，使用配置文件端口`);
    }
  }
  return { host, port };
}

function setSafeConsole(rlInstance) {
  const originalLog = console.log;
  console.log = function (...args) {
    if (!rlInstance || rlInstance.closed || !process.stdout.isTTY) return originalLog.apply(console, args);
    const line = rlInstance.line, cursor = rlInstance.cursor;
    process.stdout.write('\x1b[2K\r');
    originalLog.apply(console, args);
    if (line != null) {
      process.stdout.write(line);
      if (cursor < line.length) process.stdout.write(`\x1b[${line.length - cursor}D`);
    }
  };
  const prevError = console.error;
  console.error = function (...args) {
    const text = args.map(String).join(' ');
    if (text.includes('PartialReadError')) return;
    if (!rlInstance || rlInstance.closed || !process.stdout.isTTY) return prevError.apply(console, args);
    const line = rlInstance.line, cursor = rlInstance.cursor;
    process.stdout.write('\x1b[2K\r');
    prevError.apply(console, args);
    if (line != null) {
      process.stdout.write(line);
      if (cursor < line.length) process.stdout.write(`\x1b[${line.length - cursor}D`);
    }
  };
}

function startLeakCleaner(bot) {
  setInterval(() => {
    const client = bot._client;
    if (!client) return;
    const digAbortedCount = client.listenerCount('diggingAborted');
    const digCompletedCount = client.listenerCount('diggingCompleted');
    if (digAbortedCount > 50 || digCompletedCount > 50) {
      client.removeAllListeners('diggingAborted');
      client.removeAllListeners('diggingCompleted');
      logEvent(`[清理] 已释放 ${digAbortedCount} 个 diggingAborted / ${digCompletedCount} 个 diggingCompleted 监听器`);
    }
  }, 10000);
}

async function createBot() {
  const { host, port } = await resolveServerAddress(config.server.host, config.server.port);
  const bot = mineflayer.createBot({
    host, port,
    username: config.server.username,
    auth: config.server.auth,
    version: config.server.version,
    brand: 'vanilla',
    checkTimeoutInterval: 60 * 1000,
    hideErrors: false
  });
  setBot(bot);
  bot.loadPlugin(pathfinder);
  bot.loadPlugin(pvp);
  bot.on('physicsTick', tick);
  bot.once('spawn', onSpawn);
  if (config.autoRespawn) bot.on('death', onDeath);
  bot.on('chat', onChat);
  bot.on('whisper', onWhisper);

  bot.on('playerJoined', (player) => {
    const name = player.username;
    if (name === bot.username) return;
    addKnownPlayer(name);
    statsJoined(name);
    logEvent(`玩家上线: ${name}`);
    console.log(`[上线] ${name}`);
    
    // 留言功能
    if (config.messageBoard?.enabled) {
      setTimeout(() => {
        const botInstance = getBot();
        if (!botInstance || !botInstance.entity) return;
        if (!botInstance.players[name]) return;
        const { takeMessages } = require('./modules/messageBoard');
        const messages = takeMessages(name);
        if (messages.length === 0) return;
        sendChat(botInstance, `/msg ${name} 你有 ${messages.length} 条未读留言：`);
        for (const msg of messages) {
          const time = new Date(msg.timestamp).toLocaleString();
          sendChat(botInstance, `/msg ${name} [${time}] ${msg.from} 说：${msg.content}`);
        }
      }, (config.messageBoard.delaySeconds || 10) * 1000);
    }
    
    setTimeout(() => {
      const p = bot.players[name];
      if (!p) return;
      const gm = p.gamemode;
      const isCreativeOrSpectator = (gm === 1 || gm === 3);
      if (name === config.master) {
        const now = Date.now();
        const lastLeft = lastMasterLeft[config.master] || 0;
        if (now - lastLeft > 600000) sendChat(bot, `牛逼吊炸天的 ${name} 上线了！`);
      } else if (isCreativeOrSpectator) {
        sendChat(bot, `更牛逼吊炸天的 ${name} 上线了！`);
      }
    }, 500);
  });

  bot.on('playerLeft', (player) => {
    const name = player.username;
    if (name === bot.username) return;
    statsLeft(name);
    logEvent(`玩家下线: ${name}`);
    console.log(`[下线] ${name}`);
    if (name === config.master) lastMasterLeft[config.master] = Date.now();
  });

  bot.on('entityGamemodeChange', (entity, gamemode) => {
    if (entity.type === 'player' && entity.username) {
      const modeNames = ['生存', '创造', '冒险', '旁观'];
      const modeName = modeNames[gamemode] || '未知';
      sendChat(bot, `${entity.username} 的游戏模式已变更为 ${modeName}`);
      logEvent(`游戏模式变更: ${entity.username} -> ${modeName}`);
    }
  });

  bot.on('end', onEnd);
  bot.on('error', err => logEvent(`Bot error: ${err.message}`));
  enableAutoSleep(bot);
  startLeakCleaner(bot);
}

async function onSpawn() {
  const bot = getBot();
  reconnectAttempts = 0;
  logEvent('wclcmml专属超级bot 已上线');
  if (config.login.password) {
    sendChat(bot, `/register ${config.login.password} ${config.login.password}`);
    setTimeout(() => sendChat(bot, `${config.login.command} ${config.login.password}`), config.loginDelay || 1000);
  }
  const mcData = mcDataLib(bot.version);
  const moves = createBaritoneLikeMovements(bot, mcData);
  bot.pathfinder.setMovements(moves);
  setInterval(() => survivalTasks(bot), 2000);
  if (config.autoAttack?.enabled) require('./modules/autoAttack').enable(bot);
  if (config.joinGuide?.enabled) setTimeout(() => require('./modules/autoGuide').start(bot), 2000);
  
  // 新增功能启动
  if (config.autoFish?.enabled) startAutoFish(bot);
  if (config.autoFarm?.enabled) startAutoFarm(bot);
  startContextMemory(bot);
}

function onDeath() {
  const bot = getBot();
  setTimeout(() => { if (bot._client) bot._client.write('client_command', { payload: 0 }); }, 1000);
}

function onEnd(reason) {
  logEvent(`连接断开: ${reason}`);
  if (!isExiting) {
    reconnectAttempts++;
    const delay = Math.min(baseDelay * Math.pow(2, reconnectAttempts - 1), maxDelay);
    logEvent(`将在 ${Math.round(delay / 1000)} 秒后重连...`);
    reconnectTimer = setTimeout(createBot, delay);
  }
}

function clearTimers() { if (reconnectTimer) clearTimeout(reconnectTimer); }

function setupConsole() {
  rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  setSafeConsole(rl);
  rl.on('line', (line) => {
    const trimmed = line.trim();
    if (trimmed) consoleChat(trimmed);
  });
  logEvent('控制台已就绪，可直接输入消息或 !指令');
}

process.on('SIGINT', () => {
  isExiting = true;
  clearTimers();
  if (rl) rl.close();
  const bot = getBot();
  if (bot) bot.quit();
  process.exit();
});

startWebServer();
createBot();
setupConsole();