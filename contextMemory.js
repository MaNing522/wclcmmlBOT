const config = require('../config.json');
const contexts = new Map(); // username -> [{ role, content }]

function startContextMemory(bot) {
    // 定期清理过期上下文
    setInterval(() => {
        const expiry = (config.ai?.contextExpiryMinutes || 60) * 60 * 1000;
        const now = Date.now();
        for (const [name, data] of contexts.entries()) {
            if (data.lastActive && now - data.lastActive > expiry) {
                contexts.delete(name);
            }
        }
    }, 600000);
}

function getContext(username) {
    let ctx = contexts.get(username);
    if (!ctx) {
        ctx = { messages: [], lastActive: Date.now() };
        contexts.set(username, ctx);
    }
    ctx.lastActive = Date.now();
    return ctx.messages;
}

function addContextMessage(username, role, content) {
    const ctx = contexts.get(username);
    if (!ctx) {
        contexts.set(username, { messages: [{ role, content }], lastActive: Date.now() });
        return;
    }
    ctx.messages.push({ role, content });
    ctx.lastActive = Date.now();
    const maxLen = config.ai?.maxContextMessages || 10;
    while (ctx.messages.length > maxLen * 2) ctx.messages.shift();
}

function clearPlayerContext(username) {
    contexts.delete(username);
}

module.exports = { getContext, addContextMessage, clearPlayerContext, startContextMemory };