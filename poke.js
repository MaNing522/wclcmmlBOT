const config = require('../config.json');
const { addMessage } = require('./messageBoard');
const { sendChat } = require('./messageQueue');

const lastPoke = new Map(); // key: `${from}:${to}`

function pokePlayer(bot, from, to) {
    const key = `${from}:${to}`;
    const cooldown = config.poke?.cooldownSeconds || 60;
    const last = lastPoke.get(key);
    if (last && Date.now() - last < cooldown * 1000) {
        const remaining = Math.ceil((cooldown * 1000 - (Date.now() - last)) / 1000);
        return `戳得太频繁了，请 ${remaining} 秒后再试。`;
    }
    lastPoke.set(key, Date.now());
    const targetPlayer = bot.players[to];
    if (targetPlayer && targetPlayer.entity) {
        sendChat(bot, `/msg ${to} ${from} 戳了你一下！`);
        return `你戳了戳 ${to}`;
    } else {
        addMessage(to, from, '戳了你一下');
        return `${to} 不在线，已留言戳他。`;
    }
}

module.exports = { pokePlayer };