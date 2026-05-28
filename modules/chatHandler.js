const config = require('../config.json');
const { sendChat } = require('./messageQueue');
const { askAI } = require('./aiChat');
const { comeToPlayer, startFollowing, stopFollowing } = require('./movement');
const { startSpam, stopAllSpam } = require('./spam');
const { enable: enableAutoAttack, disable: disableAutoAttack } = require('./autoAttack');
const { startHunt, stopHunt } = require('./hunt');
const { getBot, savedPositions, opList,
  setPersistentPassword, checkPersistentPassword,
  setTempPassword, checkTempPassword,
  addTempAuth, hasTempAuth, removeTempAuth, getTempAuthExpiry
} = require('./state');
const { logEvent } = require('./logger');
const { checkStorage, depositStorage, takeStorage, takeAllStorage, scanWarehouse } = require('./storage');
const { addMessage } = require('./messageBoard');
const { rollDice, drawLottery } = require('./diceLottery');
const { startGuessGame, guessNumber, stopGuessGame, getGuessStats } = require('./guessGame');
const { pokePlayer } = require('./poke');
const { getPlayerProfile } = require('./profile');
const { clearPlayerContext } = require('./contextMemory');
const { setPathfinderMode } = require('./pathfinderExt');
const { startAutoFish, stopAutoFish, isFishing } = require('./autoFish');
const { startAutoFarm, stopAutoFarm, isFarming } = require('./autoFarm');

const MAX_MSG_LENGTH = 200;

function sendPrivate(bot, username, msg) { sendChat(bot, `/msg ${username} ${msg}`); }
function itemName(item) { return item ? (item.displayName || item.name) : '空'; }

function generateRandomPassword() {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
  return result;
}

async function processChat(username, message, source, reply) {
  const bot = getBot(); if (!bot) return;
  const isMaster = config.master === username;
  const isConsole = source === 'console';
  let hasOp = isMaster || opList.has(username) || isConsole;
  if (!hasOp && hasTempAuth(username)) hasOp = true;

  const msg = message.trim();
  if (msg.length > MAX_MSG_LENGTH) {
    reply(`消息过长（超过${MAX_MSG_LENGTH}字符），已拒绝发送。`);
    return;
  }

  const args = msg.split(/\s+/);
  const cmd = args[0]?.toLowerCase();

  // ===== 公开命令 =====
  if (cmd === '!tps') {
    const { getTps } = require('./tps'); const tps = getTps();
    reply(tps === null ? 'TPS 计算中...' : `当前 TPS: ${tps.toFixed(1)} (估算) ~ ${tps >= 18 ? '流畅' : tps >= 12 ? '一般' : '卡顿'}`);
    return;
  }

  if (cmd === '!status') {
    const targetName = args[1] || username;
    if (targetName === bot.username) {
      const { getTps } = require('./tps'); const tps = getTps();
      const held = bot.heldItem, h = bot.inventory.slots[5], c = bot.inventory.slots[6],
            l = bot.inventory.slots[7], b = bot.inventory.slots[8];
      reply(`[Bot] 生命:${bot.health.toFixed(1)}/${bot.maxHealth} 饥饿:${bot.food.toFixed(1)}/20 TPS:${tps ? tps.toFixed(1) : '...'} 清怪:${require('./autoAttack').isActive ? '开' : '关'} | 手持:${itemName(held)} 盔甲:${itemName(h)}/${itemName(c)}/${itemName(l)}/${itemName(b)}`);
      return;
    }
    if (targetName === config.master || opList.has(targetName)) {
      reply(`玩家 ${targetName} 是管理员，无法查看状态`);
      return;
    }
    const player = bot.players[targetName];
    if (!player?.entity) { reply(`玩家 ${targetName} 不在线或不可见`); return; }
    const e = player.entity.equipment || {};
    reply(`[玩家 ${targetName}] 生命:${player.entity.health ?? '?'} 饥饿:${player.entity.food ?? '?'} 模式:${player.gamemode ?? '?'} | 主手:${itemName(e.hand)} 副手:${itemName(e.offhand)} 头:${itemName(e.head)} 胸:${itemName(e.torso)} 腿:${itemName(e.legs)} 脚:${itemName(e.feet)}`);
    return;
  }

  if (cmd === '!player') {
    const players = Object.values(bot.players).filter(p => p.username !== bot.username);
    reply(players.length === 0 ? '没有其他玩家在线' : `在线玩家 (${players.length}): ${players.map(p => p.username).join(', ')}`);
    return;
  }

  if (cmd === '!help') {
    reply('==== wclcmml专属超级bot 帮助 ====');
    reply('【公开】!tps !status [玩家] !player !chat <消息> !sleep');
    reply('!dice [面数] !lottery [池] !guess start/数字/stop !poke <玩家> !profile [玩家]');
    reply('!fish on/off !farm on/off !clearchat');
    reply('【OP/控制台】!mark <名> !pos <名> [玩家] !send <消息> !come !follow !stop');
    reply('!dropall !spam <玩家> <次数> <消息> !spamall <次数> <消息> !stopspam');
    reply('!monster on/off !kill <玩家> !hunt <玩家> !td');
    reply('!use <槽位> !drop <槽位> !lag on/off !pathmode safe/fast');
    reply('存放 / 检查 / 拿取 <物品名1> <数量1> ... / 拿取 全部');
    reply('!storage check/deposit/take/takeall/update');
    reply('【权限】!authme <密码> (私聊) !authstatus');
    reply('!setpassword <密码> (主人) / !temppassword [分钟] (主人)');
    reply('!auth <玩家> [分钟] (主人) / !deauth <玩家> (主人)');
    reply('控制台: 直接输入文本=公屏发言, !指令=执行命令');
    return;
  }

  if (cmd === '!chat') {
    if (!config.ai.enabled) { reply('AI 未开启'); return; }
    const question = args.slice(1).join(' '); if (!question) { reply('用法: !chat <消息>'); return; }
    try { reply(`[AI] ${await askAI(username, question)}`); } catch { reply('AI 错误'); }
    return;
  }

  if (cmd === '!sleep') {
    const radius = config.sleepRadius || 10;
    const bed = bot.findBlock({ matching: block => block.name.includes('bed'), maxDistance: radius });
    if (!bed) { reply(`附近 ${radius} 格内没有床`); return; }
    try { await bot.sleep(bed); reply('我已躺在床上'); } catch (e) { reply('无法睡觉'); }
    return;
  }

  if (cmd === '!stopspam') { stopAllSpam(); reply('已停止所有刷屏'); return; }
  if (cmd === '!td' || cmd === '!trapdoor') {
    const blocks = bot.findBlocks({ matching: block => block.name.includes('trapdoor') && block.getProperties()['open'] === true, maxDistance: 5, count: 1 });
    if (blocks.length === 0) { reply('未找到附近打开的活版门'); return; }
    try { await bot.activateBlock(bot.blockAt(blocks[0])); reply('已拉下活版门'); } catch { reply('操作失败'); }
    return;
  }

  // ===== 新增功能指令 =====
  if (cmd === '!dice') {
    const max = args[1] ? parseInt(args[1]) : config.funCommands?.defaultDiceSides || 6;
    if (isNaN(max) || max < 1) { reply('面数必须为正整数'); return; }
    const result = rollDice(max);
    reply(`${username} 掷出了 ${result} 点 (1~${max})`);
    return;
  }
  if (cmd === '!lottery') {
    const customPool = args[1] ? args[1].split(',') : null;
    const result = drawLottery(customPool);
    reply(`${username} 抽签结果：${result}`);
    return;
  }
  if (cmd === '!guess') {
    if (args.length < 2) { reply('用法: !guess start / <数字> / stop / stats'); return; }
    const sub = args[1].toLowerCase();
    if (sub === 'start') {
      reply(startGuessGame(username));
    } else if (sub === 'stop') {
      reply(stopGuessGame(username));
    } else if (sub === 'stats') {
      reply(getGuessStats(username));
    } else {
      const num = parseInt(sub);
      if (isNaN(num)) { reply('请输入数字或有效子命令'); return; }
      reply(guessNumber(username, num));
    }
    return;
  }
  if (cmd === '!poke') {
    if (args.length < 2) { reply('用法: !poke <玩家名>'); return; }
    const target = args[1];
    if (target === username) { reply('不能戳自己'); return; }
    const result = pokePlayer(bot, username, target);
    reply(result);
    return;
  }
  if (cmd === '!profile') {
    const target = args[1] || username;
    const profile = await getPlayerProfile(bot, target);
    reply(profile);
    return;
  }
  if (cmd === '!fish') {
    if (args.length < 2) { reply('用法: !fish on/off'); return; }
    const sub = args[1].toLowerCase();
    if (sub === 'on') {
      startAutoFish(bot);
      reply('自动钓鱼已开启');
    } else if (sub === 'off') {
      stopAutoFish(bot);
      reply('自动钓鱼已关闭');
    } else reply('用法: !fish on/off');
    return;
  }
  if (cmd === '!farm') {
    if (args.length < 2) { reply('用法: !farm on/off'); return; }
    const sub = args[1].toLowerCase();
    if (sub === 'on') {
      startAutoFarm(bot);
      reply('自动农场已开启');
    } else if (sub === 'off') {
      stopAutoFarm(bot);
      reply('自动农场已关闭');
    } else reply('用法: !farm on/off');
    return;
  }
  if (cmd === '!pathmode') {
    if (args.length < 2) { reply(`当前模式: ${config.pathfinder?.mode || 'safe'}，用法: !pathmode safe/fast`); return; }
    const mode = args[1].toLowerCase();
    if (mode === 'safe' || mode === 'fast') {
      setPathfinderMode(bot, mode);
      reply(`路径模式已切换为 ${mode}`);
    } else reply('模式只能是 safe 或 fast');
    return;
  }
  if (cmd === '!clearchat') {
    clearPlayerContext(username);
    reply('你的对话记忆已清空');
    return;
  }

  // ===== OP 管理 =====
  if ((isMaster || isConsole) && cmd === '!op') { if (args.length < 2) reply('用法: !op <玩家>'); else { opList.add(args[1]); require('./state').saveState(); reply(`已将 ${args[1]} 设为操作员`); } return; }
  if ((isMaster || isConsole) && cmd === '!deop') { if (args.length < 2) reply('用法: !deop <玩家>'); else { opList.delete(args[1]); require('./state').saveState(); reply(`已移除 ${args[1]} 的操作员权限`); } return; }

  // ===== 密码与授权 =====
  if ((isMaster || isConsole) && cmd === '!setpassword') {
    if (args.length < 2) { reply('用法: !setpassword <密码>'); return; }
    setPersistentPassword(args[1]);
    reply('持久密码已设置。');
    return;
  }
  if ((isMaster || isConsole) && cmd === '!temppassword') {
    const minutes = parseInt(args[1]) || 30;
    if (isNaN(minutes) || minutes <= 0) { reply('分钟数必须大于0'); return; }
    const newPw = generateRandomPassword();
    setTempPassword(newPw, minutes);
    sendPrivate(bot, username, `临时密码: ${newPw} (有效期 ${minutes} 分钟)`);
    reply(`临时密码已生成并通过私聊发送，有效期 ${minutes} 分钟。`);
    return;
  }
  if (cmd === '!authstatus') {
    if (hasTempAuth(username)) {
      const remaining = Math.max(0, Math.ceil((getTempAuthExpiry(username) - Date.now()) / 60000));
      reply(`你当前拥有临时权限，剩余 ${remaining} 分钟。`);
    } else if (isMaster || opList.has(username)) {
      reply('你是永久管理员。');
    } else {
      reply('你没有特殊权限。');
    }
    return;
  }
  if ((isMaster || isConsole) && cmd === '!auth') {
    if (args.length < 2) { reply('用法: !auth <玩家> [分钟]'); return; }
    const target = args[1]; const minutes = parseInt(args[2]) || 10;
    addTempAuth(target, minutes);
    reply(`已授权 ${target} 临时权限 ${minutes} 分钟。`);
    return;
  }
  if ((isMaster || isConsole) && cmd === '!deauth') {
    if (args.length < 2) { reply('用法: !deauth <玩家>'); return; }
    removeTempAuth(args[1]);
    reply(`已移除 ${args[1]} 的临时权限。`);
    return;
  }

  // ===== 卡顿模式 =====
  if (cmd === '!lag') {
    if (!hasOp) return;
    const sub = args[1]?.toLowerCase();
    if (sub === 'on') { require('./lag').startLag(bot); reply('卡顿模式已开启'); }
    else if (sub === 'off') { require('./lag').stopLag(bot); reply('卡顿模式已关闭'); }
    else reply('用法: !lag on/off');
    return;
  }

  // ===== 存储命令 =====
  const isStorageCmd = (msg === '存放' || msg === '检查' || msg.startsWith('拿取') || cmd === '!storage');
  if (isStorageCmd && !config.storageEnabled) {
    reply('存储功能未开启');
    return;
  }
  if (hasOp && msg === '存放') {
    try { reply(await depositStorage(bot)); } catch (err) { reply('存放操作失败: ' + err.message); }
    return;
  }
  if (hasOp && msg === '检查') {
    try { reply(await checkStorage(bot)); } catch (err) { reply('检查失败: ' + err.message); }
    return;
  }
  if (hasOp && (msg === '拿取' || msg.startsWith('拿取 '))) {
    try {
      let result;
      const parts = msg.split(/\s+/);
      if (parts.length === 1) { reply('用法: 拿取 <物品名/ID> <数量> ... 或 拿取 全部'); return; }
      if (parts[1] === '全部') result = await takeAllStorage(bot);
      else result = await takeStorage(bot, parts.slice(1).join(' '));
      reply(result);
    } catch (err) { reply('拿取操作失败: ' + err.message); }
    return;
  }
  if (hasOp && cmd === '!storage') {
    const action = args[1]?.toLowerCase();
    try {
      let result;
      switch (action) {
        case 'check': result = await checkStorage(bot); break;
        case 'deposit': result = await depositStorage(bot); break;
        case 'take':
          if (args.length < 3) { reply('用法: !storage take <物品名1> <数量1> ...'); return; }
          result = await takeStorage(bot, args.slice(2).join(' ')); break;
        case 'takeall': result = await takeAllStorage(bot); break;
        case 'update': await scanWarehouse(bot); result = '仓库数据已更新'; break;
        default: reply('用法: !storage check/deposit/take/takeall/update'); return;
      }
      reply(result);
    } catch (err) { reply('存储操作失败: ' + err.message); }
    return;
  }

  // 留言功能（无需OP）
  if (cmd === '!tell') {
    if (args.length < 3) { reply('用法: !tell <玩家名> <留言内容>'); return; }
    const target = args[1];
    const content = args.slice(2).join(' ');
    if (content.length > 200) { reply('留言内容不能超过200字符'); return; }
    if (target === username) { reply('不能给自己留言'); return; }
    addMessage(target, username, content);
    reply(`已给 ${target} 留言，他上线后会收到。`);
    return;
  }

  // ===== 需要 OP 权限的指令 =====
  if (!hasOp) return;

  if (cmd === '!use') {
    if (args.length < 2) { reply('用法: !use <槽位>'); return; }
    const slot = parseInt(args[1]);
    if (isNaN(slot) || slot < 0 || slot > 44) { reply('槽位必须在 0~44 之间'); return; }
    const item = bot.inventory.slots[slot];
    if (!item) { reply('该槽位没有物品'); return; }
    try {
      await bot.equip(item, 'hand');
      if (typeof item.foodPoints === 'number' && item.foodPoints > 0) {
        await bot.consume(); reply(`正在吃 ${item.displayName || item.name}`);
      } else {
        bot.activateItem(); reply(`已使用 ${item.displayName || item.name}`);
      }
    } catch (e) { reply('使用物品失败'); }
    return;
  }

  if (cmd === '!drop') {
    if (args.length < 2) { reply('用法: !drop <槽位>'); return; }
    const slot = parseInt(args[1]);
    if (isNaN(slot) || slot < 0 || slot > 44) { reply('槽位必须在 0~44 之间'); return; }
    const item = bot.inventory.slots[slot];
    if (!item) { reply('该槽位没有物品'); return; }
    try { await bot.tossStack(item); reply(`已丢弃 ${item.displayName || item.name} (${item.count}个)`); } catch (e) { reply('丢弃物品失败'); }
    return;
  }

  if (cmd === '!dropall') {
    const items = bot.inventory.items(); if (items.length === 0) { reply('背包空'); return; }
    for (const item of items) await bot.tossStack(item); reply('已丢弃全部物品'); return;
  }

  if (cmd === '!mark') { if (args.length < 2) reply('用法: !mark <名称>'); else { const pos = bot.entity.position.floored(); savedPositions.set(args[1], { x: pos.x, y: pos.y, z: pos.z }); reply(`坐标 "${args[1]}" 已记录`); } return; }
  if (cmd === '!pos') {
    if (args.length < 2) { reply('用法: !pos <名称> [玩家]'); return; }
    const target = args[2] || username; const saved = savedPositions.get(args[1]);
    if (!saved) { reply(`未找到坐标 "${args[1]}"`); return; }
    sendChat(bot, `/msg ${target} [坐标] "${args[1]}" ${saved.x},${saved.y},${saved.z}`);
    if (target !== username) reply(`坐标 "${args[1]}" 已私发给 ${target}`); else reply(`坐标 "${args[1]}" 已私发给你`);
    return;
  }

  if (cmd === '!send' || cmd === '！发送') { const content = args.slice(1).join(' '); if (!content) reply('用法: !send <消息>'); else { sendChat(bot, content); reply('消息已代发'); } return; }
  if (cmd === '!spam') { if (args.length < 3) reply('用法: !spam <玩家> <次数> <消息>'); else startSpam(bot, args[1], parseInt(args[2]), args.slice(3).join(' '), true); reply(`已开始私聊刷屏 -> ${args[1]}`); return; }
  if (cmd === '!spamall') { if (args.length < 2) reply('用法: !spamall <次数> <消息>'); else startSpam(bot, null, parseInt(args[1]), args.slice(2).join(' '), false); reply('已开始公屏刷屏'); return; }
  if (cmd === '!monster') { const sub = args[1]?.toLowerCase(); if (sub === 'on') { enableAutoAttack(bot); reply('自动清怪已开启'); } else if (sub === 'off') { disableAutoAttack(bot); reply('自动清怪已关闭'); } else reply('用法: !monster on/off'); return; }
  if (cmd === '!kill') { if (args.length < 2) reply('用法: !kill <玩家>'); else if (!bot.players[args[1]]?.entity) reply(`${args[1]} 不在线`); else { require('./hunt').huntPlayer(bot, args[1]); reply(`正在击杀 ${args[1]}...`); } return; }
  if (cmd === '!hunt') { if (args.length < 2) reply('用法: !hunt <玩家>'); else if (!bot.players[args[1]]?.entity) reply(`${args[1]} 不在线`); else { startHunt(bot, args[1]); reply(`开始追杀 ${args[1]}，!stop 停止`); } return; }
  if (msg === '!come' || msg === '！过来') { comeToPlayer(bot, username); reply('马上过来'); return; }
  if (msg === '!follow' || msg === '！跟随') { startFollowing(bot, username); reply('跟随中，!stop 停止'); return; }
  if (msg === '!stop' || msg === '！停止') { stopFollowing(bot); stopHunt(bot); reply('已停止移动/追杀'); return; }
}

async function onChat(username, message) {
  const bot = getBot(); if (!bot || username === bot.username) return;
  let logMsg = message;
  if (logMsg.length > MAX_MSG_LENGTH) logMsg = logMsg.substring(0, MAX_MSG_LENGTH) + '...';
  logEvent(`[聊天] ${username}: ${logMsg}`);
  const reply = (msg) => sendChat(bot, msg);
  return processChat(username, message, 'public', reply);
}

async function onWhisper(username, message) {
  const bot = getBot(); if (!bot || username === bot.username) return;
  const msg = message.trim();
  const args = msg.split(/\s+/);
  const cmd = args[0]?.toLowerCase();

  if (cmd === '!authme') {
    let logMsg = message; if (args.length > 1) { args[1] = '***'; logMsg = args.join(' '); }
    logEvent(`[私聊] ${username}: ${logMsg}`);
    if (args.length < 2) { sendPrivate(bot, username, '用法: !authme <密码>'); return; }
    const pw = args[1];
    let authorized = false;
    if (checkPersistentPassword(pw) || checkTempPassword(pw)) { addTempAuth(username, 30); authorized = true; }
    sendPrivate(bot, username, authorized ? '认证成功，你已获得临时权限30分钟。' : '密码错误或已过期。');
    return;
  }

  let logMsg = message; if (args[0] === '!authme' && args.length > 1) { args[1] = '***'; logMsg = args.join(' '); }
  logEvent(`[私聊] ${username}: ${logMsg}`);
  if (username !== config.master) { sendPrivate(bot, config.master, `[私聊转发] ${username}: ${message}`); return; }
  const reply = (msg) => sendPrivate(bot, username, msg);
  return processChat(username, message, 'whisper', reply);
}

function consoleChat(message) {
  if (!message) return; const bot = getBot(); const msg = message.trim();
  if (msg.startsWith('!')) {
    logEvent(`[控制台指令] ${msg}`);
    const reply = (m) => { logEvent(`[Bot] ${m}`); sendChat(bot, m); };
    processChat('CONSOLE', msg, 'console', reply).catch(console.error);
  } else if (bot) {
    sendChat(bot, msg);
    logEvent(`[控制台公屏] ${msg}`);
  } else logEvent('Bot 未在线');
}

module.exports = { onChat, onWhisper, consoleChat };