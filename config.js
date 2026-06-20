module.exports = {
  server: {
    host: 'sz.frp.one',
    port: 54188,
    version: '1.21.11'
  },
  bot: {
    username: 'Bot',
    owner: 'zwzzxy',
    admins: ['zwzzxy']
  },
  ai: {
    apiKey: '1e4fc5a50377476cabcd028eff08dd32.wxM0oYYuYe1gFpqq',  // 已填入
    model: 'glm-4-flash',
    apiUrl: 'https://open.bigmodel.cn/api/paas/v4/chat/completions'
  },
  antiCheat: {
    moveRandomOffset: 0.8,
    attackDistance: 2.8
  },
  reconnect: {
    enabled: true,
    initialDelay: 5000,
    maxDelay: 120000,
    backoffMultiplier: 1.5,
    maxAttempts: 10
  },
  features: {
    autoRespawn: true,
    respawnDelayMin: 2000,
    respawnDelayMax: 5000
  },
  login: {
    enabled: true,
    mode: 'force',
    password: 'mn123',
    registerCommand: '/register',
    loginCommand: '/login',
    retryDelay: 5000,
    autoRegister: true
  },
  logging: {
    enabled: true,
    directory: 'logs',
    maxSize: 10 * 1024 * 1024
  }
};