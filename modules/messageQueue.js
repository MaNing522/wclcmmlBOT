const config = require('../config.json');
const { logEvent } = require('./logger');

let messageQueue = [];
let messageTimer = null;

function sendChat(bot, msg) {
  if (!bot || !bot._client || !bot.entity) {
    setTimeout(() => sendChat(bot, msg), 2000);
    return;
  }
  messageQueue.push(msg);
  logEvent(`[Bot] ${msg}`);   // 将 Bot 消息写入日志缓存，供网页显示
  if (!messageTimer) processQueue(bot);
}

function processQueue(bot) {
  if (messageQueue.length === 0) { messageTimer = null; return; }
  const msg = messageQueue.shift();
  bot.chat(msg);
  messageTimer = setTimeout(() => processQueue(bot), config.chatInterval || 200);
}

function clearQueue() {
  messageQueue = [];
  if (messageTimer) { clearTimeout(messageTimer); messageTimer = null; }
}

module.exports = { sendChat, clearQueue };