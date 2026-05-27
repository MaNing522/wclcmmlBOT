const config = require('../config.json');

const games = new Map(); // username -> { number, attempts, startTime, active }
const stats = new Map(); // username -> { wins, totalAttempts }

function startGuessGame(username) {
    if (games.has(username) && games.get(username).active) {
        return '你已经有进行中的猜数字游戏，请先 !guess stop 结束当前游戏。';
    }
    const rangeMin = config.guessGame?.rangeMin || 1;
    const rangeMax = config.guessGame?.rangeMax || 100;
    const number = Math.floor(Math.random() * (rangeMax - rangeMin + 1)) + rangeMin;
    games.set(username, { number, attempts: 0, startTime: Date.now(), active: true });
    return `猜数字游戏开始！数字范围 ${rangeMin}~${rangeMax}，输入 !guess <数字> 猜测。`;
}

function guessNumber(username, num) {
    const game = games.get(username);
    if (!game || !game.active) return '没有进行中的游戏，请先 !guess start';
    game.attempts++;
    const maxAttempts = config.guessGame?.maxAttempts || 10;
    if (game.attempts > maxAttempts) {
        games.delete(username);
        return `猜了 ${maxAttempts} 次还没猜中，游戏结束。答案是 ${game.number}。`;
    }
    if (num === game.number) {
        const duration = Math.floor((Date.now() - game.startTime) / 1000);
        games.delete(username);
        const userStats = stats.get(username) || { wins: 0, totalAttempts: 0 };
        userStats.wins++;
        userStats.totalAttempts += game.attempts;
        stats.set(username, userStats);
        return `恭喜！猜中了！答案是 ${game.number}，用了 ${game.attempts} 次，耗时 ${duration} 秒。`;
    } else if (num < game.number) {
        return `小了！ (已猜 ${game.attempts} 次)`;
    } else {
        return `大了！ (已猜 ${game.attempts} 次)`;
    }
}

function stopGuessGame(username) {
    const game = games.get(username);
    if (!game || !game.active) return '没有进行中的游戏';
    games.delete(username);
    return `已放弃游戏，答案是 ${game.number}。`;
}

function getGuessStats(username) {
    const s = stats.get(username);
    if (!s) return '你还没有猜数字记录。';
    const avg = s.totalAttempts / s.wins;
    return `胜利次数: ${s.wins}，平均尝试次数: ${avg.toFixed(1)} 次。`;
}

module.exports = { startGuessGame, guessNumber, stopGuessGame, getGuessStats };