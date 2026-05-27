const { sendChat } = require('./messageQueue');
function enableAutoSleep(bot) {
  bot.on('entitySleep', async (entity) => {
    if (entity.username === bot.username || bot.time.isDay) return;
    const bed = bot.findBlock({ matching: block => block.name.includes('bed'), maxDistance: 16 });
    if (!bed) return;
    try { await bot.sleep(bed); sendChat(bot, '我已躺在床上。'); } catch (e) {}
  });
}
module.exports = { enableAutoSleep };