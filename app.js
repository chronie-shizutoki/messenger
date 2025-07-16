require('dotenv').config();
const express = require('express');
const session = require('express-session');
const crypto = require('crypto');
const qrcode = require('qrcode');
const app = express();
const fs = require('fs');
const path = require('path');

// 存储登录会话状态
const loginSessions = new Map();

// 配置会话中间件
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key', // 建议使用环境变量
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production', // 生产环境使用HTTPS
    maxAge: 24 * 60 * 60 * 1000 // 会话有效期1天
  }
}));

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

// 管理员身份验证中间件
const authenticateAdmin = (req, res, next) => {
  // 检查会话是否已登录
  if (req.session && req.session.isAdmin) {
    return next();
  }
  
  // API请求使用Basic Auth验证，页面请求重定向
  if (req.headers.accept && req.headers.accept.includes('text/html')) {
    // 页面请求重定向到登录页面
    return res.redirect('/admin-login.html');
  } else {
    // API请求要求Basic Auth验证
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Basic ')) {
      res.setHeader('WWW-Authenticate', 'Basic realm="Admin Access"');
      return res.status(401).send('需要管理员身份验证');
    }
    
    const credentials = Buffer.from(authHeader.split(' ')[1], 'base64').toString().split(':');
    const username = credentials[0];
    const password = credentials[1];
    
    if (username === process.env.ADMIN_USER && password === process.env.ADMIN_PASS) {
      return next();
    } else {
      res.setHeader('WWW-Authenticate', 'Basic realm="Admin Access"');
      return res.status(401).send('身份验证失败');
    }
  }
};

// 生成登录二维码
app.get('/admin/generate-qr', (req, res) => {
  try {
    // 生成唯一会话ID
const sessionId = crypto.randomBytes(16).toString('hex');
const expiresAt = Date.now() + 2 * 60 * 1000; // 2分钟有效期

// 将QR会话ID与用户会话关联
req.session.qrSessionId = sessionId;

// 存储会话状态
loginSessions.set(sessionId, {
  status: 'pending',
  expiresAt
});
    
    // 生成二维码内容 (实际应用中应使用HTTPS和域名)
    const qrHost = process.env.QR_HOST || req.hostname;
    const qrContent = `http://${qrHost}:${PORT}/admin/confirm-login?sessionId=${sessionId}`;
    
    // 生成二维码图片
    qrcode.toDataURL(qrContent, (err, url) => {
      if (err) {
        return res.status(500).json({ error: '生成二维码失败' });
      }
      res.json({
        sessionId,
        qrUrl: url,
        expiresAt
      });
    });
  } catch (error) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// 检查登录状态
app.get('/admin/check-login/:sessionId', (req, res) => {
  const sessionId = req.params.sessionId;
  
  // 验证会话ID是否与用户会话匹配
  if (sessionId !== req.session.qrSessionId) {
    return res.json({ status: 'invalid' });
  }

  const loginSession = loginSessions.get(sessionId);

  if (!loginSession) {
    return res.json({ status: 'invalid' });
  }
  
  if (Date.now() > loginSession.expiresAt) {
    loginSessions.delete(sessionId);
    return res.json({ status: 'expired' });
  }
  
  if (loginSession.status === 'confirmed') {
    // 创建用户会话
    req.session.isAdmin = true;
    loginSessions.delete(sessionId);
    return res.json({ status: 'confirmed' });
  }
  
  res.json({ status: 'pending' });
});

// 确认登录接口 (供扫码后调用) - 添加扫码后身份验证
app.get('/admin/confirm-login', (req, res) => {
  const sessionId = req.query.sessionId;
if (!sessionId || !loginSessions.has(sessionId)) {
  return res.send('<h1>无效的登录请求</h1>');
}

// 扫码后验证管理员身份
const authHeader = req.headers.authorization;
if (!authHeader || !authHeader.startsWith('Basic ')) {
  res.setHeader('WWW-Authenticate', 'Basic realm="Admin Access"');
  return res.status(401).send('<h1>需要管理员身份验证</h1>');
}

const credentials = Buffer.from(authHeader.split(' ')[1], 'base64').toString().split(':');
const username = credentials[0];
const password = credentials[1];

if (username !== process.env.ADMIN_USER || password !== process.env.ADMIN_PASS) {
  res.setHeader('WWW-Authenticate', 'Basic realm="Admin Access"');
  return res.status(401).send('<h1>身份验证失败，请重试</h1>');
}

// 更新会话状态
loginSessions.set(sessionId, {
  ...loginSessions.get(sessionId),
  status: 'confirmed'
});

res.send('<h1>身份验证成功，登录已确认，请返回管理员页面</h1>');
});

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
app.post('/admin/upload-image', authenticateAdmin, upload.single('image'), async (req, res) => {
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

  res.redirect('/admin.html?upload=success');
});

// 管理员页面路由
app.get('/admin.html', authenticateAdmin, (req, res) => {
  if (!req.session.isAdmin) {
    return res.redirect('/admin-login.html');
  }
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
})

// 启动服务器，允许局域网访问
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});