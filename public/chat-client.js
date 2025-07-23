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
    <div class="content">${parseMessageContent(message.content)}</div>
  `;
  chatContainer.appendChild(div);
  chatContainer.scrollTop = chatContainer.scrollHeight;

}

// Markdown图片解析与XSS防护
function parseMessageContent(text) {
  // 基础XSS过滤
  const safeText = text.replace(/[&<>'"]/g, c => {
    const entities = { '&':'&amp;', '<':'&lt;', '>':'&gt;', '\'':'&#39;', '"':'&quot;' };
    return entities[c];
  });
  // 解析Markdown图片语法 ![alt](url)
  return safeText.replace(/!\[(.*?)\]\((.*?)\)/g, (match, alt, url) => {
    // 验证URL格式
    if (url && (url.startsWith('/') || url.startsWith('http'))) {
      return `<img src="${url}?t=${new Date().getTime()}" alt="${alt || 'sticker'}" class="chat-sticker">`;
    }
    return match; // 无效URL保持原样
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

document.addEventListener('DOMContentLoaded', function() {
    // 贴图选择功能
    const stickerButton = document.getElementById('sticker-button');
    const stickerModal = document.getElementById('sticker-modal');
    const closeStickerModal = document.getElementById('close-sticker-modal');
    const stickerCategories = document.getElementById('sticker-categories');
    const stickerGrid = document.getElementById('sticker-grid');
    const messageInput = document.getElementById('message-input');

    // 显示贴图模态框
    stickerButton.addEventListener('click', async () => {
        stickerModal.style.display = 'flex';
        await loadStickers();
    });

    // 关闭贴图模态框
    closeStickerModal.addEventListener('click', () => {
        stickerModal.style.display = 'none';
    });

    // 点击模态框外部关闭
    stickerModal.addEventListener('click', (e) => {
        if (e.target === stickerModal) {
            stickerModal.style.display = 'none';
        }
    });

    // 加载贴图数据
    async function loadStickers() {
        try {
            const response = await fetch('/get-stickers');
            if (!response.ok) throw new Error('Failed to load stickers');
            const stickers = await response.json();

            // 渲染分类标签
            renderCategories(stickers);
            // 默认显示第一个分类的贴图
            const firstCategory = Object.values(stickers)[0];
            if (firstCategory) {
                const categoryStickers = Array.isArray(firstCategory.stickers) ? firstCategory.stickers : [];
                renderStickers(categoryStickers);
            }
        } catch (error) {
            console.error('Error loading stickers:', error);
            stickerGrid.innerHTML = '<div style="color: white; text-align: center; padding: 20px;">Failed to load stickers</div>';
        }
    }

    // 渲染分类标签
    function renderCategories(stickers) {
        stickerCategories.innerHTML = '';
        Object.values(stickers).forEach(category => {
            const button = document.createElement('button');
            button.textContent = category.name || 'Unnamed Category';
            button.className = 'sticker-category-btn';
            button.style.backgroundColor = '#333';
            button.style.color = 'white';
            button.style.border = '1px solid #444';
            button.style.borderRadius = '4px';
            button.style.padding = '5px 10px';
            button.style.margin = '0 5px 5px 0';
            button.style.cursor = 'pointer';

            button.addEventListener('click', () => {
                const categoryStickers = Array.isArray(category.stickers) ? category.stickers : [];
                renderStickers(categoryStickers);
                // 更新活跃分类样式
                document.querySelectorAll('.sticker-category-btn').forEach(btn => {
                    btn.style.backgroundColor = '#333';
                });
                button.style.backgroundColor = '#555';
            });

            stickerCategories.appendChild(button);
        });
    }

    // 渲染贴图网格
function renderStickers(stickers) {
    stickerGrid.innerHTML = '';
    if (!Array.isArray(stickers)) {
        console.error('Invalid sticker data format:', stickers);
        stickerGrid.innerHTML = '<div style="color: white; text-align: center; padding: 20px;">Failed to load stickers: invalid data format</div>';
        return;
    }
    
    if (stickers.length === 0) {
        stickerGrid.innerHTML = '<div style="color: white; text-align: center; padding: 20px;">No stickers found in this category</div>';
        return;
    }
    
    stickers.forEach((sticker, index) => {
        try {
            const stickerElement = document.createElement('div');
            stickerElement.style.textAlign = 'center';
            stickerElement.style.cursor = 'pointer';
            stickerElement.title = sticker.name || 'Sticker';
            stickerElement.dataset.stickerId = index;

            const img = document.createElement('img');
            // 确保URL正确，添加时间戳防止缓存
            img.src = `${(sticker.url.startsWith('/') ? sticker.url : `/sticker/${sticker.url}`)}?t=${new Date().getTime()}`;
            img.alt = sticker.name || 'Sticker';
            img.style.width = '100%';
            img.style.height = 'auto';
            img.style.borderRadius = '4px';
            img.style.objectFit = 'contain';
            img.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
            img.style.padding = '5px';
            
            // 添加图片加载失败处理
            img.onerror = () => {
                img.src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA1MTIgNTEyIj48cGF0aCBmaWxsPSIjZTBlMGUwIiBkPSJNMjU2IDhDMTE5IDggOCAxMTkgOCAyNTZzMTExIDI0OCAyNDggMjQ4IDI0OC0xMTEgMjQ4LTI0OFMzOTMgOCAyNTYgOHptMCA0NDhjLTExMC41IDAtMjAwLTg5LjUtMjAwLTIwMFMxNDUuNSA1NiAyNTYgNTZzMjAwIDg5LjUgMjAwIDIwMC04OS41IDIwMC0yMDAgMjAwem03NC42LTE2NS43Yy0xMi45LTEyLjktMzMuNy0xMi45LTQ2LjYgMC0xMi45IDEyLjktMTIuOSAzMy43IDAgNDYuNkwzNDYuNiAzMDJsLTY2LjYgNjYuNmMtMTIuOSAxMi45LTEyLjkgMzMuNyAwIDQ2LjZzMzMuNyAxMi45IDQ2LjYgMGwxMjguMi0xMjguMmMxMi45LTEyLjkgMTIuOS0zMy43IDAtNDYuNnMtMzMuNy0xMi45LTQ2LjYgMHoiLz48L3N2Zz4=';
                console.error(`Failed to load sticker: ${sticker.url}`);
            };

            stickerElement.appendChild(img);
            stickerGrid.appendChild(stickerElement);

            // 点击贴图直接发送
            stickerElement.addEventListener('click', () => {
                const stickerMarkdown = `![${sticker.name || 'sticker'}](${sticker.url})`;
                messageInput.value = stickerMarkdown;
                window.sendMessage(); // 直接调用发送函数
                stickerModal.style.display = 'none';
            });
        } catch (error) {
            console.error('Error creating sticker element:', error);
            stickerGrid.innerHTML += `<div style="color: red; padding: 5px;">Error loading sticker ${index + 1}</div>`;
        }
    });
}

    // 原有初始化逻辑
    initSocket();
});