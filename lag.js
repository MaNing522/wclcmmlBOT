let lagIntervals = [];

/**
 * 开启卡顿模式
 * @param {import('mineflayer').Bot} bot
 */
function startLag(bot) {
  if (lagIntervals.length > 0) return; // 已开启

  // 每 100ms 执行以下一组操作，模拟高频活动
  const mainInterval = setInterval(() => {
    if (!bot?.entity) return;

    // 1. 小幅度随机移动（如果没在寻路）
    if (!bot.pathfinder?.isMoving() && !bot.pvp?.target) {
      const randomX = (Math.random() - 0.5) * 0.3;
      const randomZ = (Math.random() - 0.5) * 0.3;
      bot.entity.position.add({ x: randomX, y: 0, z: randomZ });
    }

    // 2. 快速小角度转头
    bot.look(bot.entity.yaw + (Math.random() - 0.5) * 10, bot.entity.pitch + (Math.random() - 0.5) * 5);

    // 3. 快速切换手持物品（如果背包有超过 1 个物品）
    const items = bot.inventory.items();
    if (items.length > 1) {
      const randomItem = items[Math.floor(Math.random() * items.length)];
      bot.equip(randomItem, 'hand').catch(() => {});
    }
  }, 100);

  lagIntervals.push(mainInterval);
  require('./logger').logEvent('卡顿模式已开启 (安全频率 100ms)');
}

/**
 * 停止卡顿模式
 */
function stopLag() {
  lagIntervals.forEach(clearInterval);
  lagIntervals = [];
  require('./logger').logEvent('卡顿模式已关闭');
}

module.exports = { startLag, stopLag };