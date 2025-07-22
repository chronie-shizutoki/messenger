// 客户端核心逻辑 (精简版)
const statusEl = document.getElementById('status-indicator');
const chatContainer = document.getElementById('chat-container');
const inputEl = document.getElementById('message-input');
const sendBtn = document.getElementById('send-button');

// 状态更新函数
function updateStatus(text, isError = false) {
  statusEl.textContent = `状态: ${text} (${new Date().toLocaleTimeString()})`;
  statusEl.style.color = isError ? 'red' : 'green';
}

// 消息渲染函数
function addMessageToDOM(message) {
  const div = document.createElement('div');
  div.className = 'message';
  div.innerHTML = `
    <div class="meta">${new Date(message.timestamp).toLocaleTimeString()}</div>
    <div class="content">${escapeHTML(message.content)}</div>
  `;
  chatContainer.appendChild(div);
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

// XSS防护
function escapeHTML(text) {
  return text.replace(/[&<>'"]/g, c => {
    const entities = { '&':'&amp;', '<':'&lt;', '>':'&gt;', '\'':'&#39;', '"':'&quot;' };
    return entities[c];
  });
}

// 初始化Socket
let socketInitialized = false;
let historyLoaded = false;
function initSocket() {
  if (socketInitialized) return;
  socketInitialized = true;
  const socket = io({
    transports: ['websocket'],
    reconnectionAttempts: 3
  });

  // 事件处理
  socket.on('connect', () => {
    updateStatus('已连接到服务器');
    if (!historyLoaded) {
      socket.emit('get history', (err, messages) => {
        if (!err) {
          messages.forEach(addMessageToDOM);
          historyLoaded = true;
        }
      });
    }
  });

  socket.on('disconnect', () => updateStatus('已断开连接', true));
  socket.on('connect_error', err => updateStatus(`连接错误: ${err.message}`, true));
  socket.on('chat message', addMessageToDOM);

  // 发送消息处理
  window.sendMessage = () => {
    const message = inputEl.value.trim();
    if (!message || !socket.connected) return;
    socket.emit('chat message', { content: message }, err => {
      if (!err) inputEl.value = '';
      else updateStatus(`发送失败: ${err}`, true);
    });
  };

  sendBtn.addEventListener('click', window.sendMessage);
  inputEl.addEventListener('keypress', e => e.key === 'Enter' && window.sendMessage());
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', initSocket);