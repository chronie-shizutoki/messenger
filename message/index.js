const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// 初始化Express应用
const app = express();

// 添加请求日志中间件
app.use((req, res, next) => {
  console.log('[服务器] 收到请求:', req.method, req.url);
  if (req.headers.origin) {
    console.log('[服务器] 请求来源:', req.headers.origin);
  }
  next();
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type"]
  }
});

// 连接数据库
const db = new sqlite3.Database('chat.db', (err) => {
  if (err) {
    console.error(err.message);
  }
  console.log('Connected to the chat database.');
});

// 初始化数据库表
db.run(`CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  content TEXT,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
)`);

// 设置静态文件目录
app.use(express.static(path.join(__dirname, 'public')));

// 处理Socket连接
io.on('connection', (socket) => {
    console.log('[服务器] ====================== 新客户端连接 ======================');
    console.log('[服务器] 客户端ID:', socket.id);
    console.log('[服务器] 客户端连接时间:', new Date().toISOString());
    console.log('[服务器] 客户端IP:', socket.handshake.address);
    console.log('[服务器] 传输协议:', socket.conn.transport.name);

    socket.on('disconnect', (reason) => {
        console.log('[服务器] ====================== 客户端断开连接 ======================');
        console.log('[服务器] 客户端ID:', socket.id);
        console.log('[服务器] 断开原因:', reason);
        console.log('[服务器] 断开时间:', new Date().toISOString());
        if (reason === 'transport close') {
            console.log('[服务器] 可能原因: 客户端网络中断或刷新页面');
        } else if (reason === 'io server disconnect') {
            console.log('[服务器] 可能原因: 服务器主动断开连接');
        } else if (reason === 'ping timeout') {
            console.log('[服务器] 可能原因: 客户端无响应');
        }
    });

    console.log('[服务器] 客户端已连接:', socket.id);

  // 测试连接通信
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

  // 接收消息并广播
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
    console.log('[服务器] 客户端已断开连接:', socket.id);
  });
});

// 启动服务器
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});