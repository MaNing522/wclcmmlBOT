const config = require('../config.json');
const fs = require('fs');
const path = require('path');

const logsDir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// 内存缓存最近 200 条日志
const recentLogs = [];

function getLogFileName() {
  const dateStr = new Date().toISOString().slice(0, 10);
  return `bot-${dateStr}.log`;
}

function formatTime() {
  return new Date().toLocaleTimeString('en-GB', { hour12: false });
}

function logEvent(msg) {
  const line = `[${formatTime()}] [Bot-Thread/INFO]: ${msg}`;
  if (config.logging.enabled) {
    const fullPath = path.join(logsDir, getLogFileName());
    fs.appendFileSync(fullPath, line + '\n');
  }
  // 存储到内存
  recentLogs.push(line);
  if (recentLogs.length > 200) recentLogs.shift();
  console.log(line);
}

// 获取最近的日志
function getRecentLogs() {
  return recentLogs.slice(-100); // 返回最近 100 条
}

module.exports = { logEvent, getRecentLogs };