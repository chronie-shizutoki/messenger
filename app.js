require('dotenv').config();
const express = require('express');

const app = express();
const http = require('http');
const { Server } = require('socket.io');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const cors = require('cors');
app.use(cors({ origin: '*' }));

const PORT = process.env.PORT || 3000;
const IMAGE_PATH = path.join(__dirname, 'public', 'images', 'sample.svg');
const sharp = require('sharp');
const ERROR_FETCHING_IMAGES = 'Error fetching images';
const THUMBNAIL_DIRECTORY = path.join(__dirname, 'public', 'thumbnails');

// 确保缩略图目录存在
if (!fs.existsSync(THUMBNAIL_DIRECTORY)) {
  fs.mkdirSync(THUMBNAIL_DIRECTORY, { recursive: true });
}
const IMAGE_DIRECTORY = path.join(__dirname, 'public', 'images');

// 引入multer处理文件上传
const multer = require('multer');

// 配置multer存储
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, IMAGE_DIRECTORY);
  },
  filename: function (req, file, cb) {
    // 保留原始文件名并添加时间戳防止冲突
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    const filename = path.basename(file.originalname, ext) + '-' + uniqueSuffix + ext;
    cb(null, filename);
  }
});

// 配置文件过滤
const fileFilter = (req, file, cb) => {
  const allowedTypes = ['.jpg', '.jpeg', '.png', '.gif', '.svg'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowedTypes.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('只允许上传图片文件: ' + allowedTypes.join(', ')), false);
  }
};

// 初始化multer上传中间件
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 15 * 1024 * 1024, // 限制15MB
  }
});

// 提供静态文件访问
app.use(express.static(path.join(__dirname, 'public')));

// 提供静态文件访问
app.use(express.static(path.join(__dirname, 'public')));

// 根路由返回HTML页面
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 获取所有图片列表
app.get('/get-all-images', async (req, res) => {
  try {
    const files = await fs.promises.readdir(IMAGE_DIRECTORY);
    const imageFiles = files.filter(file => {
      const ext = path.extname(file).toLowerCase();
      return ['.jpg', '.jpeg', '.png', '.gif', '.svg'].includes(ext);
    });
    const imageData = imageFiles.map(file => ({
      filename: file,
      imageUrl: `/get-image/${file}`,
      thumbnailUrl: `/get-thumbnail/${file}`
    }));
    res.json(imageData);
  } catch (err) {
    res.status(500).send(ERROR_FETCHING_IMAGES);
  }
});

// 获取单个图片
app.get('/get-image/:filename', (req, res) => {
  const imagePath = path.join(IMAGE_DIRECTORY, req.params.filename);
  if (fs.existsSync(imagePath)) {
    res.sendFile(imagePath);
  } else {
    res.status(404).send('Image not found');
  }
})

// 获取缩略图
app.get('/get-thumbnail/:filename', (req, res) => {
  const thumbnailPath = path.join(THUMBNAIL_DIRECTORY, req.params.filename);
  if (fs.existsSync(thumbnailPath)) {
    res.sendFile(thumbnailPath);
  } else {
    res.status(404).send('Thumbnail not found');
  }
});

// 管理员图片上传接口
app.post('/upload/upload-image', upload.single('image'), async (req, res) => {
  if (!req.file) {
    return res.status(400).send('未选择图片文件');
  }

  try {
    // 生成缩略图
    const thumbnailPath = path.join(THUMBNAIL_DIRECTORY, req.file.filename);
    await sharp(req.file.path)
      .resize(200, 200, { fit: 'inside', withoutEnlargement: true })
      .toFile(thumbnailPath);
  } catch (error) {
    console.error('生成缩略图失败:', error);
  }

  res.redirect('/upload.html?upload=success');
});

// 管理员页面路由
app.get('/upload.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'upload.html'));
})

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

// 处理Socket连接
io.on('connection', (socket) => {
  console.log('[服务器] 新客户端连接:', socket.id);

  // 测试连接
  socket.emit('connection test', '服务器连接成功');
  socket.on('client test', (data) => {
    console.log('[服务器] 收到客户端测试消息:', data);
    socket.emit('server response', '已收到测试消息: ' + data);
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

  // 接收并广播消息
  socket.on('chat message', (msg, callback) => {
    console.log('[服务器] 收到消息:', msg);
    saveMessage(msg.content, (err, savedMsg) => {
      if (err) {
        console.error('[服务器] 消息保存失败:', err);
        return callback(err);
      }
      io.emit('chat message', savedMsg);
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
    console.log('[服务器] 客户端断开连接:', socket.id);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});