const mineflayer = require('mineflayer');
const pathfinder = require('mineflayer-pathfinder').pathfinder;
const Movements = require('mineflayer-pathfinder').Movements;
const config = require('./config');
const chatController = require('./chatController');
const actionExecutor = require('./actionExecutor');
const loginHandler = require('./loginHandler');

const bot = mineflayer.createBot({
  host: config.server.host,
  port: config.server.port,
  username: config.bot.username,
  version: config.server.version,
  checkTimeoutInterval: 60 * 1000
});

bot.loadPlugin(pathfinder);
chatController.load(bot);
actionExecutor.load(bot);
loginHandler.load(bot);

bot.once('spawn', () => {
  console.log(`🤖 机器人 ${bot.username} 已上线！`);
  const defaultMove = new Movements(bot);
  defaultMove.canDig = false;
  defaultMove.canPlace = false;
  bot.pathfinder.setMovements(defaultMove);
});

bot.on('error', (err) => console.error('❌ 错误:', err));
bot.on('end', (reason) => console.log('🔌 断开:', reason));

// 命令行直接输入命令（支持 ! 和 ！）
process.stdin.on('data', (data) => {
  const input = data.toString().trim();
  if (input.startsWith('!') || input.startsWith('！')) {
    const cmd = input.slice(1).trim();
    if (cmd) {
      const aiParser = require('./aiParser');
      aiParser.parseAndExecute(bot, cmd);
    }
  }
});