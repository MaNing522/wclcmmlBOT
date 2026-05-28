// modules/storage.js
const { Vec3 } = require('vec3');
const { GoalNear } = require('mineflayer-pathfinder').goals;
const config = require('../config.json');
const { logEvent } = require('./logger');
const fs = require('fs');
const path = require('path');

// ===============================
// 仓库数据存储
// ===============================
const WAREHOUSE_FILE = path.join(__dirname, '..', 'warehouse_data.json');
const WAREHOUSE_MAP_FILE = path.join(__dirname, '..', 'warehouse_map.json');

function saveWarehouse(items) {
    try {
        fs.writeFileSync(WAREHOUSE_FILE, JSON.stringify(items, null, 2), 'utf8');
    } catch (e) { logEvent(`[存储] 保存仓库数据失败: ${e.message}`); }
}

function loadWarehouse() {
    try {
        if (fs.existsSync(WAREHOUSE_FILE)) {
            return JSON.parse(fs.readFileSync(WAREHOUSE_FILE, 'utf8'));
        }
    } catch (e) { logEvent(`[存储] 加载仓库数据失败: ${e.message}`); }
    return [];
}

function saveWarehouseMap(mapObj) {
    try {
        const data = {};
        for (const [type, positions] of mapObj.entries()) {
            const unique = new Map();
            for (const p of positions) unique.set(`${p.x},${p.y},${p.z}`, p);
            data[type] = Array.from(unique.values()).map(p => ({ x: p.x, y: p.y, z: p.z }));
        }
        fs.writeFileSync(WAREHOUSE_MAP_FILE, JSON.stringify(data, null, 2), 'utf8');
    } catch (e) { logEvent(`[存储] 保存位置映射失败: ${e.message}`); }
}

function loadWarehouseMap() {
    try {
        if (fs.existsSync(WAREHOUSE_MAP_FILE)) {
            const raw = JSON.parse(fs.readFileSync(WAREHOUSE_MAP_FILE, 'utf8'));
            const map = new Map();
            for (const [type, arr] of Object.entries(raw)) {
                map.set(parseInt(type), arr.map(p => new Vec3(p.x, p.y, p.z)));
            }
            return map;
        }
    } catch (e) { logEvent(`[存储] 加载位置映射失败: ${e.message}`); }
    return new Map();
}

// ===============================
// 仓库区域管理
// ===============================
function getStorageBounds() {
    const c1 = config.storage?.corner1, c2 = config.storage?.corner2;
    if (c1 && c2) {
        return {
            minX: Math.min(c1.x, c2.x), maxX: Math.max(c1.x, c2.x),
            minY: Math.min(c1.y, c2.y), maxY: Math.max(c1.y, c2.y),
            minZ: Math.min(c1.z, c2.z), maxZ: Math.max(c1.z, c2.z)
        };
    }
    const center = config.storage?.center || { x: 0, y: 64, z: 0 };
    const radius = config.storage?.radius || 10;
    return {
        minX: center.x - radius, maxX: center.x + radius,
        minY: center.y, maxY: center.y + 1,
        minZ: center.z - radius, maxZ: center.z + radius
    };
}

function getChestsInRegion(bot, bounds, maxCount = 200) {
    const positions = [];
    for (let y = bounds.minY; y <= bounds.maxY; y++) {
        for (let x = bounds.minX; x <= bounds.maxX; x++) {
            for (let z = bounds.minZ; z <= bounds.maxZ; z++) {
                const block = bot.blockAt(new Vec3(x, y, z));
                if (block && block.name.includes('chest')) {
                    positions.push(new Vec3(x, y, z));
                    if (positions.length >= maxCount) return positions;
                }
            }
        }
    }
    return positions;
}

async function moveToStorageCenter(bot) {
    const bounds = getStorageBounds();
    const cx = Math.floor((bounds.minX + bounds.maxX) / 2);
    const cy = bounds.minY;
    const cz = Math.floor((bounds.minZ + bounds.maxZ) / 2);
    const goal = new Vec3(cx, cy, cz);
    if (bot.entity.position.distanceTo(goal) <= 5) return true;
    try {
        await bot.pathfinder.goto(new GoalNear(goal.x, goal.y, goal.z, 3));
        return true;
    } catch (e) {
        return false;
    }
}

async function ensureNearBlock(bot, pos, maxDistance = 4) {
    if (bot.entity.position.distanceTo(pos) <= maxDistance) return true;
    const goal = new GoalNear(pos.x, pos.y, pos.z, 2);
    try {
        await bot.pathfinder.goto(goal);
        return true;
    } catch (e) {
        return false;
    }
}

let lastOperationTime = 0;
async function throttle() {
    const now = Date.now();
    const elapsed = now - lastOperationTime;
    if (elapsed < 300) await new Promise(r => setTimeout(r, 300 - elapsed));
    lastOperationTime = Date.now();
}

// ===============================
// 仓库扫描（核心）
// ===============================
async function scanWarehouse(bot) {
    const mcData = require('minecraft-data')(bot.version);
    const bounds = getStorageBounds();
    const chests = getChestsInRegion(bot, bounds, 100);
    if (chests.length === 0) return [];

    const inventory = new Map();      // type → 总数量
    const itemMap = new Map();        // type → 箱子位置列表

    for (const pos of chests) {
        const block = bot.blockAt(pos);
        if (!block || !block.name.includes('chest')) continue;
        if (!(await ensureNearBlock(bot, pos))) continue;

        await throttle();
        let container;
        try {
            container = await bot.openContainer(block);
        } catch { continue; }
        if (!container) continue;

        try {
            for (const item of container.containerItems()) {
                inventory.set(item.type, (inventory.get(item.type) || 0) + item.count);
                if (!itemMap.has(item.type)) itemMap.set(item.type, []);
                itemMap.get(item.type).push(pos);
            }
        } finally {
            if (container && !container.closed) container.close();
        }
    }

    const items = [];
    for (const [type, count] of inventory.entries()) {
        const itemDef = mcData.items[type];
        items.push({
            type,
            name: itemDef?.name || `id_${type}`,
            count,
            displayName: itemDef?.displayName || itemDef?.name || `未知物品(${type})`
        });
    }

    saveWarehouse(items);
    saveWarehouseMap(itemMap);
    return items;
}

// ===============================
// 存放物品
// ===============================
async function depositStorage(bot) {
    if (!config.storageEnabled) return '存储功能未启用';
    bot._isDepositing = true;
    try {
        if (!(await moveToStorageCenter(bot))) return '无法到达仓库区域';

        const bounds = getStorageBounds();
        const warehouseChests = getChestsInRegion(bot, bounds, 100);
        if (warehouseChests.length === 0) return '仓库区域没有箱子';

        // 卸下所有装备（确保全部存入）
        for (const slot of ['head', 'torso', 'legs', 'feet', 'off-hand']) {
            try { await bot.unequip(slot); } catch {}
            await throttle();
        }
        await new Promise(resolve => setTimeout(resolve, 200));

        let totalDeposited = 0;
        for (const pos of warehouseChests) {
            if (bot.inventory.items().length === 0) break;
            const block = bot.blockAt(pos);
            if (!block || !block.name.includes('chest')) continue;
            if (!(await ensureNearBlock(bot, pos))) continue;

            await throttle();
            let container;
            try { container = await bot.openContainer(block); } catch { continue; }
            if (!container) continue;

            let bagChanged = true;
            while (bagChanged) {
                bagChanged = false;
                const invItems = bot.inventory.items();
                for (const item of invItems) {
                    try {
                        await container.deposit(item.type, null, item.count);
                        totalDeposited += item.count;
                        bagChanged = true;
                        break;
                    } catch {}
                }
            }
            if (container && !container.closed) container.close();
        }

        // 重新扫描并更新数据
        await scanWarehouse(bot);
        return totalDeposited > 0 ? `已存放 ${totalDeposited} 个物品到仓库` : '没有物品被存放';
    } finally {
        bot._isDepositing = false;
    }
}

// ===============================
// 检查仓库（核心）
// ===============================
async function checkStorage(bot) {
    if (!config.storageEnabled) return '存储功能未启用';
    if (!(await moveToStorageCenter(bot))) return '无法到达仓库区域';
    const items = await scanWarehouse(bot);
    if (items.length === 0) return '仓库中没有物品';
    // 按数量降序排列，方便查看
    items.sort((a, b) => b.count - a.count);
    const list = items.slice(0, 15).map(i => `${i.displayName} ${i.count}`).join('，');
    return `共 ${items.length} 种物品，总计 ${items.reduce((s, i) => s + i.count, 0)} 个。最新：${list}`;
}

// ===============================
// 从容器中取出
// ===============================
async function withdrawFromContainer(container, itemType, amount) {
    let taken = 0;
    while (taken < amount) {
        const available = container.count(itemType);
        if (available === 0) break;
        const toTake = Math.min(amount - taken, available);
        try {
            await container.withdraw(itemType, null, toTake);
            taken += toTake;
            await throttle();
        } catch (e) {
            try {
                await container.withdraw(itemType, null, 1);
                taken += 1;
                await throttle();
            } catch { break; }
        }
    }
    return taken;
}

async function bulkWithdraw(bot, itemMap) {
    const stillNeed = new Map(itemMap);
    const taken = new Map();
    const itemPositions = loadWarehouseMap();
    let chests = [];
    for (const type of stillNeed.keys()) {
        const mapped = itemPositions.get(type);
        if (mapped) chests.push(...mapped);
    }
    const unique = new Map();
    for (const p of chests) unique.set(`${p.x},${p.y},${p.z}`, p);
    const sorted = Array.from(unique.values());

    if (sorted.length === 0) {
        logEvent('[存储] 位置映射缺失，重新扫描仓库...');
        await scanWarehouse(bot);
        const newMap = loadWarehouseMap();
        for (const type of stillNeed.keys()) {
            const mapped = newMap.get(type);
            if (mapped) chests.push(...mapped);
        }
        unique.clear();
        for (const p of chests) unique.set(`${p.x},${p.y},${p.z}`, p);
        sorted.push(...unique.values());
    }

    for (const pos of sorted) {
        if (stillNeed.size === 0) break;
        const block = bot.blockAt(pos);
        if (!block || !block.name.includes('chest')) continue;
        if (!(await ensureNearBlock(bot, pos))) continue;

        await throttle();
        let container;
        try { container = await bot.openContainer(block); } catch { continue; }
        if (!container) continue;

        for (const type of [...stillNeed.keys()]) {
            const need = stillNeed.get(type);
            if (!need || need <= 0) continue;
            const got = await withdrawFromContainer(container, type, need);
            if (got > 0) {
                taken.set(type, (taken.get(type) || 0) + got);
                const remaining = need - got;
                if (remaining > 0) stillNeed.set(type, remaining);
                else stillNeed.delete(type);
            }
        }
        if (container && !container.closed) container.close();
    }

    // 回退扫描
    if (stillNeed.size > 0) {
        const bounds = getStorageBounds();
        const allChests = getChestsInRegion(bot, bounds, 100);
        for (const pos of allChests) {
            if (stillNeed.size === 0) break;
            if (sorted.some(p => p.equals(pos))) continue;
            const block = bot.blockAt(pos);
            if (!block || !block.name.includes('chest')) continue;
            if (!(await ensureNearBlock(bot, pos))) continue;

            await throttle();
            let container;
            try { container = await bot.openContainer(block); } catch { continue; }
            if (!container) continue;

            for (const type of [...stillNeed.keys()]) {
                const need = stillNeed.get(type);
                if (!need || need <= 0) continue;
                const got = await withdrawFromContainer(container, type, need);
                if (got > 0) {
                    taken.set(type, (taken.get(type) || 0) + got);
                    const remaining = need - got;
                    if (remaining > 0) stillNeed.set(type, remaining);
                    else stillNeed.delete(type);
                }
            }
            if (container && !container.closed) container.close();
        }
    }
    return taken;
}

// ===============================
// 批量存入拿取箱
// ===============================
async function bulkDepositToTakeChest(bot, itemMap) {
    const stillNeed = new Map(itemMap);
    const deposited = new Map();
    const takeSignText = config.storage?.takeSignText || '拿取箱';
    const takeSignPos = findSign(bot, takeSignText);
    if (!takeSignPos) return { deposited, left: stillNeed };

    const takeBounds = getChestsAroundSign(takeSignPos);
    const takeChests = getChestsInRegion(bot, takeBounds, 10);
    if (takeChests.length === 0) return { deposited, left: stillNeed };

    for (const pos of takeChests) {
        if (stillNeed.size === 0) break;
        const block = bot.blockAt(pos);
        if (!block || !block.name.includes('chest')) continue;
        if (!(await ensureNearBlock(bot, pos))) continue;

        await throttle();
        let container;
        try { container = await bot.openContainer(block); } catch { continue; }
        if (!container) continue;

        for (const type of [...stillNeed.keys()]) {
            const count = stillNeed.get(type);
            if (!count || count <= 0) continue;
            try {
                await container.deposit(type, null, count);
                deposited.set(type, (deposited.get(type) || 0) + count);
                stillNeed.delete(type);
                await throttle();
            } catch {}
        }
        if (container && !container.closed) container.close();
    }
    return { deposited, left: stillNeed };
}

// ===============================
// 解析物品名称/ID
// ===============================
function resolveItemType(mcData, rawName) {
    let clean = rawName.replace(/^minecraft:/, '');
    const byName = mcData.itemsByName[clean];
    if (byName) return byName.id;
    const id = parseInt(clean);
    if (!isNaN(id) && mcData.items[id]) return id;
    return null;
}

// ===============================
// 解析拿取参数（支持多物品）
// ===============================
function parseMultiTake(args) {
    const items = [];
    let i = 0;
    while (i < args.length) {
        const name = args[i];
        if (!name) break;
        const countStr = args[i + 1];
        if (!countStr) {
            items.push({ name, count: 1 });
            i += 1;
            continue;
        }
        const count = parseInt(countStr);
        if (isNaN(count)) {
            items.push({ name, count: 1 });
            i += 1;
        } else {
            items.push({ name, count: Math.max(1, count) });
            i += 2;
        }
    }
    return items.length > 0 ? items : null;
}

// ===============================
// 拿取物品（入口）
// ===============================
async function takeStorage(bot, itemNameAndCounts) {
    if (!config.storageEnabled) return '存储功能未启用';

    let items;
    if (typeof itemNameAndCounts === 'string') {
        items = parseMultiTake(itemNameAndCounts.split(/\s+/));
    } else if (Array.isArray(itemNameAndCounts)) {
        items = itemNameAndCounts;
    } else return '拿取格式错误';

    if (!items || items.length === 0) return '请指定要拿取的物品';

    if (!(await moveToStorageCenter(bot))) return '无法到达仓库区域';

    const mcData = require('minecraft-data')(bot.version);
    const itemMap = new Map();
    const nameMap = new Map();

    for (const { name, count } of items) {
        const type = resolveItemType(mcData, name);
        if (type === null) return `未找到物品 ${name}`;
        itemMap.set(type, (itemMap.get(type) || 0) + count);
        nameMap.set(type, name);
    }

    const taken = await bulkWithdraw(bot, itemMap);
    if (taken.size === 0) return '仓库中没有该物品';

    // 尝试放入拿取箱
    const { deposited, left } = await bulkDepositToTakeChest(bot, taken);
    if (left.size > 0) {
        // 拿取箱满了，退回仓库矩阵
        const bounds = getStorageBounds();
        const warehouseChests = getChestsInRegion(bot, bounds, 100);
        for (const pos of warehouseChests) {
            if (left.size === 0) break;
            const block = bot.blockAt(pos);
            if (!block || !block.name.includes('chest')) continue;
            if (!(await ensureNearBlock(bot, pos))) continue;

            await throttle();
            let container;
            try { container = await bot.openContainer(block); } catch { continue; }
            if (!container) continue;

            for (const type of [...left.keys()]) {
                const count = left.get(type);
                if (!count || count <= 0) continue;
                try {
                    await container.deposit(type, null, count);
                    left.delete(type);
                    await throttle();
                } catch {}
            }
            if (container && !container.closed) container.close();
        }
    }

    // 生成结果信息
    const results = [];
    for (const [type, need] of itemMap) {
        const name = nameMap.get(type);
        const got = taken.get(type) || 0;
        if (got === 0) {
            results.push(`${name}: 未取出`);
            continue;
        }
        const dep = deposited.get(type) || 0;
        const refund = left.get(type) || 0;
        if (refund > 0 && dep === 0) {
            results.push(`${name}: 取出 ${got} 个，拿取箱已满，已退回仓库`);
        } else if (refund > 0) {
            results.push(`${name}: 取出 ${got} 个，放入拿取箱 ${dep} 个，退回仓库 ${refund} 个`);
        } else {
            results.push(`${name}: 取出 ${got} 个，已放入拿取箱`);
        }
    }
    return results.join(' | ');
}

// ===============================
// 拿取全部物品
// ===============================
async function takeAllStorage(bot) {
    if (!config.storageEnabled) return '存储功能未启用';
    if (!(await moveToStorageCenter(bot))) return '无法到达仓库区域';
    const items = await scanWarehouse(bot);
    if (items.length === 0) return '仓库中没有物品';
    const allItems = [];
    for (const item of items) {
        allItems.push({ name: item.name, count: item.count });
    }
    return await takeStorage(bot, allItems);
}

// ===============================
// 辅助函数：查找告示牌
// ===============================
function getChestsAroundSign(signPos) {
    return {
        minX: signPos.x - 3, maxX: signPos.x + 3,
        minY: signPos.y - 1, maxY: signPos.y + 1,
        minZ: signPos.z - 3, maxZ: signPos.z + 3
    };
}

function findSign(bot, text) {
    const signs = bot.findBlocks({
        matching: (block) => block.name.includes('sign') || block.name.includes('wall_sign'),
        maxDistance: 20,
        count: 50
    });
    for (const pos of signs) {
        const block = bot.blockAt(pos);
        if (!block || !block.signText) continue;
        if (block.signText.replace(/^\[|\]$/g, '').includes(text)) return pos;
    }
    return null;
}

// ===============================
// 模块导出
// ===============================
module.exports = {
    checkStorage,      // 检查
    depositStorage,    // 存放
    takeStorage,       // 拿取（支持多物品）
    takeAllStorage,    // 拿取全部
    scanWarehouse,     // 扫描仓库
    loadWarehouse      // 加载仓库数据
};