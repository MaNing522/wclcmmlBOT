const config = require('./config');
const aiParser = require('./aiParser');

let botInstance = null;

function load(bot) {
  botInstance = bot;
  bot.on('chat', (username, message) => {
    handleMessage(username, message, false);
  });
  bot.on('whisper', (username, message) => {
    handleMessage(username, message, true);
  });
}

function handleMessage(username, message, isWhisper) {
  // 权限检查：只有主人和管理员能执行命令（可扩展）
  const allowed = config.bot.admins.includes(username) || username === config.bot.owner;
  if (!allowed) return;

  if (!message.startsWith('!') && !message.startsWith('！')) return;
  const command = message.slice(1).trim();
  if (!command) return;

  console.log(`📩 ${username}${isWhisper?'私聊':''}: ${command}`);
  // 将命令交给 AI 解析执行
  aiParser.parseAndExecute(botInstance, command, { isWhisper, from: username });
}

// 供 Web 调用（模拟主人）
function executeCommand(bot, username, command, isWhisper = false) {
  if (username !== config.bot.owner && !config.bot.admins.includes(username)) return;
  aiParser.parseAndExecute(bot, command, { isWhisper, from: username });
}

module.exports = { load, executeCommand };