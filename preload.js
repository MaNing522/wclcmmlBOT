const { contextBridge, ipcRenderer } = require('electron');

console.log('🔌 preload.js 已执行');

contextBridge.exposeInMainWorld('electronAPI', {
  sendCommand: (command) => {
    console.log('📤 sendCommand:', command);
    ipcRenderer.send('command', command);
  },
  sendChatMessage: (message) => {
    console.log('📤 sendChatMessage:', message);
    ipcRenderer.send('send-chat-message', message);
  },
  onLog: (callback) => {
    console.log('📥 注册 onLog 监听');
    ipcRenderer.on('log', (event, message) => callback(message));
  },
  onStatus: (callback) => {
    console.log('📥 注册 onStatus 监听');
    ipcRenderer.on('status', (event, data) => callback(data));
  }
});