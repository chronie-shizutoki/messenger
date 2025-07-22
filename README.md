# Image Viewer

一个现代化的图片查看器应用，支持图片浏览、上传、缩放和拖动功能，带有实时聊天功能和美观的UI设计。

## 功能特点
- 📷 图片查看：以网格布局展示图片，点击图片可放大查看
- 🚀 图片上传：通过管理员界面上传新图片
- 🔍 缩放功能：支持鼠标滚轮和触摸缩放图片
-  drag 拖动功能：放大后可拖动查看图片细节
- 💬 实时聊天：内置聊天功能，支持用户间实时交流
- ⏰ 时钟显示：顶部显示当前时间和日期
- 📱 响应式设计：适配各种屏幕尺寸

## 技术栈
- 前端：HTML, CSS, JavaScript
- 后端：Node.js
- 实时通信：Socket.io
- UI组件：Font Awesome
- 字体：LXGW WenKai GB

## 安装步骤

1. 克隆仓库
```bash
git clone https://github.com/quiettimejsg/Image-Viewer.git
cd image-viewer
```

2. 安装依赖
```bash
npm install
```

3. 启动服务
```bash
npm start
```

4. 在浏览器中访问
```
http://localhost:3000
```

## 使用方法

### 查看图片
- 首页会自动加载所有图片
- 点击任意图片打开大图查看模式
- 在大图模式中：
  - 使用鼠标滚轮缩放图片
  - 拖动鼠标移动图片
  - 点击空白处或使用右上角关闭按钮退出大图模式

### 上传图片
1. 访问管理员页面：http://localhost:3000/upload.html
2. 点击上传图标或选择文件按钮
3. 选择要上传的图片文件
4. 点击"上传图片"按钮

### 聊天功能
- 使用右下角聊天框与其他在线用户交流
- 点击聊天框标题栏的"-"按钮可折叠聊天框

## 项目结构
```
image-viewer/
├── app.js                 # 后端入口文件
├── package.json           # 项目依赖
├── public/
│   ├── index.html         # 图片查看首页
│   ├── upload.html         # 图片上传管理页面
│   ├── chat-client.js     # 聊天客户端逻辑
│   ├── components/        # UI组件
│   └── lib/               # 第三方库
└── README.md              # 项目文档
```

## 许可证
[AGPL-3.0](LICENSE)