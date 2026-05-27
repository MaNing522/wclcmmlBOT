const fs = require('fs');
const path = require('path');

const STATS_FILE = path.join(__dirname, '..', 'player_stats.json');

// 读取统计数据
function loadStats() {
  try {
    if (fs.existsSync(STATS_FILE)) {
      return JSON.parse(fs.readFileSync(STATS_FILE, 'utf8'));
    }
  } catch (e) {}
  return {};
}

// 保存统计数据
function saveStats(stats) {
  try {
    fs.writeFileSync(STATS_FILE, JSON.stringify(stats, null, 2), 'utf8');
  } catch (e) {}
}

// 玩家上线时记录
function playerJoined(username) {
  const stats = loadStats();
  if (!stats[username]) {
    stats[username] = {
      joinCount: 0,
      totalOnlineTime: 0,   // 毫秒
      lastJoin: null,
      lastLeave: null,
      currentJoinTime: null
    };
  }
  stats[username].joinCount++;
  stats[username].lastJoin = Date.now();
  stats[username].currentJoinTime = Date.now();  // 用于计算本次在线时长
  saveStats(stats);
}

// 玩家下线时记录
function playerLeft(username) {
  const stats = loadStats();
  if (!stats[username]) return;
  const entry = stats[username];
  if (entry.currentJoinTime) {
    const sessionTime = Date.now() - entry.currentJoinTime;
    entry.totalOnlineTime += sessionTime;
    entry.currentJoinTime = null;
  }
  entry.lastLeave = Date.now();
  saveStats(stats);
}

// 获取所有统计数据（用于网页展示）
function getAllStats() {
  const stats = loadStats();
  // 转换为数组并格式化
  return Object.entries(stats).map(([name, data]) => ({
    name,
    joinCount: data.joinCount,
    totalOnlineTime: data.totalOnlineTime,
    lastJoin: data.lastJoin,
    lastLeave: data.lastLeave
  }));
}

module.exports = { playerJoined, playerLeft, getAllStats };