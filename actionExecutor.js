const { GoalNear, GoalFollow } = require('mineflayer-pathfinder').goals;
const { sleep } = require('./utils');
const config = require('./config');

let botInstance = null;
let followActive = false;

function load(bot) { botInstance = bot; }

async function execute(bot, action) {
  console.log(`🏃 ${action.action}`, action);
  try {
    switch (action.action) {
      case 'moveTo':
        await moveTo(bot, action.x, action.y, action.z);
        break;
      case 'follow':
        await followPlayer(bot, action.target);
        break;
      case 'chat':
        bot.chat(action.message);
        break;
      case 'whisper':
        bot.whisper(action.target, action.message);
        break;
      case 'digBlock':
        await digBlock(bot, action.x, action.y, action.z);
        break;
      case 'placeBlock':
        await placeBlock(bot, action.x, action.y, action.z, action.blockName);
        break;
      case 'attack':
        await attackEntity(bot, action.target);
        break;
      case 'useItem':
        await useItem(bot, action.item);
        break;
      case 'openChest':
        await openChest(bot, action.x, action.y, action.z);
        break;
      default:
        bot.chat(`未知动作: ${action.action}`);
    }
  } catch (err) {
    console.error(`❌ 执行 ${action.action} 失败:`, err.message);
    bot.chat(`主人，动作失败: ${err.message}`);
  }
}

// ---------- 移动（无定时器） ----------
async function moveTo(bot, x, y, z) {
  stopFollow(bot);
  const { moveRandomOffset } = config.antiCheat;
  const offsetX = (Math.random() - 0.5) * moveRandomOffset * 2;
  const offsetZ = (Math.random() - 0.5) * moveRandomOffset * 2;
  const targetX = x + offsetX;
  const targetZ = z + offsetZ;
  bot.pathfinder.setGoal(new GoalNear(targetX, y, targetZ, 1.0));

  return new Promise((resolve, reject) => {
    let done = false;
    const onGoal = () => { if (!done) { done = true; resolve(); } };
    const onPathStop = () => { if (!done) { done = true; resolve(); } };
    bot.on('goal_reached', onGoal);
    bot.on('path_stop', onPathStop);
    setTimeout(() => {
      if (!done) {
        done = true;
        bot.removeListener('goal_reached', onGoal);
        bot.removeListener('path_stop', onPathStop);
        reject(new Error('寻路超时'));
      }
    }, 60000);
  });
}

// ---------- 跟随（无定时器，使用移动事件） ----------
async function followPlayer(bot, targetName) {
  stopFollow(bot);
  followActive = true;

  const target = bot.players[targetName];
  if (!target || !target.entity) throw new Error(`找不到 ${targetName}`);
  const entity = target.entity;

  bot.pathfinder.setGoal(new GoalFollow(entity, 4 + Math.random() * 0.5));

  return new Promise((resolve) => {
    let resolved = false;
    const onPathStop = () => {
      if (!resolved && followActive) {
        const currentTarget = bot.players[targetName];
        if (currentTarget && currentTarget.entity) {
          bot.pathfinder.setGoal(new GoalFollow(currentTarget.entity, 4 + Math.random() * 0.5));
        } else {
          stopFollow(bot);
          resolved = true;
          resolve();
        }
      }
    };
    const onDeath = () => {
      if (!resolved) { resolved = true; stopFollow(bot); resolve(); }
    };
    bot.on('path_stop', onPathStop);
    bot.on('death', onDeath);

    bot._followCleanup = () => {
      bot.removeListener('path_stop', onPathStop);
      bot.removeListener('death', onDeath);
    };
    bot._followResolve = resolve;
  });
}

function stopFollow(bot) {
  followActive = false;
  if (bot._followCleanup) { bot._followCleanup(); bot._followCleanup = null; }
  if (bot._followResolve) { bot._followResolve(); bot._followResolve = null; }
  if (bot.pathfinder) bot.pathfinder.setGoal(null);
  bot.setControlState('jump', false);
  bot.setControlState('forward', false);
  bot.setControlState('back', false);
  bot.setControlState('left', false);
  bot.setControlState('right', false);
}

// ---------- 其他动作 ----------
async function digBlock(bot, x, y, z) {
  const block = bot.blockAt({ x, y, z });
  if (!block) throw new Error(`无方块 (${x},${y},${z})`);
  await bot.lookAt(block.position.offset(0.5, 0.5, 0.5));
  await sleep(200 + Math.random() * 300);
  await bot.dig(block);
}

async function placeBlock(bot, x, y, z, blockName) {
  const block = bot.blockAt({ x, y, z });
  if (!block) throw new Error(`无目标方块`);
  const item = bot.inventory.items().find(i => i.name === blockName);
  if (!item) throw new Error(`无 ${blockName}`);
  await bot.lookAt(block.position.offset(0.5, 1.5, 0.5));
  await sleep(200 + Math.random() * 300);
  await bot.equip(item, 'hand');
  await bot.placeBlock(block, new Vec3(0, 1, 0));
}

async function attackEntity(bot, targetName) {
  const entity = bot.entities.find(e => e.username === targetName);
  if (!entity) throw new Error(`找不到 ${targetName}`);
  const dist = bot.entity.position.distanceTo(entity.position);
  if (dist > config.antiCheat.attackDistance) {
    await moveTo(bot, entity.position.x, entity.position.y, entity.position.z);
  }
  await bot.lookAt(entity.position.offset(0, 1.5, 0));
  await sleep(100 + Math.random() * 200);
  bot.attack(entity);
}

async function useItem(bot, itemName) {
  const item = bot.inventory.items().find(i => i.name === itemName);
  if (!item) throw new Error(`无 ${itemName}`);
  await bot.equip(item, 'hand');
  bot.activateItem();
  await sleep(1000);
}

async function openChest(bot, x, y, z) {
  const block = bot.blockAt({ x, y, z });
  if (!block) throw new Error(`无箱子`);
  await bot.lookAt(block.position.offset(0.5, 0.5, 0.5));
  await sleep(300);
  const chest = await bot.openChest(block);
  if (!chest) throw new Error('无法打开');
  const items = chest.items();
  const list = items.map(i => `${i.name} x${i.count}`).join(', ');
  bot.chat(`箱子: ${list || '空'}`);
  await chest.close();
}

module.exports = { load, execute };