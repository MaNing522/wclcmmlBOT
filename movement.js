const { GoalFollow } = require('mineflayer-pathfinder').goals;
const { logEvent } = require('./logger');

let followState = { active: false, target: null, interval: null };
let attackState = { active: false, target: null, interval: null, goneListener: null };

function clearFollow(bot) {
  if (followState.interval) clearInterval(followState.interval);
  followState.active = false; followState.target = null; followState.interval = null;
}
function clearAttack(bot) {
  if (attackState.interval) clearInterval(attackState.interval);
  if (attackState.goneListener && attackState.target) {
    attackState.target.removeListener('entityGone', attackState.goneListener);
  }
  if (bot?.pvp?.target === attackState.target) bot.pvp.stop();
  attackState.active = false; attackState.target = null; attackState.interval = null; attackState.goneListener = null;
}
function stopAll(bot) { clearFollow(bot); clearAttack(bot); if (bot) bot.pathfinder.setGoal(null); }

function moveToPlayer(bot, username) {
  if (!bot) return; stopAll(bot);
  const player = bot.players[username]?.entity;
  if (player) { bot.pathfinder.setGoal(new GoalFollow(player, 2), true); logEvent(`前往玩家 ${username}`); }
}
function followPlayer(bot, username) {
  if (!bot) return; stopAll(bot);
  const player = bot.players[username]?.entity;
  if (!player) return;
  followState.active = true; followState.target = player;
  followState.interval = setInterval(() => {
    if (!followState.active || !bot?.entity || bot.pvp?.target) { clearFollow(bot); bot.pathfinder.setGoal(null); return; }
    if (!followState.target?.isValid) { clearFollow(bot); bot.pathfinder.setGoal(null); return; }
    bot.pathfinder.setGoal(new GoalFollow(followState.target, 2), true);
  }, 500);
  logEvent(`开始跟随 ${username}`);
}
function stopFollowing(bot) { clearFollow(bot); if (bot) bot.pathfinder.setGoal(null); }

// 攻击目标（带面向）
async function attackTarget(bot, targetEntity, options = {}) {
  if (!bot || !targetEntity) return;
  if (attackState.active && attackState.target === targetEntity && bot.pvp.target === targetEntity) return;

  clearAttack(bot);

  attackState.active = true;
  attackState.target = targetEntity;

  try {
    // 先平滑面向目标的中心
    await bot.lookAt(targetEntity.position.offset(0, targetEntity.height * 0.8, 0));
  } catch (e) {
    // lookAt 失败不影响，继续
  }

  if (!attackState.active || !targetEntity.isValid || attackState.target !== targetEntity) {
    clearAttack(bot);
    bot.pathfinder.setGoal(null);
    return;
  }

  if (bot.pvp) bot.pvp.attack(targetEntity);

  attackState.interval = setInterval(() => {
    if (!attackState.active || !bot?.entity) { clearAttack(bot); bot.pathfinder.setGoal(null); return; }
    if (!attackState.target?.isValid) { clearAttack(bot); bot.pathfinder.setGoal(null); return; }
    if (options.maxDistance && bot.entity.position.distanceTo(attackState.target.position) > options.maxDistance) {
      clearAttack(bot); bot.pathfinder.setGoal(null); return;
    }
    bot.pathfinder.setGoal(new GoalFollow(attackState.target, 2), true);
  }, 500);

  attackState.goneListener = () => {
    logEvent(`攻击目标消失: ${targetEntity.username || targetEntity.name}`);
    clearAttack(bot);
    bot.pathfinder.setGoal(null);
  };
  targetEntity.once('entityGone', attackState.goneListener);
}

function stopAttack(bot) { clearAttack(bot); if (bot) bot.pathfinder.setGoal(null); }

function comeToPlayer(bot, username) { moveToPlayer(bot, username); }
function startFollowing(bot, username) { followPlayer(bot, username); }
function attackPlayer(bot, player) { if (player?.entity) attackTarget(bot, player.entity); }

module.exports = { comeToPlayer, startFollowing, stopFollowing, attackPlayer, stopAll, attackTarget, stopAttack, moveToPlayer, followPlayer };