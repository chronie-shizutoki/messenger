# Messenger

一个支持WebSocket的实时聊天应用程序，具有现代化的用户界面和国际化功能。

## 功能特点

- 使用Socket.io实现实时消息传递
- 文件和图片上传功能
- 推送通知支持
- 多语言界面
- 樱花动画效果的响应式设计
- SQLite数据库集成

## 安装步骤

### 前提条件
- Node.js (v14或更高版本)
- npm (v6或更高版本)

### 安装步骤
1. 克隆仓库
   ```bash
   git clone https://github.com/quiettimejsg/messenger.git
   cd messenger
   ```

2. 安装依赖
   ```bash
   npm install
   ```

3. 创建.env文件（可选）进行配置：
   ```
   PORT=3000
   ```

## 使用方法

### 启动服务器

```bash
# 使用npm
npm start

# 使用Windows批处理文件
start.bat
```

### 访问应用程序
打开浏览器并导航至 `http://localhost:3000`

## 配置
- **推送通知**：在应用程序设置中添加推送通知URL
- **语言**：应用会自动检测您的语言偏好，也可在设置中手动切换

## 许可证
AGPL-3.0许可证

## 使用的技术
- [Express](https://expressjs.com/) - Web框架
- [Socket.io](https://socket.io/) - 实时通信
- [SQLite3](https://www.sqlite.org/) - 数据库
- [Sharp](https://sharp.pixelplumbing.com/) - 图像处理