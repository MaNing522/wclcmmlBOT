const config = require('../config.json');
const { logEvent } = require('./logger');

let isActive = false;
let scanInterval = null;
let currentTarget = null;
let currentCleanup = null;

function enable(bot) {
  if (isActive) return;
  isActive = true;
  start(bot);
  logEvent('自动清怪已开启');
}

function disable(bot) {
  isActive = false;
  if (scanInterval) {
    clearInterval(scanInterval);
    scanInterval = null;
  }
  clearCurrentTarget(bot);
  logEvent('自动清怪已关闭');
}

function clearCurrentTarget(bot) {
  if (currentCleanup) {
    currentCleanup();
    currentCleanup = null;
  }
  if (bot?.pvp?.target === currentTarget) {
    bot.pvp.stop();
  }
  currentTarget = null;
}

function start(bot) {
  if (scanInterval) clearInterval(scanInterval);
  scanInterval = setInterval(() => {
    if (!isActive || !bot?.entity) return;
    if (currentTarget && currentTarget.isValid && bot.pvp.target === currentTarget) return;
    if (currentTarget && !currentTarget.isValid) {
      clearCurrentTarget(bot);
    }

    const target = findTarget(bot);
    if (!target) return;
    if (currentTarget === target && bot.pvp.target === target) return;

    clearCurrentTarget(bot);
    currentTarget = target;

    // 异步执行：先面向，再攻击
    (async () => {
      try {
        // 平滑转向目标中心
        await bot.lookAt(target.position.offset(0, target.height * 0.8, 0));
        if (!isActive || !target.isValid || currentTarget !== target) return;

        logEvent(`自动攻击：${target.name}`);
        bot.pvp.attack(target);

        const followInterval = setInterval(() => {
          if (!isActive || !target.isValid || currentTarget !== target) {
            clearInterval(followInterval);
            return;
          }
          if (bot.entity.position.distanceTo(target.position) > 3) {
            const { GoalFollow } = require('mineflayer-pathfinder').goals;
            bot.pathfinder.setGoal(new GoalFollow(target, 2), true);
          }
        }, 500);

        const onGone = () => {
          clearInterval(followInterval);
          if (currentTarget === target) clearCurrentTarget(bot);
          if (isActive) bot.pathfinder.setGoal(null);
        };
        target.once('entityGone', onGone);

        currentCleanup = () => {
          target.removeListener('entityGone', onGone);
          clearInterval(followInterval);
          if (bot?.pvp?.target === target) bot.pvp.stop();
        };
      } catch (e) {
        // lookAt 失败时忽略，仍尝试攻击
        if (isActive && target.isValid && currentTarget === target) {
          bot.pvp.attack(target);
        }
      }
    })();
  }, 2000);
}

function findTarget(bot) {
  const neutralList = config.autoAttack.neutralBlacklist || [];
  const entities = Object.values(bot.entities).filter(e => {
    if (!e || !e.isValid || e === bot.entity || e.health <= 0) return false;
    if (neutralList.includes(e.name)) return false;
    return isHostileByName(e.name);
  });
  const range = config.autoAttack.range;
  return entities
    .map(e => ({ entity: e, dist: bot.entity.position.distanceTo(e.position) }))
    .filter(({ dist }) => dist <= range)
    .sort((a, b) => a.dist - b.dist)[0]?.entity || null;
}

function isHostileByName(name) {
  const hostile = ['zombie','skeleton','creeper','spider','witch','guardian','elder_guardian','blaze','ghast','magma_cube','slime','hoglin','piglin_brute','zoglin','drowned','husk','stray','phantom','pillager','ravager','vex','vindicator','evoker','illusioner','wither_skeleton'];
  return hostile.includes(name);
}

module.exports = { enable, disable, isActive };