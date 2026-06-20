// ===== 顶部：检查是否已加载 =====
console.log('✅ renderer.js 已加载 (版本 2)');

// 使用 try-catch 避免重复声明错误
let electronAPI;
try {
  electronAPI = window.electronAPI;
} catch (e) {
  console.error('❌ 无法获取 electronAPI:', e);
}

if (!electronAPI) {
  console.error('❌ electronAPI 未定义，请检查 preload.js');
} else {
  console.log('✅ electronAPI 可用:', Object.keys(electronAPI));
}

const logContainer = document.getElementById('log-container');
const onlineSpan = document.getElementById('online');
const coordsSpan = document.getElementById('coords');
const healthSpan = document.getElementById('health');
const foodSpan = document.getElementById('food');
const cmdInput = document.getElementById('cmdInput');
const sendBtn = document.getElementById('sendBtn');
const msgInput = document.getElementById('msgInput');
const sendMsgBtn = document.getElementById('sendMsgBtn');

function addLog(message, level = 'info') {
  const entry = document.createElement('div');
  entry.className = 'log-entry';
  const time = new Date().toLocaleTimeString();
  const levelClass = `level-${level}`;
  entry.innerHTML = `<span class="time">[${time}]</span><span class="${levelClass}">${message}</span>`;
  logContainer.appendChild(entry);
  logContainer.scrollTop = logContainer.scrollHeight;
}

// 接收日志
if (electronAPI && electronAPI.onLog) {
  electronAPI.onLog((message) => addLog(message));
} else {
  console.warn('⚠️ onLog 不可用');
}

// 接收状态
if (electronAPI && electronAPI.onStatus) {
  electronAPI.onStatus((data) => {
    console.log('📩 收到状态更新:', data);
    if (data.online) {
      onlineSpan.textContent = '在线';
      onlineSpan.style.color = '#6f6';
      if (data.position) {
        coordsSpan.textContent = `${data.position.x.toFixed(1)}, ${data.position.y.toFixed(1)}, ${data.position.z.toFixed(1)}`;
      }
      if (data.health !== undefined) healthSpan.textContent = data.health;
      if (data.food !== undefined) foodSpan.textContent = data.food;
    } else {
      onlineSpan.textContent = '离线';
      onlineSpan.style.color = '#f66';
      coordsSpan.textContent = '-';
      healthSpan.textContent = '-';
      foodSpan.textContent = '-';
    }
  });
} else {
  console.warn('⚠️ onStatus 不可用');
}

// 命令发送
function sendCommand() {
  const cmd = cmdInput.value.trim();
  if (!cmd) return;
  if (electronAPI && electronAPI.sendCommand) {
    electronAPI.sendCommand(cmd);
    addLog(`> ${cmd}`, 'warn');
  } else {
    addLog('❌ sendCommand 不可用', 'error');
  }
  cmdInput.value = '';
}
sendBtn.addEventListener('click', sendCommand);
cmdInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') sendCommand(); });

// 快速按钮
document.querySelectorAll('.quick-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const cmd = btn.dataset.cmd;
    if (cmd && electronAPI && electronAPI.sendCommand) {
      electronAPI.sendCommand(cmd);
      addLog(`> ${cmd}`, 'warn');
    }
  });
});

// 消息发送
function sendMessage() {
  const msg = msgInput.value.trim();
  if (!msg) return;
  if (electronAPI && electronAPI.sendChatMessage) {
    electronAPI.sendChatMessage(msg);
    addLog(`💬 发送消息: "${msg}"`, 'success');
  } else {
    addLog('❌ sendChatMessage 不可用', 'error');
  }
  msgInput.value = '';
}
sendMsgBtn.addEventListener('click', sendMessage);
msgInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') sendMessage(); });

addLog('✅ 控制台已加载，等待机器人连接...', 'success');