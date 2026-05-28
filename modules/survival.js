const config = require('../config.json');
const mcDataLib = require('minecraft-data');
let isEating = false;

function survivalTasks(bot) {
  if (!bot?.entity) return;
  if (config.survival.autoEat) autoEat(bot);
  // 存放过程中禁止自动装备，且仅当配置明确为 true 时才启用
  if (!bot._isDepositing && config.survival.autoEquip === true) autoEquip(bot);
}

async function autoEat(bot) {
  if (isEating) return;
  if (bot.food >= config.survival.foodThreshold) return;
  const foods = bot.inventory.items()
    .filter(i => typeof i.foodPoints === 'number' && i.foodPoints > 0)
    .sort((a, b) => b.foodPoints - a.foodPoints);
  if (foods.length === 0) return;
  const best = foods[0];
  isEating = true;
  try { await bot.equip(best, 'hand'); await bot.consume(); } catch (err) {}
  finally { isEating = false; }
}

function autoEquip(bot) {
  if (bot.pvp.target) return;
  const mcData = mcDataLib(bot.version);
  const armorSlots = [
    { slot: 'head', matcher: /头盔|helmet/i },
    { slot: 'torso', matcher: /胸甲|chestplate/i },
    { slot: 'legs', matcher: /护腿|leggings/i },
    { slot: 'feet', matcher: /靴子|boots/i },
  ];
  for (const { slot, matcher } of armorSlots) {
    const dest = bot.getEquipmentDestSlot(slot);
    const cur = bot.inventory.slots[dest];
    const candidates = bot.inventory.items().filter(it => matcher.test(it.name) && it !== cur);
    if (candidates.length > 0) {
      const best = candidates.reduce((a, b) => {
        const defA = mcData.items[a.type]?.defense || 0;
        const defB = mcData.items[b.type]?.defense || 0;
        return defA > defB ? a : b;
      }, candidates[0]);
      bot.equip(best, slot).catch(() => {});
    }
  }
  const weapons = bot.inventory.items().filter(it => /剑|sword|斧|axe/i.test(it.name));
  if (weapons.length > 0) {
    const curWep = bot.inventory.slots[bot.getEquipmentDestSlot('hand')];
    const best = weapons.reduce((a, b) => {
      const dmgA = mcData.items[a.type]?.attackDamage || 0;
      const dmgB = mcData.items[b.type]?.attackDamage || 0;
      return dmgA > dmgB ? a : b;
    }, weapons[0]);
    if (best !== curWep) bot.equip(best, 'hand').catch(() => {});
  }
}

module.exports = { survivalTasks };