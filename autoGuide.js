const { getBot } = require('./state');
const { sendChat } = require('./messageQueue');
const mcDataLib = require('minecraft-data');
let isRunning = false, retryTimer = null;

function start(bot) { if (isRunning) return; isRunning = true; attemptGuide(bot); }
function stop() { isRunning = false; if (retryTimer) { clearTimeout(retryTimer); retryTimer = null; } }
async function attemptGuide(bot) {
  const cfg = require('../config.json').joinGuide;
  if (!cfg?.enabled) { stop(); return; }
  const mcData = mcDataLib(bot.version);
  const compassId = mcData.itemsByName['compass']?.id;
  if (!compassId) { stop(); return; }
  const compassItem = bot.inventory.items().find(item => item.type === compassId);
  if (!compassItem) { retryTimer = setTimeout(() => attemptGuide(bot), cfg.retryDelay); return; }
  try {
    await bot.equip(compassItem, 'hand');
    const win = await new Promise((resolve, reject) => {
      const t = setTimeout(() => { bot.removeListener('windowOpen', onOpen); reject(new Error('timeout')); }, 5000);
      const onOpen = (w) => { clearTimeout(t); resolve(w); };
      bot.once('windowOpen', onOpen);
    });
    bot.activateItem();
    const slot = win.slots.findIndex(item => item?.type === compassId);
    if (slot === -1) throw new Error('compass not found');
    await bot.clickWindow(slot, 0, 0);
    bot.closeWindow(win);
    stop();
  } catch (e) { stop(); }
}
module.exports = { start, stop };