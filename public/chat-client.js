// 客户端核心逻辑 (精简版)
const statusEl = document.getElementById('status-indicator');
const chatContainer = document.getElementById('chat-container');
const inputEl = document.getElementById('message-input');
const sendBtn = document.getElementById('send-button');

// 状态更新函数
function updateStatus(text, isError = false) {
  statusEl.textContent = ` ${text} (${new Date().toLocaleTimeString()})`;
  statusEl.style.color = isError ? 'red' : 'green';
}

// 消息渲染函数
function addMessageToDOM(message, isHistorical = false) {
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
    const entities = { '&':'&amp;', '<':'&lt;', '>':'&gt;', '\'':'&#39;', '"':'&quot;'};    return entities[c];  });}

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
    updateStatus('Connected');
    if (!historyLoaded) {
      socket.emit('get history', (err, messages) => {
        if (!err) {
          messages.forEach(msg => addMessageToDOM(msg, true));
          historyLoaded = true;
        }
      });
    }
  });

  socket.on('disconnect', () => updateStatus('Disconnected', true));
  socket.on('connect_error', err => updateStatus(`Connection error: ${err.message}`, true));
  socket.on('chat message', addMessageToDOM);

  // 发送消息处理
  window.sendMessage = () => {
    const message = inputEl.value.trim();
    if (!message || !socket.connected) return;
    socket.emit('chat message', {content: message}, err => {
      if (!err) inputEl.value = '';
      else updateStatus(`send message error: ${err}`, true);
    });
  };

  sendBtn.addEventListener('click', window.sendMessage);
inputEl.addEventListener('keypress', e => e.key === 'Enter' && window.sendMessage());

// 推送链接管理逻辑
document.getElementById('save-push-url').addEventListener('click', () => {
  const pushUrl = document.getElementById('push-url-input').value.trim();
  if (pushUrl) {
    socket.emit('save push url', pushUrl, (err, msg) => {
      updateStatus(err ? `save push url error: ${err}` : msg);
    });
  } else {
    updateStatus('not input push url');
  }
});

// 加载所有推送链接
socket.on('connect', () => {
  socket.emit('get push urls', (err, urls) => {
    if (!err && urls && urls.length > 0) {
      const urlList = urls.map(url => `<div class="push-url-item">${url}<button class="remove-url-btn">×</button></div>`).join('');
      document.getElementById('push-url-list').innerHTML = urlList;
      // 添加删除按钮事件
      document.querySelectorAll('.remove-url-btn').forEach(btn => {
        btn.addEventListener('click', function() {
          const url = this.parentElement.textContent.trim().replace('×', '').trim();
          socket.emit('remove push url', url, (err, msg) => {
            updateStatus(err ? `remove push url error: ${err}` : msg);
            this.parentElement.remove();
          });
        });
      });
    }
  });
})
}

document.addEventListener('DOMContentLoaded', initSocket);