// 客户端核心逻辑 (精简版)
const statusEl = document.getElementById('status-indicator');
const chatContainer = document.getElementById('chat-container');
const inputEl = document.getElementById('message-input');
const sendBtn = document.getElementById('send-button');
let allMessages = [];
let currentPage = 1;
let totalPages = 1;
let isLoadingHistory = false;
let virtualScrollEnabled = false;
let pullToLoadIndicator = null;
const VIRTUAL_SCROLL_THRESHOLD = 100; // 当消息超过100条时启用虚拟滚动
const MAX_MESSAGES_IN_MEMORY = 200; // 内存中最多保存200条消息

// 语音录制相关变量
let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;
let recordingStartTime = null;
let recordingTimer = null;

// 状态更新函数
function updateStatus(text, params = {}, isError = false) {
  // 使用window.i18n并添加降级处理
  const translatedText = window.i18n ? window.i18n.t(text, params || {}) : text;
  statusEl.textContent = ` ${translatedText} (${new Date().toLocaleTimeString()})`;
  statusEl.style.color = isError ? 'red' : 'green';
}

// 内存管理函数
function manageMemory() {
  if (allMessages.length > MAX_MESSAGES_IN_MEMORY) {
    // 保留最新的消息，移除最旧的消息
    const messagesToRemove = allMessages.length - MAX_MESSAGES_IN_MEMORY;
    const removedMessages = allMessages.splice(0, messagesToRemove);
    
    // 同时移除对应的DOM元素
    removedMessages.forEach(msg => {
      const element = chatContainer.querySelector(`[data-timestamp="${msg.timestamp}"]`);
      if (element) {
        element.remove();
      }
    });
    
    console.log(`Memory cleanup: removed ${messagesToRemove} old messages`);
  }
}

// 消息渲染函数
function addMessageToDOM(message, isHistorical = false, searchTerm = '', prepend = false) {
  // 仅在历史加载或新消息时添加到数组，避免重复
  if (!allMessages.some(m => m.timestamp === message.timestamp)) {
    if (prepend) {
      allMessages.unshift(message); // 历史消息添加到开头
    } else {
      allMessages.push(message); // 新消息添加到末尾
      // 新消息时进行内存管理
      if (!isHistorical) {
        manageMemory();
      }
    }
  }
  
  const div = createMessageElement(message, isHistorical, searchTerm);

  if (prepend) {
    chatContainer.insertBefore(div, chatContainer.firstChild);
  } else {
    chatContainer.appendChild(div);
    if (!isHistorical) {
      chatContainer.scrollTop = chatContainer.scrollHeight;
    }
  }
}

/**
 * Helper function: Return the input string directly without escaping HTML special characters
 * @param {string} str - The string to be processed
 * @returns {string} - The original string
 */
function escapeHtml(str) {
  if (!str) return '';
  return str;
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
        <div class="quote-meta">${window.i18n ? window.i18n.t('chat.quote_from', {safeTimestamp}) : `Quote from: ${safeTimestamp}`}</div>
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

      return `<a href="${safeUrl}?t=${timestamp}" class="image-popup" title="${safeAlt || 'Image'}">
        <img src="${safeUrl}?t=${timestamp}" alt="${safeAlt || 'sticker'}" class="chat-image">
      </a>`;
    }
    // 如果URL无效，则将整个Markdown语法转义后显示，而不是保持原样或隐藏
    return escapeHtml(match);
  });

  // ====================================================================
// 步骤 2.1: 解析文件链接 [fileName](url)
// 为文件链接添加下载功能和适当的图标，以及音频/视频预览
// ====================================================================
const fileLinkRegex = /\[(.*?)\]\((.*?)\)/g;
result = result.replace(fileLinkRegex, (match, fileName, url) => {
  // 跳过已经是图片的链接
  if (match.startsWith('![')) {
    return match;
  }
  
  // **安全关键点**: 对URL进行严格白名单校验
  const trimmedUrl = url.trim();
  const urlRegex = /^(https?:\/\/|\/)/; // 只允许 http, https 或相对路径开头
  
  if (urlRegex.test(trimmedUrl)) {
    // **安全关键点**: 在将文件名和URL放入HTML属性前，必须进行转义！
    const safeFileName = escapeHtml(fileName);
    const safeUrl = escapeHtml(trimmedUrl);
    
    // 尝试获取文件扩展名
    const fileExtension = fileName.split('.').pop().toLowerCase();
    
    // 根据文件类型决定显示图标和处理方式
    let fileIcon = 'fa-file';
    let mediaContent = '';
    
    if (['jpg', 'jpeg', 'png', 'gif', 'svg'].includes(fileExtension)) {
      fileIcon = 'fa-file-image-o';
      // 图片处理逻辑已在步骤2中完成
      return match;
    } else if (fileExtension === 'pdf') {
      fileIcon = 'fa-file-pdf-o';
    } else if (['doc', 'docx'].includes(fileExtension)) {
      fileIcon = 'fa-file-word-o';
    } else if (['xls', 'xlsx'].includes(fileExtension)) {
      fileIcon = 'fa-file-excel-o';
    } else if (['ppt', 'pptx'].includes(fileExtension)) {
      fileIcon = 'fa-file-powerpoint-o';
    } else if (fileExtension === 'txt') {
      fileIcon = 'fa-file-text-o';
    } else if (['zip', 'rar', '7z'].includes(fileExtension)) {
      fileIcon = 'fa-file-archive-o';
    } else if (['js', 'ts', 'css', 'html', 'php', 'py'].includes(fileExtension)) {
      fileIcon = 'fa-file-code-o';
    } else if (['mp3', 'flac', 'wav', 'ogg', 'aac', 'm4a'].includes(fileExtension)) {
      fileIcon = 'fa-file-audio-o';
      // 添加音频播放器
      mediaContent = `<audio controls class="media-player">
        <source src="${safeUrl}" type="audio/${fileExtension}">
        ${window.i18n ? window.i18n.t('audio_player.not_supported') : 'Your browser does not support the audio element'}
      </audio>`;
    } else if (['mp4', 'webm', 'ogg', 'mov', 'avi', 'mkv'].includes(fileExtension)) {
      fileIcon = 'fa-file-video-o';
      // 添加视频播放器
      const videoType = fileExtension === 'mov' ? 'quicktime' : fileExtension;
      mediaContent = `<video controls class="media-player" width="100%">
        <source src="${safeUrl}" type="video/${videoType}">
        ${window.i18n ? window.i18n.t('video_player.not_supported') : 'Your browser does not support the video element'}
      </video>`;
    }
    
    return `<div class="file-item">
      <a href="${safeUrl}" download class="file-link" title="${window.i18n ? window.i18n.t('file.download_title', { fileName: safeFileName }) : `Download ${safeFileName}`}">
        <i class="fas ${fileIcon}"></i> ${safeFileName}
        <i class="fas fa-download download-icon"></i>
      </a>
      ${mediaContent}
    </div>`;
  }
  // 如果URL无效，则将整个链接语法转义后显示
  return escapeHtml(match);
});

// ====================================================================
// 添加媒体播放器样式
const style = document.createElement('style');
style.textContent = `
  /* 音频播放器样式 */
  .media-player {
    margin-top: 8px;
    max-width: 100%;
    border-radius: 4px;
  }
  .file-item {
    margin: 8px 0;
    padding: 8px;
    background-color: #f5f5f5;
    border-radius: 4px;
  }
`;
document.head.appendChild(style);

// 步骤 3: 解析其他Markdown格式
// 标题、加粗、斜体、行内代码
// ====================================================================
  // 标题 (# 到 ######)
  const headingRegex = /^(#{1,6})\s+([^\n]+)/gm;
  result = result.replace(headingRegex, (match, hashes, content) => {
    const level = hashes.length;
    return `<h${level}>${content}</h${level}>`;
  });
  // 加粗 (**text** 或 __text__)
  const boldRegex = /\*\*(.+?)\*\*|__(.+?)__/g;
  result = result.replace(boldRegex, '<strong>$1$2</strong>');

  // Step 3.1: Parse code blocks (```code```)
  const codeBlockRegex = /```([\s\S]*?)```/g;
  result = result.replace(codeBlockRegex, (match, code) => {
    if (code.trim().startsWith('mermaid')) {
      // Add mermaid initialization attributes to ensure correct rendering
      // Remove the data-processed attribute to let mermaid process the graph
      return `<div class="mermaid">${code.trim()}</div>`;
    }
    return `<pre class="code-block"><code class="code-content">${code}</code></pre>`;
  });
  // ====================================================================
  // 步骤 4: 转义剩余的纯文本中的HTML字符
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
    // 转义最后一个标签和当前标签之间的文本
    finalHtml += escapeHtml(result.substring(lastIndex, match.index));
    // 添加标签本身（不转义）
    finalHtml += match[0];
    lastIndex = tagRegex.lastIndex;
  }
  // 转义最后一个标签之后剩余的文本
  finalHtml += escapeHtml(result.substring(lastIndex));
  
  result = finalHtml;
  
  // ====================================================================
  // 步骤 5: 处理搜索词高亮
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

// 显示/隐藏加载指示器
function showLoadingIndicator(show = true) {
  let indicator = document.getElementById('loading-indicator');
  
  if (!indicator) {
    indicator = document.createElement('div');
    indicator.id = 'loading-indicator';
    indicator.innerHTML = `
      <div style="
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 10px;
        color: black;
        border-radius: 4px;
        margin: 10px;
        font-size: 14px;
      ">
        <div style="
          width: 16px;
          height: 16px;
          border: 2px solid #333;
          border-top: 2px solid #fff;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin-right: 8px;
        "></div>
        ${window.i18n ? window.i18n.t('loading_indicator.text') : 'Loading...'}
      </div>
    `;
    
    // 添加CSS动画
    if (!document.getElementById('loading-animation-style')) {
      const style = document.createElement('style');
      style.id = 'loading-animation-style';
      style.textContent = `
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `;
      document.head.appendChild(style);
    }
    
    chatContainer.parentNode.insertBefore(indicator, chatContainer);
  }
  
  indicator.style.display = show ? 'block' : 'none';
}

// 加载历史消息函数
function loadHistory(page = 1, prepend = false) {
  if (isLoadingHistory) return;
  isLoadingHistory = true;
  
  showLoadingIndicator(true);
  // 隐藏上拉提示
  if (pullToLoadIndicator) {
    pullToLoadIndicator.style.display = 'none';
  }
  updateStatus('status.loading_messages', { page });
  
  window.socket.emit('get history', { page, limit: 20 }, (err, result) => {
    isLoadingHistory = false;
    showLoadingIndicator(false);
    
    if (err) {
      updateStatus('status.failed_load_history', {}, true);
      return;
    }
    
    const { messages, pagination } = result;
    currentPage = pagination.currentPage;
    totalPages = pagination.totalPages;
    
    // 记录当前滚动位置（用于加载更多历史消息时保持位置）
    const scrollHeight = chatContainer.scrollHeight;
    const scrollTop = chatContainer.scrollTop;
    
    // 使用批量DOM操作提高性能
    const fragment = document.createDocumentFragment();
    messages.forEach(msg => {
      if (!allMessages.some(m => m.timestamp === msg.timestamp)) {
        if (prepend) {
          allMessages.unshift(msg);
        } else {
          allMessages.push(msg);
        }
        
        const div = createMessageElement(msg, true, '');
        if (prepend) {
          fragment.insertBefore(div, fragment.firstChild);
        } else {
          fragment.appendChild(div);
        }
      }
    });
    
    if (prepend) {
      chatContainer.insertBefore(fragment, chatContainer.firstChild);
    } else {
      chatContainer.appendChild(fragment);
    }
    
    if (prepend && messages.length > 0) {
      // 加载更多历史消息时，保持滚动位置
      const newScrollHeight = chatContainer.scrollHeight;
      chatContainer.scrollTop = scrollTop + (newScrollHeight - scrollHeight);
    } else if (page === 1) {
      // 首次加载时滚动到底部
      setTimeout(() => {
        chatContainer.scrollTop = chatContainer.scrollHeight;
      }, 100);
    }
    
    updateStatus('status.loaded_messages', { count: messages.length, currentPage: pagination.currentPage, totalPages: pagination.totalPages });
  });
}

// 创建消息元素的辅助函数
function createMessageElement(message, isHistorical = false, searchTerm = '') {
  const div = document.createElement('div');
  div.className = 'message';
  div.dataset.timestamp = message.timestamp;
  div.innerHTML = `
  <div class="message-header">
    <div class="meta">${new Date(message.timestamp).toLocaleString()}</div>
    <button class="quote-btn" data-i18n-title="chat.quote_reply"><i class="fas fa-quote-right"></i></button>
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
  
  return div;
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
  
  // 将socket设为全局变量以便其他函数使用
    window.socket = socket;

    // Remove the reference block preview functionality as requested
    // The related code has been removed

  // 事件处理
  socket.on('connect', () => {
    // 使用i18n获取翻译文本
    const connectText = window.i18n ? window.i18n.t('socket.connected') : 'Connected';
    updateStatus(connectText);
    if (!historyLoaded) {
      loadHistory(1);
      historyLoaded = true;
    }
  });

  socket.on('disconnect', () => {
    // 使用i18n获取翻译文本
    const disconnectText = window.i18n ? window.i18n.t('socket.disconnected') : 'Disconnected';
    updateStatus(disconnectText, true);
  });
  socket.on('connect_error', err => {
    // 使用i18n获取翻译文本
    const errorText = window.i18n ? window.i18n.t('socket.connection_error', { errorMessage: err.message }) : `Connection error: ${err.message}`;
    updateStatus(errorText, true);
  });
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
      else {
        // 使用i18n获取翻译文本
        const sendErrorText = window.i18n ? window.i18n.t('message.send_error', { errorMessage: err }) : `send message error: ${err}`;
        updateStatus(sendErrorText, true);
      }
    });
  };

  sendBtn.addEventListener('click', window.sendMessage);
inputEl.addEventListener('keypress', e => e.key === 'Enter' && window.sendMessage());

// 推送链接管理逻辑
document.getElementById('save-push-url').addEventListener('click', () => {
  const pushUrl = document.getElementById('push-url-input').value.trim();
  if (pushUrl) {
    socket.emit('save push url', pushUrl, (err, msg) => {
      // 使用i18n获取翻译文本
      const statusText = err 
        ? (window.i18n ? window.i18n.t('push_url.save_error', { errorMessage: err }) : `save push url error: ${err}`) 
        : msg;
      updateStatus(statusText);
    });
  } else {
    // 使用i18n获取翻译文本
    const emptyUrlText = window.i18n ? window.i18n.t('push_url.empty_url') : 'not input push url';
    updateStatus(emptyUrlText);
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
        // 使用i18n获取翻译文本
        const statusText = err 
          ? (window.i18n ? window.i18n.t('push_url.remove_error', { errorMessage: err }) : `remove push url error: ${err}`) 
          : msg;
        updateStatus(statusText);
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

    // 添加滚动监听器实现自动加载更多历史消息和DOM优化
    let scrollTimeout;
    
    chatContainer.addEventListener('scroll', () => {
        // 防抖处理，避免频繁触发
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => {
            const scrollTop = chatContainer.scrollTop;
            
            // 显示/隐藏上拉加载提示
            if (scrollTop < 50 && currentPage < totalPages && !isLoadingHistory) {
                showPullToLoadIndicator(true);
            } else {
                showPullToLoadIndicator(false);
            }
            
            // 当滚动到顶部附近时自动加载更多历史消息
            if (scrollTop < 20 && currentPage < totalPages && !isLoadingHistory) {
                loadHistory(currentPage + 1, true);
            }
            
            // DOM优化：当消息过多时，移除不可见的消息元素
            optimizeVisibleMessages();
        }, 100);
    });

    // 显示/隐藏上拉加载提示
    function showPullToLoadIndicator(show) {
        if (!pullToLoadIndicator) {
            pullToLoadIndicator = document.createElement('div');
            pullToLoadIndicator.id = 'pull-to-load-indicator';
            // 使用i18n获取翻译文本
            const getMoreText = window.i18n ? window.i18n.t('pull_to_load.more') : '↑ get more';
            pullToLoadIndicator.innerHTML = `
                <div style="
                    text-align: center;
                    padding: 10px;
                    color: #888;
                    font-size: 12px;
                    background: rgba(0,0,0,0.1);
                    border-radius: 4px;
                    margin: 5px;
                    transition: opacity 0.3s ease;
                ">
                    ${getMoreText}
                </div>
            `;
            chatContainer.parentNode.insertBefore(pullToLoadIndicator, chatContainer);
        }
        
        pullToLoadIndicator.style.display = show ? 'block' : 'none';
        pullToLoadIndicator.style.opacity = show ? '1' : '0';
    }

    // DOM优化函数
    function optimizeVisibleMessages() {
        const messages = chatContainer.querySelectorAll('.message');
        if (messages.length <= VIRTUAL_SCROLL_THRESHOLD) return;
        
        const containerRect = chatContainer.getBoundingClientRect();
        const containerTop = containerRect.top;
        const containerBottom = containerRect.bottom;
        const buffer = 200; // 缓冲区域
        
        messages.forEach((messageEl, index) => {
            const messageRect = messageEl.getBoundingClientRect();
            const isVisible = messageRect.bottom >= (containerTop - buffer) && 
                             messageRect.top <= (containerBottom + buffer);
            
            // 保留最近的50条消息始终可见
            const isRecent = index >= messages.length - 50;
            
            if (!isVisible && !isRecent) {
                // 创建占位符元素保持滚动位置
                if (!messageEl.dataset.placeholder) {
                    const placeholder = document.createElement('div');
                    placeholder.style.height = messageEl.offsetHeight + 'px';
                    placeholder.className = 'message-placeholder';
                    placeholder.dataset.timestamp = messageEl.dataset.timestamp;
                    messageEl.parentNode.insertBefore(placeholder, messageEl);
                    messageEl.style.display = 'none';
                    messageEl.dataset.placeholder = 'true';
                }
            } else if (messageEl.dataset.placeholder) {
                // 恢复显示消息
                const placeholder = messageEl.previousElementSibling;
                if (placeholder && placeholder.className === 'message-placeholder') {
                    placeholder.remove();
                }
                messageEl.style.display = 'block';
                delete messageEl.dataset.placeholder;
            }
        });
    }

    function filterMessages(searchTerm) {
        chatContainer.innerHTML = '';
        const filteredMessages = searchTerm 
            ? allMessages.filter(msg => msg.content.toLowerCase().includes(searchTerm))
            : allMessages;
        
        // 使用文档片段来批量添加DOM元素，提高性能
        const fragment = document.createDocumentFragment();
        const tempContainer = document.createElement('div');
        
        filteredMessages.forEach(msg => {
            const div = document.createElement('div');
            div.className = 'message';
            div.dataset.timestamp = msg.timestamp;
            div.innerHTML = `
            <div class="message-header">
                <div class="meta">${new Date(msg.timestamp).toLocaleString()}</div>
                <button class="quote-btn" data-i18n-title="chat.quote_reply"><i class="fas fa-quote-right"></i></button>
            </div>
            ${msg.quote ? `<div class="quote-content">
                <div class="quote-meta">${new Date(msg.quote.timestamp).toLocaleString()}</div>
                <div class="quote-text">${parseMessageContent(msg.quote.content)}</div>
            </div>` : ''}
            <div class="content">${parseMessageContent(msg.content, searchTerm)}</div>
            `;
            
            // 添加引用按钮事件
            const quoteBtn = div.querySelector('.quote-btn');
            quoteBtn.addEventListener('click', () => {
                const quotedContent = msg.content;
                const quotedTimestamp = msg.timestamp;
                inputEl.value = `[quote=${quotedTimestamp}]${quotedContent}[/quote]
`;
                inputEl.focus();
            });
            
            fragment.appendChild(div);
        });
        
        chatContainer.appendChild(fragment);
        
        // 如果没有搜索词，滚动到底部
        if (!searchTerm) {
            setTimeout(() => {
                chatContainer.scrollTop = chatContainer.scrollHeight;
            }, 50);
        }
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

    // 文件上传功能
    const uploadButton = document.getElementById('upload-image-button');
    if (uploadButton) {
        // 更新按钮文本以反映支持多种文件类型
        uploadButton.innerHTML = '<i class="fas fa-paperclip"></i>';
        // 使用i18n获取翻译文本
        uploadButton.title = window.i18n ? window.i18n.t('file_upload.button_title') : 'Upload file';
        
        uploadButton.addEventListener('click', () => {
            // 创建隐藏的文件输入元素
            const fileInput = document.createElement('input');
            fileInput.type = 'file';
            // 扩大文件类型支持范围
            fileInput.style.display = 'none';
            
            // 监听文件选择事件
            fileInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    uploadFile(file);
                }
            });
            
            // 添加到文档并触发点击
            document.body.appendChild(fileInput);
            fileInput.click();
            
            // 清理
            setTimeout(() => document.body.removeChild(fileInput), 0);
        });
    }

    // 上传文件到服务器
    function uploadFile(file) {
        const formData = new FormData();
        formData.append('file', file);
        
        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/upload-file'); // 使用通用文件上传接口
        xhr.setRequestHeader('Accept', 'application/json');
        
        // 上传进度处理
        xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable) {
                const percent = Math.round((e.loaded / e.total) * 100);
                // 使用i18n获取翻译文本
                const progressText = window.i18n ? window.i18n.t('file_upload.progress', { percent }) : `uploading: ${percent}%`;
                updateStatus(progressText);
            }
        });
        
        // 上传完成处理
        xhr.addEventListener('load', () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                try {
                    const response = JSON.parse(xhr.responseText);
                    if (response.fileUrl) {
                        const messageInput = document.getElementById('message-input');
                        
                        // 根据文件类型生成不同的消息内容
                        const fileExtension = file.name.split('.').pop().toLowerCase();
                        const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'svg'];
                        
                        if (imageExtensions.includes(fileExtension)) {
                            // 图片文件仍使用Markdown图片格式
                            messageInput.value += `![${file.name}](${response.fileUrl})`;
                        } else {
                            // 其他文件使用链接格式
                            messageInput.value += `[${file.name}](${response.fileUrl})`;
                        }
                        
                        // 使用i18n获取翻译文本
                        const uploadedText = window.i18n ? window.i18n.t('file_upload.uploaded') : 'File uploaded';
                        updateStatus(uploadedText);
                    } else {
                        // 使用i18n获取翻译文本
                        const noUrlText = window.i18n ? window.i18n.t('upload.no_file_url') : 'Upload failed: no file url';
                        updateStatus(noUrlText, true);
                    }
                } catch (error) {
                    // 使用i18n获取翻译文本
                    const formatErrorText = window.i18n ? window.i18n.t('upload.server_response_format_error') : 'Upload failed: server response format error';
                    updateStatus(formatErrorText, true);
                }
            } else {
                // 使用i18n获取翻译文本
                const uploadErrorText = window.i18n ? window.i18n.t('upload.failed', { statusText: xhr.statusText }) : `Upload failed: ${xhr.statusText}`;
                updateStatus(uploadErrorText, true);
            }
        });
        
        // 错误处理
        xhr.addEventListener('error', () => {
            // 使用i18n获取翻译文本
            const networkErrorText = window.i18n ? window.i18n.t('upload.network_error') : 'Network error, upload failed';
            updateStatus(networkErrorText, true);
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
            // 使用i18n获取翻译文本
            const errorText = window.i18n ? window.i18n.t('sticker.load_failed') : 'Failed to load stickers';
            stickerGrid.innerHTML = `<div style="color: white; text-align: center; padding: 20px;">${errorText}</div>`;
        }
    }

    // 渲染分类标签
    function renderCategories(stickers) {
        stickerCategories.innerHTML = '';
        Object.values(stickers).forEach(category => {
            const button = document.createElement('button');
            button.textContent = category.name || 'Unnamed Category';
            button.className = 'sticker-category-btn';
            button.style.background = 'rgba(148, 145, 145, 0.3)';
            button.style.backdropFilter = 'blur(10px)';
            button.style.border = '1px solid rgba(255, 255, 255, 0.1)';
            button.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1)';
            button.style.color = 'white';
            button.style.border = 'transparent';
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
    
    // 初始化语音录制功能
    initAudioRecording();

    // 添加图片编辑模态框
        function addImageEditorModal() {
            // 使用i18n获取翻译文本
            const closeText = window.i18n ? window.i18n.t('image_editor.close') : '关闭';
            const saveText = window.i18n ? window.i18n.t('image_editor.save_send') : '保存并发送';
            
            const modalHtml = `
            <div id="image-editor-modal" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.9); z-index: 1000;">
                <div style="position: absolute; top: 15px; right: 15px;">
                    <button id="close-editor-btn" style="background: #ff4757; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer;">${closeText}</button>
                    <button id="save-editor-btn" style="background: #2ed573; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer; margin-left: 10px;">${saveText}</button>
                </div>
                <div id="tui-image-editor-container" style="width: 90%; height: 90%; margin: 50px auto;"></div>
            </div>`;
            document.body.insertAdjacentHTML('beforeend', modalHtml);
        }

    // 初始化图片编辑器
    let imageEditor = null;
    function initImageEditor() {
        addImageEditorModal();
        
        const modal = document.getElementById('image-editor-modal');
        const closeBtn = document.getElementById('close-image-editor');
        const saveBtn = document.getElementById('save-editor-btn');
        
        // 关闭编辑器
        closeBtn.addEventListener('click', () => {
            modal.style.display = 'none';
            if (imageEditor) {
                imageEditor.destroy();
                imageEditor = null;
            }
        });
        
        // 保存编辑后的图片
        saveBtn.addEventListener('click', () => {
            if (imageEditor) {
                // 获取编辑后的图片数据URL
                const dataURL = imageEditor.toDataURL();
                
                // 将dataURL转换为文件对象上传
                fetch(dataURL)
                    .then(res => res.blob())
                    .then(blob => {
                        const file = new File([blob], 'edited-image.png', { type: 'image/png' });
                        uploadFile(file);
                        
                        // 关闭编辑器
                        modal.style.display = 'none';
                        imageEditor.destroy();
                        imageEditor = null;
                    });
            }
        });
    }
    
    // 使用Viewer.js实现图片预览功能
    let imageViewer = null;
    
    function previewImage(imageUrl) {
        try {
            // 创建临时容器用于Viewer.js
            let tempContainer = document.getElementById('viewer-temp-container');
            
            if (!tempContainer) {
                tempContainer = document.createElement('div');
                tempContainer.id = 'viewer-temp-container';
                tempContainer.style.display = 'none';
                document.body.appendChild(tempContainer);
            } else {
                // 清空容器
                tempContainer.innerHTML = '';
            }
            
            // 创建图片元素
            const img = document.createElement('img');
            img.src = imageUrl;
            img.alt = 'Preview Image';
            tempContainer.appendChild(img);
            
            // 销毁已存在的viewer实例
            if (imageViewer) {
                imageViewer.destroy();
                imageViewer = null;
            }
            
            // 创建新的viewer实例
            imageViewer = new Viewer(tempContainer, {
                url: 'src',
                title: false,
                navbar: false,
                toolbar: {
                    zoomIn: 1,
                    zoomOut: 1,
                    oneToOne: 1,
                    reset: 1,
                    prev: 0,
                    play: 0,
                    next: 0,
                    rotateLeft: 1,
                    rotateRight: 1,
                    flipHorizontal: 1,
                    flipVertical: 1
                },
                movable: true,
                zoomable: true,
                rotatable: true,
                scalable: true,
                transition: true,
                fullscreen: true,
                keyboard: true,
                show: function() {
                    // 查看器显示时的回调
                },
                hide: function() {
                    // 查看器隐藏时的回调
                    if (imageViewer) {
                        imageViewer.destroy();
                        imageViewer = null;
                    }
                }
            });
            
            // 打开查看器
            imageViewer.show();
        } catch (error) {
            console.error('Failed to open image viewer:', error);
            // 使用i18n获取翻译文本
            const errorText = window.i18n ? window.i18n.t('error.image_preview_failed') : '图片查看失败，请重试。';
            alert(errorText);
        }
    }

    // 打开图片编辑器
    function openImageEditor(imageUrl) {
        try {
            // 获取容器和模态框
            const editorModal = document.getElementById('image-editor-modal');
            const container = document.getElementById('tui-image-editor-container');
            
            if (!editorModal || !container) {
                console.error('Image editor container not found');
                return;
            }
            
            // 清空容器
            container.innerHTML = '';
            
            // 显示模态框
            editorModal.style.display = 'block';
            
            // 使用i18n获取翻译文本
            const editImageName = window.i18n ? window.i18n.t('image_editor.edit_image') : '编辑图片';
            
            // 创建新的图片编辑器
            if (window.tui && window.tui.ImageEditor) {
                imageEditor = new window.tui.ImageEditor('#tui-image-editor-container', {
                    includeUI: {
                        loadImage: {
                            path: imageUrl,
                            name: editImageName
                        },
                        theme: {
                            'common.backgroundColor': '#1e1e1e',
                            'common.border': '1px solid #333'
                        },
                        menuBarPosition: 'left'
                    },
                    cssMaxWidth: 1200,
                    cssMaxHeight: 800
                });
                
                // 确保保存按钮功能
                setupImageEditorSave(editorModal);
            } else {
                console.error('TUI Image Editor is not available');
                // 使用i18n获取翻译文本
                const errorText = window.i18n ? window.i18n.t('error.image_editor_load_failed') : '图片编辑器加载失败，请刷新页面重试。';
                alert(errorText);
                editorModal.style.display = 'none';
            }
        } catch (error) {
            console.error('Failed to open image editor:', error);
            // 使用i18n获取翻译文本
            const errorText = window.i18n ? window.i18n.t('error.image_editor_open_failed', { errorMessage: error.message }) : '图片编辑器打开失败: ' + error.message;
            alert(errorText);
        }
    }
    
    // 设置图片编辑器的保存功能
    function setupImageEditorSave(modal) {
        if (!imageEditor) return;
        
        // 为关闭按钮添加事件 - 使用正确的ID
        const closeBtn = document.getElementById('close-editor-btn');
        if (closeBtn) {
            // 先移除可能存在的事件监听器
            const newCloseBtn = closeBtn.cloneNode(true);
            closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);
            
            // 添加新的事件监听器
            newCloseBtn.addEventListener('click', function() {
                closeImageEditor();
            });
        }
        
        // 使用已有的保存按钮
        const saveButton = document.getElementById('save-editor-btn');
        if (saveButton) {
            // 先移除可能存在的事件监听器
            const newSaveButton = saveButton.cloneNode(true);
            saveButton.parentNode.replaceChild(newSaveButton, saveButton);
            
            // 添加保存事件
            newSaveButton.addEventListener('click', function() {
                try {
                    // 获取编辑后的图片数据
                    const imageData = imageEditor.toDataURL();
                    
                    // 发送图片
                    sendEditedImage(imageData);
                    
                    // 关闭编辑器
                    closeImageEditor();
                } catch (error) {
                    console.error('Failed to save image:', error);
                    // 使用i18n获取翻译文本
                    const errorText = window.i18n ? window.i18n.t('error.save_image_failed', { errorMessage: error.message }) : '保存图片失败: ' + error.message;
                    alert(errorText);
                }
            });
        }
    }
    
    // 关闭图片编辑器
    function closeImageEditor() {
        const editorModal = document.getElementById('image-editor-modal');
        if (editorModal) {
            editorModal.style.display = 'none';
        }
        
        // 销毁编辑器实例
        if (imageEditor) {
            try {
                imageEditor.destroy();
            } catch (error) {
                console.warn('Error destroying image editor:', error);
            }
            imageEditor = null;
        }
    }
    
    // 发送编辑后的图片
    function sendEditedImage(imageData) {
        // 这里是发送编辑后图片的逻辑
        // 将Base64转换为Blob
        const byteString = atob(imageData.split(',')[1]);
        const mimeString = imageData.split(',')[0].split(':')[1].split(';')[0];
        const ab = new ArrayBuffer(byteString.length);
        const ia = new Uint8Array(ab);
        
        for (let i = 0; i < byteString.length; i++) {
            ia[i] = byteString.charCodeAt(i);
        }
        
        const blob = new Blob([ab], {type: mimeString});
        
        // 模拟文件对象
        const file = new File([blob], 'edited-image.png', {type: 'image/png'});
        
        // 使用已有的上传文件函数
        if (typeof uploadFile === 'function') {
            uploadFile(file);
        } else {
            console.error('Upload file function not found');
            // 使用i18n获取翻译文本
            const errorText = window.i18n ? window.i18n.t('error.send_image_failed') : '发送图片失败，请重试。';
            alert(errorText);
        }
    }

    // 初始化Magnific Popup图片预览 - 使用delegate选项处理动态元素
    $(document).ready(function() {
        // 初始化图片编辑器
        initImageEditor();
        
        // 修改图片点击事件，添加编辑选项
        $('#chat-container').on('click', '.image-popup', function(e) {
            e.preventDefault();
            
            // 显示确认框让用户选择是查看还是编辑
            const imageUrl = $(this).attr('href');
            
            // 使用i18n获取翻译文本
            const chooseActionText = window.i18n ? window.i18n.t('image_action.choose') : '选择操作';
            const viewText = window.i18n ? window.i18n.t('image_action.view') : '查看';
            const editText = window.i18n ? window.i18n.t('image_action.edit') : '编辑';
            const cancelText = window.i18n ? window.i18n.t('image_action.cancel') : '取消';
            
            // 创建自定义模态框让用户选择操作
            const confirmModal = `
            <div id="image-action-modal" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 1001; display: flex; justify-content: center; align-items: center;">
                <div class="glass-modal" style="background: rgba(255, 255, 255, 0.1); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); border-radius: 16px; padding: 30px; border: 1px solid rgba(255, 255, 255, 0.2); box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1); text-align: center; transition: all 0.3s ease;">
                    <h3 style="color: white; margin-bottom: 20px; font-size: 18px;">${chooseActionText}</h3>
                    <div style="display: flex; gap: 15px; justify-content: center;">
                        <button id="view-image-btn" style="background: linear-gradient(145deg, #3498db, #2980b9); color: white; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-weight: 500; transition: all 0.3s ease;">${viewText}</button>
                        <button id="edit-image-btn" style="background: linear-gradient(145deg, #f39c12, #e67e22); color: white; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-weight: 500; transition: all 0.3s ease;">${editText}</button>
                        <button id="cancel-image-btn" style="background: linear-gradient(145deg, #e74c3c, #c0392b); color: white; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-weight: 500; transition: all 0.3s ease;">${cancelText}</button>
                    </div>
                </div>
            </div>`;
            
            document.body.insertAdjacentHTML('beforeend', confirmModal);
            
            const actionModal = document.getElementById('image-action-modal');
            const modalContent = actionModal.querySelector('.glass-modal');
            
            // 添加按钮悬停效果
            const buttons = actionModal.querySelectorAll('button');
            buttons.forEach(button => {
                button.addEventListener('mouseenter', function() {
                    this.style.transform = 'translateY(-2px)';
                    this.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.2)';
                });
                button.addEventListener('mouseleave', function() {
                    this.style.transform = 'translateY(0)';
                    this.style.boxShadow = 'none';
                });
            });
            
            // 查看图片
            document.getElementById('view-image-btn').addEventListener('click', function() {
                actionModal.remove();
                // 使用简单的替代方案来预览图片
                previewImage(imageUrl);
            });
            
            // 编辑图片
            document.getElementById('edit-image-btn').addEventListener('click', function() {
                actionModal.remove();
                openImageEditor(imageUrl);
            });
            
            // 取消
            document.getElementById('cancel-image-btn').addEventListener('click', function() {
                actionModal.remove();
            });
            
            // 点击背景关闭弹窗
            actionModal.addEventListener('click', function(event) {
                if (event.target === actionModal) {
                    actionModal.remove();
                }
            });
        });
    });

    // 语音录制功能实现
    function initAudioRecording() {
        const recordButton = document.getElementById('record-audio-button');
        if (!recordButton) {
            console.warn('Record button not found');
            return;
        }

        // 检查是否支持MediaRecorder API
        const isRecordingSupported = !!navigator.mediaDevices && !!window.MediaRecorder;

        // 对于不支持录音的浏览器（如Safari），点击按钮直接显示上传选项
        if (!isRecordingSupported) {
            recordButton.addEventListener('click', showAudioUploadOption);
            recordButton.addEventListener('touchstart', (e) => {
                e.preventDefault();
                showAudioUploadOption();
            });
            return;
        }

        // 对于支持录音的浏览器，保留长按功能和点击功能
        // 添加点击事件（桌面端快速录音）
        recordButton.addEventListener('click', toggleRecording);
        
        // 添加长按录音功能（移动端体验优化）
        let longPressTimer = null;
        const LONG_PRESS_DELAY = 300; // 300ms长按触发

        // 鼠标事件（桌面端）
        recordButton.addEventListener('mousedown', () => {
            longPressTimer = setTimeout(() => {
                startRecording();
            }, LONG_PRESS_DELAY);
        });

        document.addEventListener('mouseup', () => {
            if (longPressTimer) {
                clearTimeout(longPressTimer);
                longPressTimer = null;
            }
            if (isRecording) {
                stopRecording();
            }
        });

        document.addEventListener('mouseleave', () => {
            if (longPressTimer) {
                clearTimeout(longPressTimer);
                longPressTimer = null;
            }
            if (isRecording) {
                stopRecording();
            }
        });

        // 触摸事件（移动端）
        recordButton.addEventListener('touchstart', (e) => {
            e.preventDefault(); // 防止触发鼠标事件
            longPressTimer = setTimeout(() => {
                startRecording();
            }, LONG_PRESS_DELAY);
        });

        document.addEventListener('touchend', () => {
            if (longPressTimer) {
                clearTimeout(longPressTimer);
                longPressTimer = null;
            }
            if (isRecording) {
                stopRecording();
            }
        });

        document.addEventListener('touchmove', (e) => {
            // 检测手指是否移出按钮区域，如果是，则停止录音
            if (isRecording && recordButton.getBoundingClientRect().contains(e.touches[0].clientX, e.touches[0].clientY)) {
                recordButton.style.backgroundColor = '#d32f2f';
            } else if (isRecording) {
                recordButton.style.backgroundColor = '#f44336';
            }
        });
    }

    // 显示音频上传选项
    function showAudioUploadOption() {
        // 先检查是否支持confirm对话框
        try {
            // 使用i18n获取翻译文本
            const browserNotSupportedText = window.i18n ? window.i18n.t('audio_upload.browser_not_supported') : '您的浏览器不支持直接录音，点击下方选择音频文件';
            // 使用简单的文本提示，避免复杂的confirm对话框
            updateStatus(browserNotSupportedText);
            
            // 为Safari优化：创建可见的文件输入按钮
            const fileUploadContainer = document.createElement('div');
            fileUploadContainer.id = 'audio-upload-container';
            fileUploadContainer.style.position = 'fixed';
            fileUploadContainer.style.bottom = '80px';
            fileUploadContainer.style.right = '20px';
            fileUploadContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
            fileUploadContainer.style.color = 'white';
            fileUploadContainer.style.padding = '10px 15px';
            fileUploadContainer.style.borderRadius = '20px';
            fileUploadContainer.style.zIndex = '999';
            fileUploadContainer.style.display = 'flex';
            fileUploadContainer.style.alignItems = 'center';
            fileUploadContainer.style.cursor = 'pointer';
            fileUploadContainer.style.minWidth = '150px';
            fileUploadContainer.style.justifyContent = 'center';
            
            // 创建文件输入元素
            const fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.accept = 'audio/*';
            fileInput.style.display = 'none';
            
            // 监听文件选择事件
            fileInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    // 直接使用现有的上传文件函数
                    uploadFile(file);
                }
                // 清理
                setTimeout(() => {
                    if (fileUploadContainer.parentNode) {
                        document.body.removeChild(fileUploadContainer);
                    }
                }, 0);
            });
            
            // 关闭按钮
            const closeBtn = document.createElement('span');
            closeBtn.innerHTML = '✕';
            closeBtn.style.marginLeft = '10px';
            closeBtn.style.fontSize = '18px';
            closeBtn.style.cursor = 'pointer';
            closeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (fileUploadContainer.parentNode) {
                    document.body.removeChild(fileUploadContainer);
                }
            });
            
            // 使用i18n翻译
            const selectAudioFileText = window.i18n ? window.i18n.t('audio_upload.select_file') : '选择音频文件';
            fileUploadContainer.appendChild(document.createTextNode(selectAudioFileText));
            fileUploadContainer.appendChild(closeBtn);
            fileUploadContainer.appendChild(fileInput);
            
            // 添加到文档
            document.body.appendChild(fileUploadContainer);
            
            // 点击容器触发文件选择
            fileUploadContainer.addEventListener('click', () => {
                try {
                    fileInput.click();
                } catch (error) {
                    console.error('Failed to trigger file selection:', error);
                    // 在Safari等特殊浏览器中，尝试直接使用document.execCommand
                    if (document.execCommand) {
                        document.execCommand('SaveAs', true);
                    }
                }
            });
            
        } catch (error) {
            console.error('Error showing audio upload option:', error);
            // 使用i18n获取翻译文本
            const errorText = window.i18n ? window.i18n.t('error.audio_upload_option_failed') : '无法显示上传选项，请手动选择文件上传。';
            alert(errorText);
        }
    }

    // 切换录音状态
    function toggleRecording() {
        if (isRecording) {
            stopRecording();
        } else {
            startRecording();
        }
    }

    // 开始录音
    function startRecording() {
        // 检查浏览器是否支持MediaRecorder API
        if (!navigator.mediaDevices || !window.MediaRecorder) {
            // 在不支持录音的浏览器中，提供上传音频文件的选项
            showAudioUploadOption();
            return;
        }
        
        navigator.mediaDevices.getUserMedia({ audio: true })
            .then(stream => {
                mediaRecorder = new MediaRecorder(stream);
                audioChunks = [];
                isRecording = true;
                recordingStartTime = new Date();

                // 更新按钮状态
                const recordButton = document.getElementById('record-audio-button');
                if (recordButton) {
                    recordButton.innerHTML = '<i class="fas fa-microphone-slash"></i>';
                    recordButton.style.backgroundColor = '#d32f2f';
                    recordButton.style.animation = 'pulse 1s infinite';
                }

                // 添加录音动画样式
                if (!document.getElementById('recording-animation-style')) {
                    const style = document.createElement('style');
                    style.id = 'recording-animation-style';
                    style.textContent = `
                        @keyframes pulse {
                            0% { transform: scale(1); }
                            50% { transform: scale(1.1); }
                            100% { transform: scale(1); }
                        }
                        .recording-indicator {
                            background-color: #d32f2f;
                            animation: pulse 1s infinite;
                            border-radius: 50%;
                            width: 12px;
                            height: 12px;
                            display: inline-block;
                            margin-right: 8px;
                        }
                    `;
                    document.head.appendChild(style);
                }

                // 显示录音状态，使用i18n获取翻译文本
                const recordingText = window.i18n ? window.i18n.t('recording.in_progress') : '正在录音... 点击或松开结束';
                updateStatus(recordingText);

                // 启动录音计时器
                startRecordingTimer();

                // 处理音频数据
                mediaRecorder.ondataavailable = event => {
                    if (event.data.size > 0) {
                        audioChunks.push(event.data);
                    }
                };

                // 录音结束时的处理
                mediaRecorder.onstop = () => {
                    // 停止所有音频轨道
                    stream.getTracks().forEach(track => track.stop());
                };

                // 开始录音
                mediaRecorder.start(100); // 每100ms收集一次数据
            })
            .catch(error => {
                console.error('获取麦克风权限失败:', error);
                // 使用i18n获取翻译文本
                const permissionErrorText = window.i18n ? window.i18n.t('recording.microphone_permission_failed') : '获取麦克风权限失败，请检查浏览器设置';
                updateStatus(permissionErrorText, {}, true);
            });
    }

    // 开始录音计时器
    function startRecordingTimer() {
        const startTime = new Date();
        
        // 创建计时器元素
        let timerElement = document.getElementById('recording-timer');
        if (!timerElement) {
            timerElement = document.createElement('div');
            timerElement.id = 'recording-timer';
            timerElement.style.position = 'fixed';
            timerElement.style.bottom = '80px';
            timerElement.style.right = '20px';
            timerElement.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
            timerElement.style.color = 'white';
            timerElement.style.padding = '8px 12px';
            timerElement.style.borderRadius = '20px';
            timerElement.style.zIndex = '1000';
            timerElement.style.display = 'flex';
            timerElement.style.alignItems = 'center';
            document.body.appendChild(timerElement);
        }

        // 更新计时器显示
        function updateTimer() {
            const currentTime = new Date();
            const duration = Math.floor((currentTime - startTime) / 1000);
            const minutes = Math.floor(duration / 60).toString().padStart(2, '0');
            const seconds = (duration % 60).toString().padStart(2, '0');
            
            timerElement.innerHTML = `
                <div class="recording-indicator"></div>
                ${minutes}:${seconds}
            `;
            
            recordingTimer = requestAnimationFrame(updateTimer);
        }

        updateTimer();
    }

    // 停止录音
    function stopRecording() {
        if (!mediaRecorder || !isRecording) return;

        // 停止录音
        mediaRecorder.stop();
        isRecording = false;

        // 清除计时器
        if (recordingTimer) {
            cancelAnimationFrame(recordingTimer);
            recordingTimer = null;
        }

        // 移除计时器元素
        const timerElement = document.getElementById('recording-timer');
        if (timerElement) {
            document.body.removeChild(timerElement);
        }

        // 恢复按钮状态
        const recordButton = document.getElementById('record-audio-button');
        if (recordButton) {
            recordButton.innerHTML = '<i class="fas fa-microphone"></i>';
            recordButton.style.backgroundColor = '';
            recordButton.style.animation = '';
        }

        // 计算录音时长
        const recordingDuration = Math.floor((new Date() - recordingStartTime) / 1000);
        
        // 如果录音时长太短，提示用户
        if (recordingDuration < 1) {
            // 使用i18n获取翻译文本
            const tooShortText = window.i18n ? window.i18n.t('recording.too_short') : '录音时长太短，请重试';
            updateStatus(tooShortText, {}, true);
            return;
        }

        // 创建音频文件
        const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
        const fileName = `recording-${Date.now()}.wav`;
        
        // 上传音频文件
        uploadAudioFile(audioBlob, fileName, recordingDuration);
    }

    // 上传音频文件
    function uploadAudioFile(audioBlob, fileName, duration) {
        const formData = new FormData();
        formData.append('file', audioBlob, fileName);
        formData.append('duration', duration);

        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/upload-file'); // 使用现有的通用文件上传接口
        xhr.setRequestHeader('Accept', 'application/json');

        // 上传进度处理
        xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable) {
                const percent = Math.round((e.loaded / e.total) * 100);
                // 使用i18n获取翻译文本
                const progressText = window.i18n ? window.i18n.t('audio_upload.progress', { percent }) : `正在上传语音消息: ${percent}%`;
                updateStatus(progressText);
            }
        });

        // 上传完成处理
        xhr.addEventListener('load', () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                try {
                    const response = JSON.parse(xhr.responseText);
                    if (response.fileUrl) {
                        const messageInput = document.getElementById('message-input');
                        // 插入音频链接到输入框
                        messageInput.value += `[${fileName}](${response.fileUrl})`;
                        
                        // 自动发送录音消息
                        window.sendMessage();
                        
                        // 使用i18n获取翻译文本
                        const sentText = window.i18n ? window.i18n.t('audio_upload.sent', { duration }) : `语音消息已发送 (${duration}秒)`;
                        updateStatus(sentText);
                    } else {
                        // 使用i18n获取翻译文本
                        const noUrlText = window.i18n ? window.i18n.t('upload.no_file_url') : '上传失败: 服务器未返回文件URL';
                        updateStatus(noUrlText, {}, true);
                    }
                } catch (error) {
                    // 使用i18n获取翻译文本
                    const formatErrorText = window.i18n ? window.i18n.t('upload.server_response_format_error') : '上传失败: 服务器响应格式错误';
                    updateStatus(formatErrorText, {}, true);
                    console.error('解析服务器响应失败:', error);
                }
            } else {
                // 使用i18n获取翻译文本
                const uploadErrorText = window.i18n ? window.i18n.t('upload.failed', { statusText: xhr.statusText }) : `上传失败: ${xhr.statusText}`;
                updateStatus(uploadErrorText, {}, true);
            }
        });

        // 错误处理
        xhr.addEventListener('error', () => {
            // 使用i18n获取翻译文本
            const networkErrorText = window.i18n ? window.i18n.t('upload.network_error') : '网络错误，上传失败';
            updateStatus(networkErrorText, {}, true);
        });

        // 发送请求
        xhr.send(formData);
    }
});

// 移动端+按钮功能实现
function initMobileActions() {
    try {
        // 检查是否已添加+按钮，避免重复添加
        if (document.querySelector('.more-actions-btn')) {
            console.log('More actions button already exists');
            return;
        }
        
        const inputControls = document.querySelector('.input-controls');
        if (!inputControls) {
            console.log('Input controls not found, skipping mobile actions initialization');
            // 如果找不到input-controls，尝试直接在body中添加按钮
            createFallbackMobileButton();
            return;
        }
        
        // 创建+按钮
        const moreBtn = document.createElement('button');
        moreBtn.className = 'more-actions-btn chat-action-btn';
        moreBtn.innerHTML = '<i class="fas fa-plus"></i>';
        moreBtn.title = window.i18n ? window.i18n.t('chat.more_actions') : '更多选项';
        // 确保在移动设备上按钮总是显示
        moreBtn.style.display = 'flex';
        moreBtn.style.zIndex = '1000';
        
        // 创建更多操作菜单
        const moreMenu = document.createElement('div');
        moreMenu.className = 'more-actions-menu';
        
        // 查找现有按钮并复制到菜单中
        const actionBtns = inputControls.querySelectorAll('.chat-action-btn:not(#send-button)');
        
        // 复制现有按钮到菜单中
            actionBtns.forEach(btn => {
                // 不使用cloneNode，而是创建新的按钮元素
                const menuBtn = document.createElement('button');
                menuBtn.className = 'chat-action-btn';
                menuBtn.id = 'menu-' + btn.id;
                
                // Get internationalized text
                let buttonText = '';
                if (window.i18n && typeof window.i18n.t === 'function') {
                    const translations = {
                        'sticker-button': window.i18n.t('chat.sticker') || '',
                        'upload-image-button': window.i18n.t('chat.upload') || '',
                        'record-audio-button': window.i18n.t('chat.record_audio') || ''
                    };
                    buttonText = translations[btn.id] || btn.innerHTML;
                }
                
                // 设置按钮内容，包括图标和文本
                menuBtn.innerHTML = btn.innerHTML + ' ' + buttonText;
                menuBtn.title = btn.title;
                menuBtn.style.display = 'flex';
                menuBtn.style.width = '100%';
                menuBtn.style.justifyContent = 'flex-start';
                menuBtn.style.alignItems = 'center';
                menuBtn.style.padding = '0.75rem 1rem';
                menuBtn.style.gap = '0.75rem';
            
            // 根据按钮ID绑定相应的功能
            if (btn.id === 'sticker-button') {
                menuBtn.addEventListener('click', function(e) {
                    e.stopPropagation();
                    // 直接触发原始按钮的点击事件
                    const originalBtn = document.getElementById('sticker-button');
                    if (originalBtn) {
                        const event = new MouseEvent('click', {
                            bubbles: true,
                            cancelable: true,
                            view: window
                        });
                        originalBtn.dispatchEvent(event);
                    }
                    moreMenu.classList.remove('show');
                });
            } else if (btn.id === 'upload-image-button') {
                menuBtn.addEventListener('click', function(e) {
                    e.stopPropagation();
                    // 直接触发原始按钮的点击事件
                    const originalBtn = document.getElementById('upload-image-button');
                    if (originalBtn) {
                        const event = new MouseEvent('click', {
                            bubbles: true,
                            cancelable: true,
                            view: window
                        });
                        originalBtn.dispatchEvent(event);
                    }
                    moreMenu.classList.remove('show');
                });
            } else if (btn.id === 'record-audio-button') {
                menuBtn.addEventListener('click', function(e) {
                    e.stopPropagation();
                    // 直接触发原始按钮的点击事件
                    const originalBtn = document.getElementById('record-audio-button');
                    if (originalBtn) {
                        const event = new MouseEvent('click', {
                            bubbles: true,
                            cancelable: true,
                            view: window
                        });
                        originalBtn.dispatchEvent(event);
                    }
                    moreMenu.classList.remove('show');
                });
            } else {
                // 为其他按钮添加点击事件
                menuBtn.addEventListener('click', function(e) {
                    e.stopPropagation();
                    // 点击后关闭菜单
                    moreMenu.classList.remove('show');
                });
            }
            
            moreMenu.appendChild(menuBtn);
        });
        
        // 添加菜单到输入控制区域
        inputControls.appendChild(moreMenu);
        
        // 添加+按钮到输入控制区域，但确保它在发送按钮之前
        const sendButton = document.getElementById('send-button');
        if (sendButton && sendButton.parentNode === inputControls) {
            inputControls.insertBefore(moreBtn, sendButton);
        } else {
            inputControls.appendChild(moreBtn);
        }
        
        // 点击+按钮显示/隐藏菜单
        moreBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            moreMenu.classList.toggle('show');
        });
        
        // 点击页面其他地方关闭菜单
        document.addEventListener('click', function(e) {
            if (!moreBtn.contains(e.target) && !moreMenu.contains(e.target)) {
                moreMenu.classList.remove('show');
            }
        });
        
        console.log('Mobile actions initialized successfully');
    } catch (error) {
        console.error('Error initializing mobile actions:', error);
        // 出错时创建备用按钮
        createFallbackMobileButton();
    }
}

// 创建备用移动端按钮
function createFallbackMobileButton() {
    try {
        const existingFallback = document.getElementById('fallback-mobile-button');
        if (existingFallback) return;
        
        const fallbackBtn = document.createElement('button');
        fallbackBtn.id = 'fallback-mobile-button';
        fallbackBtn.className = 'more-actions-btn chat-action-btn';
        fallbackBtn.innerHTML = '<i class="fas fa-plus"></i>';
        fallbackBtn.title = window.i18n ? window.i18n.t('chat.more_actions') : '更多选项';
        
        // 设置样式确保按钮显示在右下角
        fallbackBtn.style.position = 'fixed';
        fallbackBtn.style.bottom = '20px';
        fallbackBtn.style.right = '20px';
        fallbackBtn.style.width = '50px';
        fallbackBtn.style.height = '50px';
        fallbackBtn.style.borderRadius = '50%';
        fallbackBtn.style.backgroundColor = '#4F46E5';
        fallbackBtn.style.color = 'white';
        fallbackBtn.style.border = 'none';
        fallbackBtn.style.boxShadow = '0 4px 12px rgba(79, 70, 229, 0.4)';
        fallbackBtn.style.display = 'flex';
        fallbackBtn.style.alignItems = 'center';
        fallbackBtn.style.justifyContent = 'center';
        fallbackBtn.style.zIndex = '9999';
        fallbackBtn.style.fontSize = '20px';
        
        document.body.appendChild(fallbackBtn);
        
        // 创建一个简单的菜单
        const fallbackMenu = document.createElement('div');
        fallbackMenu.id = 'fallback-mobile-menu';
        fallbackMenu.style.position = 'fixed';
        fallbackMenu.style.bottom = '80px';
        fallbackMenu.style.right = '20px';
        fallbackMenu.style.backgroundColor = 'rgba(30, 41, 59, 0.95)';
        fallbackMenu.style.backdropFilter = 'blur(24px)';
        fallbackMenu.style.borderRadius = '8px';
        fallbackMenu.style.padding = '10px';
        fallbackMenu.style.boxShadow = '0 8px 32px rgba(0, 0, 0, 0.3)';
        fallbackMenu.style.border = '1px solid rgba(255, 255, 255, 0.1)';
        fallbackMenu.style.display = 'none';
        fallbackMenu.style.flexDirection = 'column';
        fallbackMenu.style.gap = '8px';
        fallbackMenu.style.zIndex = '9998';
        
        document.body.appendChild(fallbackMenu);
        
        // 点击按钮显示/隐藏菜单
        fallbackBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            fallbackMenu.style.display = fallbackMenu.style.display === 'flex' ? 'none' : 'flex';
        });
        
        // 添加基本功能按钮
        // 贴纸按钮
        addFallbackMenuItem(fallbackMenu, 'sticker-button', '<i class="far fa-smile"></i> 贴图', function() {
            const stickerButton = document.getElementById('sticker-button');
            if (stickerButton) {
                // 使用dispatchEvent而不是直接click()，确保事件正确传播
                const event = new MouseEvent('click', {
                    bubbles: true,
                    cancelable: true,
                    view: window
                });
                stickerButton.dispatchEvent(event);
            }
            fallbackMenu.style.display = 'none';
        });
        
        // 上传按钮
        addFallbackMenuItem(fallbackMenu, 'upload-image-button', '<i class="fas fa-paperclip"></i> 上传', function() {
            const uploadButton = document.getElementById('upload-image-button');
            if (uploadButton) {
                // 使用dispatchEvent而不是直接click()，确保事件正确传播
                const event = new MouseEvent('click', {
                    bubbles: true,
                    cancelable: true,
                    view: window
                });
                uploadButton.dispatchEvent(event);
            }
            fallbackMenu.style.display = 'none';
        });
        
        // 语音录制按钮
        addFallbackMenuItem(fallbackMenu, 'record-audio-button', '<i class="fas fa-microphone"></i> 语音', function() {
            const recordButton = document.getElementById('record-audio-button');
            if (recordButton) {
                // 使用dispatchEvent而不是直接click()，确保事件正确传播
                const event = new MouseEvent('click', {
                    bubbles: true,
                    cancelable: true,
                    view: window
                });
                recordButton.dispatchEvent(event);
            }
            fallbackMenu.style.display = 'none';
        });
        
        // 点击页面其他地方关闭菜单
        document.addEventListener('click', function(e) {
            if (!fallbackBtn.contains(e.target) && !fallbackMenu.contains(e.target)) {
                fallbackMenu.style.display = 'none';
            }
        });
        
    } catch (error) {
        console.error('Error creating fallback mobile button:', error);
    }
}

// 添加备用菜单项
function addFallbackMenuItem(menu, id, html, onClick) {
    const item = document.createElement('button');
    item.id = 'fallback-' + id;
    item.innerHTML = html;
    item.style.width = '100%';
    item.style.padding = '12px 16px';
    item.style.backgroundColor = 'transparent';
    item.style.color = 'white';
    item.style.border = 'none';
    item.style.borderRadius = '4px';
    item.style.textAlign = 'left';
    item.style.cursor = 'pointer';
    item.style.transition = 'background-color 0.2s';
    
    item.addEventListener('mouseenter', function() {
        this.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
    });
    
    item.addEventListener('mouseleave', function() {
        this.style.backgroundColor = 'transparent';
    });
    
    item.addEventListener('click', onClick);
    
    menu.appendChild(item);
}

// 等待i18n初始化完成后再初始化其他功能
function initializeApp() {
    // 初始化Socket连接
    initSocket();
    
    // 设置移动设备的操作界面
    setupMobileActionsWithDelay();
}

// 确保DOM加载完成后初始化，同时添加延迟以防初始化顺序问题
function setupMobileActionsWithDelay() {
    // 检查是否为移动设备
    function isMobile() {
        return window.innerWidth <= 768;
    }
    
    // 只在移动设备上初始化
    if (isMobile()) {
        // 立即尝试初始化
        initMobileActions();
        
        // 1秒后再次尝试，确保DOM完全加载
        setTimeout(initMobileActions, 1000);
    }
    
    // 添加窗口大小变化监听器，在切换到移动端视图时初始化
    window.addEventListener('resize', function() {
        if (isMobile()) {
            initMobileActions();
        }
    });
}

// 监听i18n初始化完成事件，确保国际化完成后再初始化应用
function initializeAppWhenReady() {
    if (window.i18n && window.i18n.translations && Object.keys(window.i18n.translations).length > 0) {
        // 如果i18n已经初始化完成，直接初始化应用
        initializeApp();
    } else {
        // 否则等待i18n初始化完成
        document.addEventListener('i18nInitialized', function() {
            initializeApp();
        });
        
        // 添加超时处理，以防i18n初始化事件永远不触发
        setTimeout(function() {
            if (!window.i18n || !window.i18n.translations || Object.keys(window.i18n.translations).length === 0) {
                console.warn('i18n initialization timed out, proceeding with default texts');
                initializeApp();
            }
        }, 5000); // 5秒超时
    }
}

// 确保DOM加载完成后再开始等待i18n初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeAppWhenReady);
} else {
    // DOM已加载完成
    initializeAppWhenReady();
}