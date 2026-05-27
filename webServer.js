// modules/webServer.js
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const config = require('../config.json');
const { enable: enableAutoAttack, disable: disableAutoAttack, isActive: isAutoAttackActive } = require('./autoAttack');
const { sendChat } = require('./messageQueue');
const { getBot } = require('./state');
const { getRecentLogs } = require('./logger');
const { consoleChat } = require('./chatHandler');
const { loadWarehouse, scanWarehouse } = require('./storage');
const { translate } = require('./lang');
const mcDataLib = require('minecraft-data');

function startWebServer() {
  if (!config.webControl.enabled) return;
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '50kb' }));

  const assetsPath = path.join(__dirname, '..', 'assets', 'minecraft', 'textures');
  if (fs.existsSync(assetsPath)) {
    app.use('/assets/item', express.static(path.join(assetsPath, 'item')));
    app.use('/assets/block', express.static(path.join(assetsPath, 'block')));
    console.log(`离线图标已启用: ${assetsPath}`);
  }

  function auth(req, res, next) {
    if (!config.webControl.requireApiKey) return next();
    if ((req.query.key || req.headers['x-api-key']) === config.webControl.apiKey) next();
    else res.status(403).json({ error: 'API Key 错误' });
  }

  // 清怪开关
  app.post('/monster/on', auth, (req, res) => {
    const bot = getBot(); if (bot) enableAutoAttack(bot);
    res.json({ status: '自动清怪已开启' });
  });
  app.post('/monster/off', auth, (req, res) => {
    const bot = getBot(); if (bot) disableAutoAttack(bot);
    res.json({ status: '自动清怪已关闭' });
  });

  // 状态接口
  app.get('/status', auth, (req, res) => {
    const bot = getBot();
    const online = !!(bot && bot.entity);
    const invSlots = [];
    if (bot?.inventory) {
      const mcData = mcDataLib(bot.version);
      const items = bot.inventory.items();
      const itemMap = new Map(); items.forEach(item => itemMap.set(item.slot, item));
      for (let i = 0; i < 45; i++) {
        const item = itemMap.get(i);
        if (item) {
          let icon = `/assets/item/${item.name}.png`;
          if (mcData.blocksByName[item.name]) icon = `/assets/block/${item.name}.png`;
          invSlots.push({
            slot: i, name: item.name,
            displayName: translate(item.name),
            count: item.count, type: item.type, icon
          });
        } else invSlots.push(null);
      }
    }
    const players = [];
    if (online) {
      for (const name of Object.keys(bot.players)) {
        if (name === bot.username) continue;
        const player = bot.players[name];
        const pData = { name, online: true };
        if (player?.entity) {
          const e = player.entity.equipment || {};
          pData.health = typeof player.entity.health === 'number' ? player.entity.health : 0;
          pData.maxHealth = typeof player.entity.maxHealth === 'number' ? player.entity.maxHealth : 20;
          pData.food = typeof player.entity.food === 'number' ? player.entity.food : 0;
          pData.gamemode = player.gamemode ?? '?';
          pData.equipment = {
            hand: itemToIcon(e.hand, bot),
            offhand: itemToIcon(e.offhand, bot),
            head: itemToIcon(e.head, bot),
            torso: itemToIcon(e.torso, bot),
            legs: itemToIcon(e.legs, bot),
            feet: itemToIcon(e.feet, bot)
          };
        }
        players.push(pData);
      }
    }
    const botEquip = {
      hand: itemToIcon(bot?.heldItem, bot),
      offhand: itemToIcon(bot?.inventory?.slots[45], bot),
      head: itemToIcon(bot?.inventory?.slots[5], bot),
      torso: itemToIcon(bot?.inventory?.slots[6], bot),
      legs: itemToIcon(bot?.inventory?.slots[7], bot),
      feet: itemToIcon(bot?.inventory?.slots[8], bot)
    };
    const latency = bot?.player?.ping != null ? bot.player.ping : -1;

    res.json({
      autoAttackActive: isAutoAttackActive,
      online,
      health: typeof bot?.health === 'number' ? bot.health : 0,
      maxHealth: typeof bot?.maxHealth === 'number' ? bot.maxHealth : 20,
      food: typeof bot?.food === 'number' ? bot.food : 0,
      tps: require('./tps').getTps() || 0,
      latency, inventory: invSlots, players, botEquipment: botEquip
    });
  });

  // 聊天/指令接口
  app.post('/chat', auth, (req, res) => {
    const bot = getBot();
    if (!bot?.entity) return res.status(400).json({ error: 'Bot 未在线' });
    const message = req.body.message;
    if (!message) return res.status(400).json({ error: '消息不能为空' });
    if (message.length > 200) return res.status(400).json({ error: '消息过长（超过200字符）' });
    if (message.startsWith('!')) {
      try { consoleChat(message); res.json({ success: true, message: '指令已执行' }); }
      catch (e) { res.json({ success: true, message: '指令执行出错' }); }
    } else {
      sendChat(bot, message); res.json({ success: true });
    }
  });

  app.get('/api/logs', auth, (req, res) => res.json({ logs: getRecentLogs() }));

  app.get('/api/state', auth, (req, res) => {
    const state = require('./state');
    const now = Date.now();
    res.json({
      opCount: state.opList.size,
      hasPersistentPassword: !!state.persistentPassword,
      hasTempPassword: !!state.tempPassword && (state.tempPasswordExpiry > now),
      tempPasswordExpiry: state.tempPasswordExpiry || 0,
      tempAuthUsers: Array.from(state.tempAuth.keys()).map(user => ({
        name: user,
        remainingMinutes: Math.max(0, Math.ceil((state.getTempAuthExpiry(user) - now) / 60000))
      }))
    });
  });

  app.get('/api/oplist', auth, (req, res) => {
    const { opList } = require('./state');
    res.json(Array.from(opList));
  });

  app.get('/api/knownplayers', auth, (req, res) => {
    const { knownPlayers } = require('./state');
    res.json(Array.from(knownPlayers));
  });

  app.post('/api/setpassword', auth, (req, res) => {
    const { password } = req.body;
    if (typeof password !== 'string') return res.status(400).json({ error: '密码必须为字符串' });
    const { setPersistentPassword } = require('./state');
    setPersistentPassword(password);
    res.json({ success: true, message: '持久密码已更新' });
  });

  app.get('/api/config', auth, (req, res) => {
    try { res.json(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'config.json'), 'utf8'))); }
    catch (e) { res.status(500).json({ error: '读取配置失败' }); }
  });
  app.post('/api/config', auth, (req, res) => {
    try {
      if (!req.body || typeof req.body !== 'object') throw new Error('无效的配置');
      fs.writeFileSync(path.join(__dirname, '..', 'config.json'), JSON.stringify(req.body, null, 2), 'utf8');
      res.json({ success: true, message: '配置已保存，重启 Bot 后生效。' });
    } catch (e) { res.status(400).json({ error: e.message }); }
  });

  app.post('/restart', auth, (req, res) => {
    res.json({ success: true, message: 'Bot 正在关闭，请稍后重新启动。' });
    setTimeout(() => { console.log('通过网页指令重启...'); process.exit(0); }, 500);
  });

  // 仓库接口
  app.get('/api/warehouse', auth, (req, res) => {
    const bot = getBot();
    const online = !!(bot && bot.entity);
    const items = loadWarehouse();
    const mcData = bot ? mcDataLib(bot.version) : require('minecraft-data')('1.21.11');
    const enriched = items.map(item => {
      const itemDef = mcData.items[item.type];
      const name = item.name;
      const cnName = item.displayName || translate(name);
      let icon = `/assets/item/${name}.png`;
      if (mcData.blocksByName[name]) icon = `/assets/block/${name}.png`;
      return { ...item, displayName: cnName, icon };
    });
    res.json({ items: enriched, online });
  });
  app.post('/api/warehouse/update', auth, async (req, res) => {
    const bot = getBot();
    if (!bot || !bot.entity) return res.status(400).json({ error: 'Bot 未在线' });
    try { await scanWarehouse(bot); res.json({ success: true }); }
    catch (e) { res.status(500).json({ error: e.message }); }
  });

  // 玩家统计接口
  app.get('/api/playerstats', auth, (req, res) => {
    const { getAllStats } = require('./playerStats');
    const stats = getAllStats();
    const formatDuration = (ms) => {
      if (!ms || ms <= 0) return '0分钟';
      const totalMinutes = Math.floor(ms / 60000);
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      if (hours > 0) return `${hours}小时${minutes}分钟`;
      return `${minutes}分钟`;
    };
    const formatted = stats.map(s => ({
      name: s.name,
      joinCount: s.joinCount,
      totalOnlineTime: s.totalOnlineTime,
      totalOnlineTimeFormatted: formatDuration(s.totalOnlineTime),
      lastJoinFormatted: s.lastJoin ? new Date(s.lastJoin).toLocaleString() : '从未',
      lastLeaveFormatted: s.lastLeave ? new Date(s.lastLeave).toLocaleString() : '从未'
    }));
    res.json(formatted);
  });

  // 静态页面
  app.get('/', (req, res) => res.sendFile(path.join(__dirname, '..', 'panel.html')));
  app.get('/config', (req, res) => res.sendFile(path.join(__dirname, '..', 'config.html')));
  app.get('/chat', (req, res) => res.sendFile(path.join(__dirname, '..', 'chat.html')));
  app.get('/help', (req, res) => res.sendFile(path.join(__dirname, '..', 'help.html')));
  app.get('/storage', (req, res) => res.sendFile(path.join(__dirname, '..', 'storage.html')));
  app.get('/warehouse', (req, res) => res.sendFile(path.join(__dirname, '..', 'warehouse.html')));
  app.get('/op', (req, res) => res.sendFile(path.join(__dirname, '..', 'op.html')));
  app.get('/playerstats', (req, res) => res.sendFile(path.join(__dirname, '..', 'player_stats.html')));

  app.listen(config.webControl.port, () => console.log(`网页控制已启动: http://localhost:${config.webControl.port}`));
}

function itemToIcon(item, bot) {
  if (!item) return { name: '空', icon: null, type: -1 };
  const mcData = bot ? mcDataLib(bot.version) : require('minecraft-data')('1.21.11');
  let icon = `/assets/item/${item.name}.png`;
  if (mcData.blocksByName[item.name]) icon = `/assets/block/${item.name}.png`;
  return { name: translate(item.name), icon, type: item.type };
}

module.exports = { startWebServer };