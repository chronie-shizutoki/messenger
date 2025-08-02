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

const PORT = process.env.PORT || 3001;
const sharp = require('sharp');
const CHAT_IMAGE_DIRECTORY = path.join(__dirname, 'public', 'chat-images');

// 确保聊天图片目录存在
if (!fs.existsSync(CHAT_IMAGE_DIRECTORY)) {
  fs.mkdirSync(CHAT_IMAGE_DIRECTORY, { recursive: true });
}

// 引入multer处理文件上传
const multer = require('multer');

// 配置文件过滤
const fileFilter = (req, file, cb) => {
  const allowedTypes = ['.jpg', '.jpeg', '.png', '.gif', '.svg'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowedTypes.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('only allow upload image file: ' + allowedTypes.join(', ')), false);
  }
};

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
      const filename = path.basename(file.originalname, ext) + '-' + uniqueSuffix + ext;
      cb(null, filename);
    }
  }),
  fileFilter: fileFilter,
  limits: {
    fileSize: 15 * 1024 * 1024, // 限制15MB
  }
});

// 提供静态文件访问，并设置缓存策略
const oneYear = 31536000000;
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: oneYear,
  setHeaders: (res, path) => {
    // 对于HTML文件，不设置长期缓存
    if (path.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache');
    } else {
      res.setHeader('Cache-Control', 'public, max-age=31536000');
    }
  }
}));

// 根路由返回HTML页面
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
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
    const chatThumbDir = path.join(__dirname, 'public', 'chat-thumbnails');
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

  // 获取历史消息
  socket.on('get history', (callback) => {
    db.all('SELECT * FROM messages ORDER BY timestamp DESC LIMIT 100', (err, rows) => {
      if (err) return callback(err);
      callback(null, rows.reverse());
    });
  });

  socket.on('disconnect', () => {
    console.log('emit disconnect:', socket.id);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});