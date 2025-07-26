// 客户端核心逻辑 (精简版)
const statusEl = document.getElementById('status-indicator');
const chatContainer = document.getElementById('chat-container');
const inputEl = document.getElementById('message-input');
const sendBtn = document.getElementById('send-button');
let allMessages = [];

// 状态更新函数
function updateStatus(text, isError = false) {
  statusEl.textContent = ` ${text} (${new Date().toLocaleTimeString()})`;
  statusEl.style.color = isError ? 'red' : 'green';
}

// 消息渲染函数
function addMessageToDOM(message, isHistorical = false, searchTerm = '') {
  // 仅在历史加载或新消息时添加到数组，避免重复
  if (!allMessages.some(m => m.timestamp === message.timestamp)) {
    allMessages.push(message);
  }
  const div = document.createElement('div');
div.className = 'message';
div.dataset.timestamp = message.timestamp;
div.innerHTML = `
  <div class="message-header">
    <div class="meta">${new Date(message.timestamp).toLocaleString()}</div>
    <button class="quote-btn" data-i18n-title="chat.quote_reply">↩️</button>
  </div>
  ${message.quote ? `<div class="quote-content">
    <div class="quote-meta">${new Date(message.quote.timestamp).toLocaleString()}</div>
    <div class="quote-text">${parseMessageContent(message.quote.content)}</div>
  </div>` : ''}
  <div class="content">${parseMessageContent(message.content, searchTerm)}</div>
`;

// 添加引用按钮事件
const quoteBtn = div.querySelector('.quote-btn');
quoteBtn.addEventListener('click', () => {
  const quotedContent = message.content;
  const quotedTimestamp = message.timestamp;
  inputEl.value = `[quote=${quotedTimestamp}]${quotedContent}[/quote]
`;
  inputEl.focus();
});
  chatContainer.appendChild(div);
  if (!isHistorical) {
    chatContainer.scrollTop = chatContainer.scrollHeight;
  }
}

/**
 * 辅助函数：转义HTML特殊字符以防止XSS
 * @param {string} str - 需要转义的字符串
 * @returns {string} - 转义后的安全字符串
 */
function escapeHtml(str) {
  if (!str) return '';
  const entities = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
    '/': '&#x2F;' // 防止HTML标签闭合
  };
  return str.replace(/[&<>"'/]/g, c => entities[c]);
}

/**
 * 主解析函数：将包含自定义格式的文本转换为安全的HTML
 * @param {string} text - 原始输入文本
 * @param {string} [searchTerm] - (可选) 需要高亮的搜索词
 * @returns {string} - 解析后的HTML字符串
 */
function decodeHtmlEntities(str) {
  return str.replace(/&#(?:x([0-9A-Fa-f]+)|([0-9]+));/gi, (match, hex, dec) => {
    return String.fromCharCode(hex ? parseInt(hex, 16) : parseInt(dec, 10));
  });
}

function parseMessageContent(text, searchTerm = '') {
  let result = text;

  // ====================================================================
  // 步骤 1: 递归解析 [quote] 块 (从内到外)
  // 这是结构性最强的元素，应最先处理。
  // ====================================================================
  const quoteRegex = /\[quote=([\d\-T:.Z]+)\]((?:(?!\[quote)[\s\S])*?)\[\/quote\]/gi;
  let replaced;
  do {
    replaced = false;
    result = result.replace(quoteRegex, (match, timestamp, quotedContent) => {
      replaced = true;
      // 重要的递归：对引用内部的内容应用【同样的解析规则】
      // 这会确保内部的图片、高亮等也能被正确处理。
      const quotedContentHtml = parseMessageContent(quotedContent, searchTerm);
      
      // 使用 new Date() 可能是安全的，但最好也对 timestamp 进行校验
      // 移除时间戳前的美元符号并解码HTML实体
const decodedTimestamp = decodeHtmlEntities(timestamp).replace(/^\$/, '').trim();
const safeTimestamp = new Date(decodedTimestamp).toLocaleString();
      
      return `<div class="quote-content">
        <div class="quote-meta">${i18n.t('chat.quote_from', {safeTimestamp})}</div>
        <div class="quote-text">${quotedContentHtml}</div>
      </div>`;
    });
  } while (replaced);

  // ====================================================================
  // 步骤 2: 解析Markdown图片 ![alt](url)
  // 此时，引用块已被替换为HTML，我们处理剩余内容中的图片。
  // ====================================================================
  const imageRegex = /!\[(.*?)\]\((.*?)\)/g;
  result = result.replace(imageRegex, (match, alt, url) => {
    // **安全关键点**: 对URL进行严格白名单校验
    const trimmedUrl = url.trim();
    const urlRegex = /^(https?:\/\/|\/)/; // 只允许 http, https 或相对路径开头
    
    if (urlRegex.test(trimmedUrl)) {
      // **安全关键点**: 在将alt文本放入HTML属性前，必须进行转义！
      const safeAlt = escapeHtml(alt);
      const safeUrl = escapeHtml(trimmedUrl); // 也转义URL，防止URL中包含"等字符破坏属性
      const timestamp = new Date().getTime();

      return `<a href="${safeUrl}?t=${timestamp}" data-lightbox="chat-images" data-title="${safeAlt || 'Image'}">
        <img src="${safeUrl}?t=${timestamp}" alt="${safeAlt || 'sticker'}" class="chat-image">
      </a>`;
    }
    // 如果URL无效，则将整个Markdown语法转义后显示，而不是保持原样或隐藏
    return escapeHtml(match);
  });

  // ====================================================================
  // 步骤 3: 转义剩余的纯文本中的HTML字符
  // 这一步非常重要，它处理所有不是由我们生成的HTML。
  // 为了避免破坏我们已经生成的HTML标签（如<div>, <img>），我们使用一种
  // 更聪明的方法：只转义那些不在标签内部的特殊字符。
  // 一个简单但有效的技巧是：先转义&，然后是<和>。
  // ====================================================================
  let finalHtml = '';
  let lastIndex = 0;
  const tagRegex = /(<[^>]+>)/g; // 匹配我们已经生成的HTML标签

  // 遍历字符串，只对标签之外的部分进行转义
  let match;
  while ((match = tagRegex.exec(result)) !== null) {
    // Do not escape the text between the last tag and the current tag
    finalHtml += result.substring(lastIndex, match.index);
    // 添加标签本身（不转义）
    finalHtml += match[0];
    lastIndex = tagRegex.lastIndex;
  }
  // 转义最后一个标签之后剩余的文本
  finalHtml += escapeHtml(result.substring(lastIndex));
  
  result = finalHtml;
  
  // ====================================================================
  // 步骤 4: 处理搜索词高亮
  // 这是最后一步，在所有HTML结构都已生成并且内容都已安全转义后进行。
  // 这样可以避免破坏之前的解析步骤。
  // 注意：这个高亮操作可能会在HTML属性中添加<span>，需要谨慎。
  // 更安全的高亮应该只在文本节点上操作，但对于简单应用，以下方法可以接受。
  // ====================================================================
 if (searchTerm && searchTerm.length > 0) {
   try {
      const escapedTerm = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`(${escapedTerm})`, 'gi');
      result = result.replace(regex, '<span class="highlight">$1</span>');
      } catch (e) {
        console.error('Error in search regex:', e);
      }
 }

  return result;
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

  // 解析引用格式 [quote=timestamp]content[/quote]
  const quoteRegex = /\[quote=(\d+)\]([\s\S]*?)\[\/quote\]\n?/i;
  const match = message.match(quoteRegex);
  let content = message;
  let quote = null;

  if (match) {
    const quotedTimestamp = match[1];
    const quotedContent = match[2];
    content = message.replace(quoteRegex, '');

    // 查找被引用的消息
    const quotedMessage = allMessages.find(m => m.timestamp === quotedTimestamp);
    if (quotedMessage) {
      quote = {
        timestamp: quotedTimestamp,
        content: quotedMessage.content
      };
    }
  }

  socket.emit('chat message', {content, quote}, err => {
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
    // 搜索功能初始化
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const searchTerm = e.target.value.trim().toLowerCase();
            filterMessages(searchTerm);
        });
    }

    function filterMessages(searchTerm) {
        chatContainer.innerHTML = '';
        const filteredMessages = searchTerm 
            ? allMessages.filter(msg => msg.content.toLowerCase().includes(searchTerm))
            : allMessages;
        
        filteredMessages.forEach(msg => {
            addMessageToDOM(msg, true, searchTerm);
        });
    }

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
        // 触发重排后添加active类以启动动画
        setTimeout(() => {
            stickerModal.classList.add('active');
        }, 10);
        await loadStickers();
    });

    // 关闭贴图模态框
    closeStickerModal.addEventListener('click', () => {
        stickerModal.classList.remove('active');
        // 过渡结束后隐藏模态框
        stickerModal.addEventListener('transitionend', () => {
            stickerModal.style.display = 'none';
        }, { once: true });
    });

    // 点击模态框外部关闭
    stickerModal.addEventListener('click', (e) => {
        if (e.target === stickerModal) {
            stickerModal.style.display = 'none';
        }
    });

    // 图片上传功能
    const uploadButton = document.getElementById('upload-image-button');
    if (uploadButton) {
        uploadButton.addEventListener('click', () => {
            // 创建隐藏的文件输入元素
            const fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.accept = '.jpg,.jpeg,.png,.gif,.svg';
            fileInput.style.display = 'none';
            
            // 监听文件选择事件
            fileInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    uploadImageFile(file);
                }
            });
            
            // 添加到文档并触发点击
            document.body.appendChild(fileInput);
            fileInput.click();
            
            // 清理
            setTimeout(() => document.body.removeChild(fileInput), 0);
        });
    }

    // 上传图片到服务器
    function uploadImageFile(file) {
        const formData = new FormData();
        formData.append('image', file);
        
        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/chat/upload-image');
        xhr.setRequestHeader('Accept', 'application/json');
        
        // 上传进度处理
        xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable) {
                const percent = Math.round((e.loaded / e.total) * 100);
                updateStatus(`uploading: ${percent}%`);
            }
        });
        
        // 上传完成处理
        xhr.addEventListener('load', () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                try {
                    const response = JSON.parse(xhr.responseText);
                    if (response.imageUrl) {
                        // 将图片URL插入到消息输入框
                        const messageInput = document.getElementById('message-input');
                        messageInput.value += `![${file.name}](${response.imageUrl})`;
                        updateStatus('image uploaded');
                    } else {
                        updateStatus('upload failed: no image url', true);
                    }
                } catch (error) {
                    updateStatus('upload failed: server response format error', true);
                }
            } else {
                updateStatus(`upload failed: ${xhr.statusText}`, true);
            }
        });
        
        // 错误处理
        xhr.addEventListener('error', () => {
            updateStatus('network error, upload failed', true);
        });
        
        xhr.send(formData);
    }

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