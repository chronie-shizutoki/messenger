# Messenger

一個支援WebSocket的實時聊天應用程式，具備現代化的用戶界面和國際化功能。

## 功能特點

- 使用Socket.io實現實時消息傳遞
- 檔案和圖片上傳功能
- 推送通知支援
- 多語言界面
- 櫻花動畫效果的響應式設計
- SQLite數據庫集成

## 安裝步驟

### 前提條件
- Node.js (v14或更高版本)
- npm (v6或更高版本)

### 安裝步驟
1. 克隆倉庫
   ```bash
   git clone https://github.com/quiettimejsg/messenger.git
   cd messenger
   ```

2. 安裝依賴
   ```bash
   npm install
   ```

3. 創建.env文件（可選）進行配置：
   ```
   PORT=3000
   ```

## 使用方法

### 啟動服務器

```bash
# 使用npm
npm start

# 使用Windows批處理文件
start.bat
```

### 訪問應用程序
打開瀏覽器並導航至 `http://localhost:3000`

## 配置
- **推送通知**：在應用程序設置中添加推送通知URL
- **語言**：應用會自動檢測您的語言偏好，也可在設置中手動切換

## 許可證
AGPL-3.0許可證

## 使用的技術
- [Express](https://expressjs.com/) - Web框架
- [Socket.io](https://socket.io/) - 實時通信
- [SQLite3](https://www.sqlite.org/) - 數據庫
- [Sharp](https://sharp.pixelplumbing.com/) - 圖像處理