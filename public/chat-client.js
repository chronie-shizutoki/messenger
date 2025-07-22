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
function renderPushUrls(urls) {
  const list = document.getElementById('push-url-list');
  list.innerHTML = '';
  urls.forEach(url => {
    const urlItem = document.createElement('div');
    urlItem.className = 'push-url-item';
    
    const urlText = document.createElement('span');
    urlText.textContent = url;
    urlText.style.overflow = 'hidden';
    urlText.style.textOverflow = 'ellipsis';
    urlText.style.whiteSpace = 'nowrap';
    
    const removeBtn = document.createElement('button');
    removeBtn.className = 'remove-url-btn';
    removeBtn.innerHTML = '<i class="fa fa-trash"></i> ×';
    removeBtn.onclick = () => {
      socket.emit('remove push url', url, (err, msg) => {
        updateStatus(err ? `remove push url error: ${err}` : msg);
        urlItem.remove();
      });
    };
    
    urlItem.appendChild(urlText);
    urlItem.appendChild(removeBtn);
    list.appendChild(urlItem);
  });
}

socket.on('connect', () => {
  socket.emit('get push urls', (err, urls) => {
    if (!err && urls && urls.length > 0) {
      renderPushUrls(urls);
    }
  });
})
}

// 弹窗控制逻辑
const modal = document.getElementById('notification-modal');
const openBtn = document.getElementById('open-notification-settings');
const closeBtn = document.getElementById('close-modal');

// 打开弹窗
function openNotificationModal() {
  modal.style.display = 'flex';
  // 触发重排后应用动画
  setTimeout(() => {
      modal.style.opacity = '1';
      modal.style.transform = 'scale(1)';
      modal.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
  }, 10);
}
openBtn.addEventListener('click', openNotificationModal);

// 关闭弹窗
function closeModal() {
  modal.style.opacity = '0';
  modal.style.transform = 'scale(0.9)';
  modal.style.backgroundColor = 'rgba(0, 0, 0, 0)';
  // 等待动画完成后隐藏
  setTimeout(() => {
      modal.style.display = 'none';
  }, 300);
}

closeBtn.addEventListener('click', closeModal);

// 点击外部区域关闭弹窗
modal.addEventListener('click', (e) => {
  if (e.target === modal) {
    closeModal();
  }
});

document.addEventListener('DOMContentLoaded', initSocket);