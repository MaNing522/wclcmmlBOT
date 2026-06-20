const WS_URL = `ws://${window.location.host}`;
let ws;

function connectWebSocket() {
  ws = new WebSocket(WS_URL);
  ws.onopen = () => {
    console.log('✅ WebSocket 已连接');
    addLog('🔗 已连接服务器', 'success');
  };
  ws.onmessage = (event) => {
    try {
      const { channel, data } = JSON.parse(event.data);
      if (channel === 'status') {
        updateStatus(data);
      } else if (channel === 'log') {
        addLog(data);
      }
    } catch (err) {
      console.error('消息解析错误:', err);
    }
  };
  ws.onclose = () => {
    console.warn('⚠️ WebSocket 断开，3秒后重连...');
    setTimeout(connectWebSocket, 3000);
  };
  ws.onerror = (err) => {
    console.error('WebSocket 错误:', err);
  };
}

// ---------- UI 更新 ----------
function updateStatus(data) {
  const onlineSpan = document.getElementById('online');
  const coordsSpan = document.getElementById('coords');
  const healthSpan = document.getElementById('health');
  const foodSpan = document.getElementById('food');

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
}

function addLog(message, level = 'info') {
  const container = document.getElementById('log-container');
  const entry = document.createElement('div');
  entry.className = 'log-entry';
  const time = new Date().toLocaleTimeString();
  const levelClass = `level-${level}`;
  entry.innerHTML = `<span class="time">[${time}]</span><span class="${levelClass}">${message}</span>`;
  container.appendChild(entry);
  container.scrollTop = container.scrollHeight;
}

// ---------- 发送命令 ----------
function sendCommand(cmd) {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    addLog('⚠️ WebSocket 未连接', 'error');
    return;
  }
  ws.send(JSON.stringify({ type: 'command', payload: cmd }));
  addLog(`> ${cmd}`, 'warn');
}

function sendChatMessage(msg) {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    addLog('⚠️ WebSocket 未连接', 'error');
    return;
  }
  ws.send(JSON.stringify({ type: 'chat', payload: msg }));
  addLog(`💬 发送消息: "${msg}"`, 'success');
}

// ---------- 绑定 DOM 事件 ----------
document.addEventListener('DOMContentLoaded', () => {
  connectWebSocket();

  document.getElementById('sendBtn').addEventListener('click', () => {
    const input = document.getElementById('cmdInput');
    const cmd = input.value.trim();
    if (cmd) {
      sendCommand(cmd);
      input.value = '';
    }
  });
  document.getElementById('cmdInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('sendBtn').click();
  });

  document.getElementById('sendMsgBtn').addEventListener('click', () => {
    const input = document.getElementById('msgInput');
    const msg = input.value.trim();
    if (msg) {
      sendChatMessage(msg);
      input.value = '';
    }
  });
  document.getElementById('msgInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('sendMsgBtn').click();
  });

  document.querySelectorAll('.quick-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const cmd = btn.dataset.cmd;
      if (cmd) sendCommand(cmd);
    });
  });
});