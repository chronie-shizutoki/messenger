require('dotenv').config();
const express = require('express');

const app = express();
const http = require('http');
const { Server } = require('socket.io');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const cors = require('cors');
const compression = require('compression');

app.use(cors({ origin: '*' }));
// 添加压缩中间件
app.use(compression());

const PORT = process.env.PORT || 3000;
const sharp = require('sharp');
const CHAT_IMAGE_DIRECTORY = path.join(__dirname, 'public', 'chat-images');

// 确保聊天图片目录存在
if (!fs.existsSync(CHAT_IMAGE_DIRECTORY)) {
  fs.mkdirSync(CHAT_IMAGE_DIRECTORY, { recursive: true });
}

// 引入multer处理文件上传
const multer = require('multer');

// 配置文件过滤
// 配置文件过滤，允许所有文件类型
const fileFilter = (req, file, cb) => {
  // 允许所有文件类型
  cb(null, true);
};

// 根据文件类型获取对应的图标
const getFileTypeIcon = (fileExtension) => {
  const ext = fileExtension.toLowerCase();
  // 简化图标映射，对未知类型也提供有意义的图标
  const iconMap = {
    '.jpg': 'fa-file-image-o',
    '.jpeg': 'fa-file-image-o',
    '.png': 'fa-file-image-o',
    '.gif': 'fa-file-image-o',
    '.svg': 'fa-file-image-o',
    '.pdf': 'fa-file-pdf-o',
    '.doc': 'fa-file-word-o',
    '.docx': 'fa-file-word-o',
    '.xls': 'fa-file-excel-o',
    '.xlsx': 'fa-file-excel-o',
    '.ppt': 'fa-file-powerpoint-o',
    '.pptx': 'fa-file-powerpoint-o',
    '.txt': 'fa-file-text-o',
    '.zip': 'fa-file-archive-o',
    '.rar': 'fa-file-archive-o',
    '.7z': 'fa-file-archive-o',
    '.js': 'fa-file-code-o',
    '.ts': 'fa-file-code-o',
    '.css': 'fa-file-code-o',
    '.html': 'fa-file-code-o',
    '.php': 'fa-file-code-o',
    '.py': 'fa-file-code-o'
  };
  return iconMap[ext] || 'fa-file-o';
};

// 保留原有函数，仅修改注释以反映新的文件类型政策
// 注意：虽然我们移除了上传限制，但仍保留图标映射以提供更好的用户体验

// 通用文件存储目录
const COMMON_FILE_DIRECTORY = path.join(__dirname, 'public', 'uploads');

// 确保通用文件目录存在
if (!fs.existsSync(COMMON_FILE_DIRECTORY)) {
  fs.mkdirSync(COMMON_FILE_DIRECTORY, { recursive: true });
}

// 初始化multer上传中间件
// 聊天图片上传配置
const chatUpload = multer({
  storage: multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, CHAT_IMAGE_DIRECTORY);
    },
    filename: function (req, file, cb) {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      const ext = path.extname(file.originalname);
      // 确保文件名正确处理UTF-8编码
      const baseName = path.basename(file.originalname, ext);
      // 对文件名进行编码处理，确保中文字符正确显示
      const safeBaseName = encodeURIComponent(baseName).replace(/%20/g, '-');
      const filename = safeBaseName + '-' + uniqueSuffix + ext;
      cb(null, filename);
    }
  }),
  // 移除文件类型限制
  // fileFilter: fileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024, // 限制100MB
  }
});

// 通用文件上传配置
const commonUpload = multer({
  storage: multer.diskStorage({
    destination: function (req, file, cb) {
      // 根据文件类型创建子目录
      const ext = path.extname(file.originalname).toLowerCase();
      let subDir = 'others';
      
      if (['.jpg', '.jpeg', '.png', '.gif', '.svg'].includes(ext)) {
        subDir = 'images';
      } else if (['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt'].includes(ext)) {
        subDir = 'documents';
      } else if (['.zip', '.rar', '.7z'].includes(ext)) {
        subDir = 'archives';
      } else if (['.js', '.ts', '.css', '.html', '.php', '.py'].includes(ext)) {
        subDir = 'code';
      }
      
      const uploadDir = path.join(COMMON_FILE_DIRECTORY, subDir);
      // 确保子目录存在
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      
      cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      const ext = path.extname(file.originalname);
      // 确保文件名正确处理UTF-8编码
      const baseName = path.basename(file.originalname, ext);
      // 对文件名进行编码处理，确保中文字符正确显示
      const safeBaseName = encodeURIComponent(baseName).replace(/%20/g, '-');
      const filename = safeBaseName + '-' + uniqueSuffix + ext;
      cb(null, filename);
    }
  }),
  // 移除文件类型限制
  // fileFilter: fileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024, // 限制100MB
  }
});

// 确定静态文件目录，默认为public，可通过环境变量STATIC_DIR覆盖
const STATIC_DIR = process.env.STATIC_DIR || 'public';
const STATIC_PATH = path.join(__dirname, STATIC_DIR);

// 提供静态文件访问
app.use(express.static(STATIC_PATH));

// 根路由返回HTML页面
app.get('/', (req, res) => {
  res.sendFile(path.join(STATIC_PATH, 'index.html'));
});

// 获取聊天图片
app.get('/get-chat-image/:filename', (req, res) => {
  const imagePath = path.join(CHAT_IMAGE_DIRECTORY, req.params.filename);
  if (fs.existsSync(imagePath)) {
    res.sendFile(imagePath);
  } else {
    res.status(404).json({ error: '聊天图片不存在' });
  }
})

// 聊天图片上传接口
app.post('/chat/upload-image', chatUpload.single('image'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: '未选择图片文件' });
  }

  try {
    // 创建聊天缩略图目录
    const chatThumbDir = path.join(__dirname, 'public', 'chat-thumbnails'); // 缩略图目录始终在public下，不随STATIC_DIR改变
    if (!fs.existsSync(chatThumbDir)) {
      fs.mkdirSync(chatThumbDir, { recursive: true });
    }

    // 生成聊天图片缩略图
    const thumbnailPath = path.join(chatThumbDir, req.file.filename);
    await sharp(req.file.path)
      .resize(200, 200, { fit: 'inside', withoutEnlargement: true })
      .toFile(thumbnailPath);
  } catch (error) {
    console.error('创建聊天缩略图错误:', error);
  }

  res.json({ imageUrl: `/get-chat-image/${req.file.filename}` });
});

// 通用文件上传接口
app.post('/upload-file', commonUpload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: '未选择文件' });
  }

  // 获取文件相对路径，并确保使用正斜杠作为分隔符
  const relativePath = path.relative(COMMON_FILE_DIRECTORY, req.file.path).replace(/\\/g, '/');
  // 对路径进行编码处理，确保中文字符正确显示
  const encodedRelativePath = encodeURIComponent(relativePath).replace(/%2F/g, '/');
  const fileUrl = `/uploads/${encodedRelativePath}`;
  const fileExtension = path.extname(req.file.originalname).toLowerCase();
  const fileTypeIcon = getFileTypeIcon(fileExtension);

  res.json({
    fileUrl: fileUrl,
    fileName: req.file.originalname,
    fileSize: req.file.size,
    fileType: fileExtension,
    fileIcon: fileTypeIcon
  });
});

// 获取通用上传文件
app.get('/uploads/:subdir/:filename', (req, res) => {
  // 对参数进行解码，确保中文文件名正确
  const subdir = decodeURIComponent(req.params.subdir);
  const filename = decodeURIComponent(req.params.filename);
  const filePath = path.join(COMMON_FILE_DIRECTORY, subdir, filename);

  if (fs.existsSync(filePath)) {
    // 设置适当的Content-Type
    const ext = path.extname(filename).toLowerCase();
    let contentType = 'application/octet-stream';
    
    if (ext === '.pdf') contentType = 'application/pdf';
    else if (['.jpg', '.jpeg'].includes(ext)) contentType = 'image/jpeg';
    else if (ext === '.png') contentType = 'image/png';
    else if (ext === '.gif') contentType = 'image/gif';
    else if (ext === '.svg') contentType = 'image/svg+xml';
    else if (['.js', '.ts', '.css', '.html', '.php', '.py', '.txt'].includes(ext)) contentType = 'text/plain';
    
    // 设置Content-Disposition头，支持中文文件名下载
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
    res.sendFile(filePath);
  } else {
    res.status(404).json({ error: '文件不存在' });
  }
});

// 处理其他可能的文件路径结构
app.get('/uploads/*', (req, res) => {
  // 对路径进行解码，确保中文文件名正确
  const decodedPath = decodeURIComponent(req.params[0]);
  const filePath = path.join(COMMON_FILE_DIRECTORY, decodedPath);
  
  if (fs.existsSync(filePath)) {
    // 设置Content-Disposition头，支持中文文件名下载
    const filename = path.basename(filePath);
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
    res.sendFile(filePath);
  } else {
    res.status(404).json({ error: '文件不存在' });
  }
});


// 启动服务器，允许局域网访问
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type"]
  }
});

// 连接聊天数据库
const db = new sqlite3.Database('chat.db', (err) => {
  if (err) {
    console.error(err.message);
  }
  console.log('Connected to the chat database.');
});

// 初始化消息表
db.run(`CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  content TEXT,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
)`);

// 初始化推送订阅表
db.run(`CREATE TABLE IF NOT EXISTS push_subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  push_url TEXT NOT NULL UNIQUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)`);

// 获取所有推送链接
db.all('SELECT push_url FROM push_subscriptions', (err, urls) => {
  global.pushUrls = err ? [] : urls.map(row => row.push_url);
});

// 获取所有贴图列表
app.get('/get-stickers', async (req, res) => {
  try {
    const stickerRoot = path.join(__dirname, 'public', 'sticker');
    const categories = [];
    
    // 读取主分类目录
    const mainCategories = await fs.promises.readdir(stickerRoot, { withFileTypes: true });
    
    for (const mainCat of mainCategories) {
      if (mainCat.isDirectory()) {
        const mainCatPath = path.join(stickerRoot, mainCat.name);
        // 读取主分类目录下的所有项目（文件和子目录）
        const mainCatItems = await fs.promises.readdir(mainCatPath, { withFileTypes: true });
        
        const subCatList = [];
        // 处理主分类目录下的直接文件
        const directFiles = [];
        for (const item of mainCatItems) {
          if (item.isFile()) {
            directFiles.push(item.name);
          } else if (item.isDirectory()) {
            // 处理子分类目录
            const subCatPath = path.join(mainCatPath, item.name);
            const stickerFiles = await fs.promises.readdir(subCatPath);
            
            // 过滤图片文件
            const stickers = stickerFiles.filter(file => {
              const ext = path.extname(file).toLowerCase();
              return ['.png', '.jpg', '.jpeg', '.gif', '.svg'].includes(ext);
            });
            
            subCatList.push({
              name: item.name,
              stickers: stickers.map(file => ({
                filename: file,
                url: `/sticker/${mainCat.name}/${item.name}/${file}`
              }))
            });
          }
        }
        
        // 处理主分类目录下的直接图片文件
        if (directFiles.length > 0) {
          // 过滤图片文件
          const stickers = directFiles.filter(file => {
            const ext = path.extname(file).toLowerCase();
            return ['.png', '.jpg', '.jpeg', '.gif', '.svg'].includes(ext);
          });
          
          subCatList.push({
            name: '直接文件',
            stickers: stickers.map(file => ({
              filename: file,
              url: `/sticker/${mainCat.name}/${file}`
            }))
          });
        }
        
        // 展平子分类，将所有子分类的贴图合并到主分类下
const allStickers = subCatList.flatMap(subCat => 
  subCat.stickers.map(sticker => ({
    ...sticker,
    category: subCat.name
  }))
);

categories.push({
  name: mainCat.name,
  stickers: allStickers
});
      }
    }
    
    res.json(categories);
  } catch (err) {
    console.error('获取贴图列表错误:', err);
    res.status(500).send('获取贴图列表失败');
  }
});

// 处理Socket连接
io.on('connection', (socket) => {
  console.log('emit connection:', socket.id);

  // 测试连接
  socket.emit('connection test', 'connect success');
  socket.on('client test', (data) => {
    console.log('emit client test message:', data);
    socket.emit('server response', 'server response: ' + data);
  });

  // 保存消息到数据库
  function saveMessage(content, callback) {
    const timestamp = new Date().toISOString();
    const insertQuery = 'INSERT INTO messages (content, timestamp) VALUES (?, ?)';
    db.run(insertQuery, [content, timestamp], function(err) {
      if (err) return callback(err);
      callback(null, {
        id: this.lastID,
        content: content,
        timestamp: timestamp
      });
    });
  }

  // 保存推送链接
socket.on('save push url', (url, callback) => {
  if (!url || !url.startsWith('http')) {
    return callback('not input push url');
  }
  
  // 检查链接是否已存在
  db.get('SELECT id FROM push_subscriptions WHERE push_url = ?', [url], (err, row) => {
    if (err) return callback('check push url error');
    
    if (row) {
      // 链接已存在
      callback(null, 'push url already exist');
    } else {
      // 插入新链接
      db.run('INSERT INTO push_subscriptions (push_url) VALUES (?)', [url], (err) => {
        if (err) return callback('save push url error');
        // 更新全局推送链接列表
        global.pushUrls.push(url);
        callback(null, 'push url saved');
      });
    }
  });
});

// 删除推送链接
socket.on('remove push url', (url, callback) => {
  db.run('DELETE FROM push_subscriptions WHERE push_url = ?', [url], (err) => {
    if (err) return callback('remove push url error');
    // 更新全局推送链接列表
    global.pushUrls = global.pushUrls.filter(u => u !== url);
    callback(null, 'push url removed');
  });
});

// 获取所有推送链接
socket.on('get push urls', (callback) => {
  callback(null, global.pushUrls);
});

// 接收并广播消息
socket.on('chat message', (msg, callback) => {
    console.log('emit chat message:', msg);
    const filteredContent = (msg.content);
    saveMessage(filteredContent, (err, savedMsg) => {
      if (err) {
        console.error('emit chat message error:', err);
        return callback(err);
      }
      io.emit('chat message', savedMsg);

// 发送推送通知给所有订阅者 (区分ntfy和普通URL)
global.pushUrls.forEach(pushUrl => {
  try {
    // 检测是否为ntfy链接 (包含ntfy.sh域名)
    if (pushUrl.includes('ntfy.sh')) {
      // ntfy格式: 使用POST请求
      fetch(pushUrl, {
        method: 'POST',
        body: savedMsg.content,
        headers: {
          'Content-Type': 'text/plain'
        }
      }).catch(err => console.error('ntfy推送错误:', err));
    } else if (pushUrl.includes('notifyme-server.521933.xyz')) {
      // NotifyMe格式: 使用GET请求并添加参数
      const urlObj = new URL(pushUrl);
      // 保留URL中已有的参数（如uuid）并添加必要参数
      // 仅在参数不存在时设置默认值，保留URL中已有的参数
      if (!urlObj.searchParams.has('title')) {
        urlObj.searchParams.set('title', 'Image Viewer Notification');
      }
      urlObj.searchParams.set('body', savedMsg.content);
      if (!urlObj.searchParams.has('bigText')) {
        urlObj.searchParams.set('bigText', 'false');
      }
      // 可选：仅在没有group参数时设置默认值
      if (!urlObj.searchParams.has('group')) {
        urlObj.searchParams.set('group', 'messenger');
      }
      
      // 检查是否包含必要的uuid参数
      if (!urlObj.searchParams.has('uuid')) {
        console.error('NotifyMe推送失败: URL中缺少必要的uuid参数');
        return;
      }
      
      // 输出完整URL用于调试
      console.log('NotifyMe推送URL:', urlObj.toString());
      
      // 发送请求并处理响应
      // 发送请求并处理响应
      console.log('发送NotifyMe推送请求:', urlObj.toString());
      fetch(urlObj.toString())
        .then(response => {
          console.log('NotifyMe推送响应状态:', response.status);
          if (!response.ok) {
            return response.text().then(text => {
              throw new Error(`HTTP错误: ${response.status}, 响应内容: ${text}`);
            });
          }
          // 尝试解析JSON，如果失败则返回文本
          return response.json().catch(() => response.text());
        })
        .then(data => {
          console.log('NotifyMe推送响应内容:', data);
          // 检查响应是否表示成功
          if (typeof data === 'object' && !data.isSuccess) {
            console.error('NotifyMe推送失败:', data);
          } else if (typeof data === 'string' && data.includes('error')) {
            console.error('NotifyMe推送失败:', data);
          }
        })
        .catch(err => console.error('NotifyMe推送错误:', err));
    } else {
      // 普通URL格式: 使用原有GET请求方式
      const encodedContent = encodeURIComponent(savedMsg.content);
      const fullUrl = pushUrl.endsWith('/') ? `${pushUrl}${encodedContent}` : `${pushUrl}/${encodedContent}`;
      fetch(fullUrl).catch(err => console.error('普通推送错误:', err));
    }
  } catch (e) {
    console.error('推送处理异常:', e);
  }
});

callback(null);
    });
  });

  // 获取历史消息 - 支持分页
  socket.on('get history', (params, callback) => {
    // 如果没有传递参数，使用默认值
    if (typeof params === 'function') {
      callback = params;
      params = {};
    }
    
    const page = params.page || 1;
    const limit = params.limit || 20; // 每页20条消息
    const offset = (page - 1) * limit;
    
    // 获取总消息数
    db.get('SELECT COUNT(*) as total FROM messages', (err, countResult) => {
      if (err) return callback(err);
      
      const totalMessages = countResult.total;
      const totalPages = Math.ceil(totalMessages / limit);
      
      // 获取分页消息
      db.all(
        'SELECT * FROM messages ORDER BY timestamp DESC LIMIT ? OFFSET ?', 
        [limit, offset], 
        (err, rows) => {
          if (err) return callback(err);
          callback(null, {
            messages: rows.reverse(), // 保持时间顺序
            pagination: {
              currentPage: page,
              totalPages: totalPages,
              totalMessages: totalMessages,
              hasMore: page < totalPages
            }
          });
        }
      );
    });
  });

  socket.on('disconnect', () => {
    console.log('emit disconnect:', socket.id);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});