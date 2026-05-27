const { sendChat } = require('./messageQueue');
let spamTasks = [];
function startSpam(bot, target, count, text, isPrivate) {
  const chatFunc = isPrivate ? () => sendChat(bot, `/msg ${target} ${text}`) : () => sendChat(bot, text);
  if (count === 0) spamTasks.push(setInterval(chatFunc, 200));
  else {
    let sent = 0;
    const id = setInterval(() => {
      if (sent >= count) { clearInterval(id); spamTasks = spamTasks.filter(t => t !== id); return; }
      chatFunc(); sent++;
    }, 200);
    spamTasks.push(id);
  }
}
function stopAllSpam() { spamTasks.forEach(id => clearInterval(id)); spamTasks = []; }
module.exports = { startSpam, stopAllSpam };