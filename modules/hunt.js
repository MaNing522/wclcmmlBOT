const { GoalFollow } = require('mineflayer-pathfinder').goals;
const { getBot } = require('./state');
const { logEvent } = require('./logger');
let huntTarget = null, huntInterval = null, goneListener = null;

async function startHunt(bot, playerName) {
  stopHunt(bot);
  const player = bot.players[playerName];
  if (!player?.entity) return;
  huntTarget = player.entity;

  logEvent(`开始追杀：${playerName}`);

  // 先面向目标
  try {
    await bot.lookAt(huntTarget.position.offset(0, huntTarget.height * 0.8, 0));
  } catch (e) {}

  if (!huntTarget || !huntTarget.isValid) {
    stopHunt(bot);
    return;
  }

  bot.pvp.attack(huntTarget);

  huntInterval = setInterval(() => {
    const botInstance = getBot();
    if (!huntTarget?.isValid || !botInstance) { stopHunt(botInstance); return; }
    if (botInstance.pvp.target !== huntTarget) botInstance.pvp.attack(huntTarget);
    botInstance.pathfinder.setGoal(new GoalFollow(huntTarget, 2), true);
  }, 500);

  goneListener = () => { logEvent(`追杀目标 ${playerName} 已消失`); stopHunt(bot); };
  huntTarget.once('entityGone', goneListener);
}

function stopHunt(bot) {
  if (huntInterval) { clearInterval(huntInterval); huntInterval = null; }
  if (goneListener && huntTarget) { huntTarget.removeListener('entityGone', goneListener); goneListener = null; }
  if (bot?.pvp.target === huntTarget) bot.pvp.stop();
  huntTarget = null;
  if (bot) bot.pathfinder.setGoal(null);
}

function huntPlayer(bot, playerName) { startHunt(bot, playerName); }

module.exports = { startHunt, stopHunt, huntPlayer };