const { Movements } = require('mineflayer-pathfinder');
const config = require('./config.json');

function createBaritoneLikeMovements(bot, mcData) {
  const moves = new Movements(bot, mcData);
  moves.canDig = false;
  moves.allowParkour = true;
  moves.allowParkourPlace = false;
  moves.allow1by1towers = false;
  moves.allowLadders = true;
  moves.allowVines = true;
  moves.allowDoors = true;
  moves.allowGate = true;
  moves.canOpenDoors = true;
  moves.allowSprint = true;
  const dirtId = mcData.itemsByName['dirt']?.id;
  moves.scafoldingBlocks = dirtId ? [dirtId] : [];
  moves.allowPlace = true;
  moves.allowDrop = false;

  const lavaId = mcData.blocksByName['lava']?.id;
  const flowingLavaId = mcData.blocksByName['flowing_lava']?.id;
  const cactusId = mcData.blocksByName['cactus']?.id;
  const fireId = mcData.blocksByName['fire']?.id;
  const magmaId = mcData.blocksByName['magma_block']?.id;
  const sweetBerryId = mcData.blocksByName['sweet_berry_bush']?.id;
  const sandId = mcData.blocksByName['sand']?.id;
  const gravelId = mcData.blocksByName['gravel']?.id;

  moves.customCost = (pos, block) => {
    if (!block) return 0;
    const id = block.type;
    if (id === lavaId || id === flowingLavaId || id === fireId) return 500;
    if (id === cactusId) return 200;
    if (block.name.includes('water') || block.name.includes('lava')) return 5;

    // 智能路径规划：危险方块规避
    const pathMode = config.pathfinder?.mode || 'safe';
    if (pathMode === 'safe') {
      // 岩浆块
      if (id === magmaId) return 300;
      // 甜浆果丛
      if (id === sweetBerryId) return 50;
      // 重力方块：下方是空气则高风险
      if ((id === sandId || id === gravelId) && bot.blockAt(pos.offset(0, -1, 0))?.type === 0) {
        return 100;
      }
    }

    const botPos = bot.entity.position;
    const dx = Math.abs(pos.x - botPos.x);
    const dz = Math.abs(pos.z - botPos.z);
    const dy = pos.y - botPos.y;

    if (dy === 1 && dx === 0 && dz === 0) {
      const headBlock = bot.blockAt(pos.offset(0, 1, 0));
      if (headBlock && headBlock.boundingBox !== 'empty') return 500;
      return 0;
    }

    if (dy === 1 && (dx > 0 || dz > 0)) {
      const headPos1 = pos.offset(0, 1, 0);
      const headPos2 = pos.offset(0, 2, 0);
      const headBlock1 = bot.blockAt(headPos1);
      const headBlock2 = bot.blockAt(headPos2);
      if ((headBlock1 && headBlock1.boundingBox !== 'empty') ||
          (headBlock2 && headBlock2.boundingBox !== 'empty')) return 500;
      return 20;
    }

    // 虚空检测（Y 低于 0）
    if (pos.y < 0) return 10000;

    return 0;
  };

  return moves;
}

module.exports = { createBaritoneLikeMovements };