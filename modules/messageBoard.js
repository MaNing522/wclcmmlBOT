// modules/messageBoard.js
const fs = require('fs');
const path = require('path');

const MESSAGES_FILE = path.join(__dirname, '..', 'data', 'messages.json');

// 确保 data 目录存在
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

// 数据结构：{ "targetPlayer": [ { from: "sender", content: "text", timestamp: 123456789 }, ... ] }

function loadMessages() {
    try {
        if (fs.existsSync(MESSAGES_FILE)) {
            return JSON.parse(fs.readFileSync(MESSAGES_FILE, 'utf8'));
        }
    } catch (e) { console.error('加载留言失败:', e); }
    return {};
}

function saveMessages(messages) {
    try {
        fs.writeFileSync(MESSAGES_FILE, JSON.stringify(messages, null, 2), 'utf8');
    } catch (e) { console.error('保存留言失败:', e); }
}

/**
 * 给玩家添加留言
 * @param {string} target - 目标玩家名
 * @param {string} from - 留言发送者
 * @param {string} content - 留言内容
 */
function addMessage(target, from, content) {
    const messages = loadMessages();
    if (!messages[target]) messages[target] = [];
    messages[target].push({
        from: from,
        content: content.trim(),
        timestamp: Date.now()
    });
    saveMessages(messages);
}

/**
 * 获取并删除玩家所有未读留言
 * @param {string} target - 玩家名
 * @returns {Array} 留言列表 [{ from, content, timestamp }]
 */
function takeMessages(target) {
    const messages = loadMessages();
    const userMessages = messages[target] || [];
    delete messages[target];
    saveMessages(messages);
    // 按时间排序（旧→新）
    userMessages.sort((a, b) => a.timestamp - b.timestamp);
    return userMessages;
}

/**
 * 查看未读留言数量（不删除）
 * @param {string} target
 * @returns {number}
 */
function getMessageCount(target) {
    const messages = loadMessages();
    return messages[target] ? messages[target].length : 0;
}

module.exports = { addMessage, takeMessages, getMessageCount };