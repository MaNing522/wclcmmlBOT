const config = require('./config');
let firstSpawn = true;

function load(bot) {
  if (!config.login.enabled) return;
  const password = config.login.password;
  if (!password) { console.warn('⚠️ 无密码'); return; }

  const mode = config.login.mode || 'force';
  const regCmd = config.login.registerCommand || '/register';
  const logCmd = config.login.loginCommand || '/login';
  let loggedIn = false;
  let attempts = 0;

  function doLogin() {
    if (loggedIn) return;
    attempts++;
    console.log(`🔐 登录尝试 ${attempts}`);
    if (config.login.autoRegister) {
      bot.chat(`${regCmd} ${password} ${password}`);
      setTimeout(() => bot.chat(`${logCmd} ${password}`), 500);
    } else {
      bot.chat(`${logCmd} ${password}`);
    }
  }

  bot.once('spawn', () => {
    if (firstSpawn) {
      firstSpawn = false;
      if (mode === 'force') setTimeout(doLogin, 1000);
    } else {
      console.log('♻️ 重生，跳过登录');
    }
  });

  bot.on('chat', (username, msg) => {
    if (loggedIn) return;
    if (/成功登录|welcome|joined|login successful/i.test(msg)) {
      loggedIn = true;
      console.log('✅ 登录成功');
    }
  });

  bot.on('kicked', (reason) => {
    if (/login|register|password/i.test(reason.toString())) {
      firstSpawn = true;
      loggedIn = false;
    }
  });
}

module.exports = { load };