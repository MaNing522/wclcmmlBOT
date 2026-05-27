const config = require('../config.json');
const { getBot } = require('./state');
const { createBaritoneLikeMovements } = require('../baritoneMovements');
const mcDataLib = require('minecraft-data');

function setPathfinderMode(bot, mode) {
    if (!bot) bot = getBot();
    if (!bot) return;
    config.pathfinder.mode = mode;
    const mcData = mcDataLib(bot.version);
    const moves = createBaritoneLikeMovements(bot, mcData);
    bot.pathfinder.setMovements(moves);
    // 可选：保存到配置文件
    const fs = require('fs');
    fs.writeFileSync('./config.json', JSON.stringify(config, null, 2));
}

module.exports = { setPathfinderMode };