const config = require('../config.json');

function rollDice(max) {
    return Math.floor(Math.random() * max) + 1;
}

function drawLottery(customPool) {
    let pool = customPool && customPool.length ? customPool : (config.funCommands?.lotteryItems || ['大吉', '中吉', '小吉', '末吉', '凶', '大凶']);
    const idx = Math.floor(Math.random() * pool.length);
    return pool[idx];
}

module.exports = { rollDice, drawLottery };