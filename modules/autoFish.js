const config = require('../config.json');
const { logEvent } = require('./logger');
const { depositStorage } = require('./storage');

let fishingActive = false;
let fishingInterval = null;
let currentBot = null;

async function fishCycle(bot) {
    if (!fishingActive || !bot || !bot.entity) return;
    const rod = bot.inventory.items().find(i => i.name === 'fishing_rod');
    if (!rod) {
        logEvent('[自动钓鱼] 没有钓鱼竿');
        stopAutoFish(bot);
        return;
    }
    try {
        await bot.equip(rod, 'hand');
        bot.activateItem();
        let hook = null;
        const onHookSpawn = (hookEntity) => { if (hookEntity.type === 'object' && hookEntity.name === 'fishing_hook') hook = hookEntity; };
        bot.on('entitySpawn', onHookSpawn);
        await new Promise(resolve => setTimeout(resolve, 500));
        if (!hook) { bot.removeListener('entitySpawn', onHookSpawn); return; }
        const startTime = Date.now();
        const checkInterval = setInterval(() => {
            if (!fishingActive || !hook || !hook.isValid) {
                clearInterval(checkInterval);
                return;
            }
            if (hook.yaw !== undefined && (Date.now() - startTime) > config.autoFish?.timeoutMs || 30000) {
                clearInterval(checkInterval);
                bot.activateItem();
                setTimeout(() => fishCycle(bot), 1000);
            }
        }, 500);
        hook.once('entityGone', () => {
            clearInterval(checkInterval);
            bot.removeListener('entitySpawn', onHookSpawn);
            setTimeout(() => {
                if (config.autoFish?.autoDeposit && bot.inventory.items().length > 30) {
                    depositStorage(bot).catch(() => {});
                }
                fishCycle(bot);
            }, 1000);
        });
    } catch (e) {
        logEvent(`[自动钓鱼] 错误: ${e.message}`);
        setTimeout(() => fishCycle(bot), 5000);
    }
}

function startAutoFish(bot) {
    if (fishingActive) return;
    fishingActive = true;
    currentBot = bot;
    logEvent('[自动钓鱼] 已启动');
    fishCycle(bot);
}

function stopAutoFish(bot) {
    fishingActive = false;
    if (fishingInterval) clearInterval(fishingInterval);
    logEvent('[自动钓鱼] 已停止');
}

function isFishing() { return fishingActive; }

module.exports = { startAutoFish, stopAutoFish, isFishing };