const config = require('../config.json');
const { getAllStats } = require('./playerStats');

function formatDuration(ms) {
    if (!ms || ms <= 0) return '0分钟';
    const totalMinutes = Math.floor(ms / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours > 0) return `${hours}小时${minutes}分钟`;
    return `${minutes}分钟`;
}

async function getPlayerProfile(bot, username) {
    const statsMap = getAllStats(); // 返回数组
    const stat = statsMap.find(s => s.name === username);
    if (!stat) return `玩家 ${username} 从未上过线。`;
    let lines = [`=== ${username} 资料卡 ===`];
    lines.push(`上线次数: ${stat.joinCount}`);
    lines.push(`总在线时长: ${formatDuration(stat.totalOnlineTime)}`);
    if (config.profile?.showDeaths !== false) {
        // 注意：death 次数需要额外监听，若未实现则显示未知
        lines.push(`死亡次数: 尚未统计`);
    }
    if (config.profile?.showFirstSeen !== false) {
        lines.push(`首次出现: ${stat.lastJoin ? new Date(stat.lastJoin).toLocaleDateString() : '未知'}`);
    }
    lines.push(`最后上线: ${stat.lastJoin ? new Date(stat.lastJoin).toLocaleString() : '从未'}`);
    lines.push(`最后下线: ${stat.lastLeave ? new Date(stat.lastLeave).toLocaleString() : '从未'}`);
    return lines.join('\n');
}

module.exports = { getPlayerProfile };