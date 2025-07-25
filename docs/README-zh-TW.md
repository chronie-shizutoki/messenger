# Messenger

一個支援WebSocket的即時聊天應用程式，具備現代化的使用者介面和國際化功能。

## 功能特點

- 使用Socket.io實現即時訊息傳遞
- 檔案和圖片上傳功能
- 推送通知支援
- 多語言介面
- 櫻花動畫效果的回應式設計
- SQLite資料庫整合

## 安裝步驟

### 前提條件
- Node.js (v14或更高版本)
- npm (v6或更高版本)

### 安裝步驟
1. 複製倉庫
   ```bash
   git clone https://github.com/quiettimejsg/messenger.git
   cd messenger
   ```

2. 安裝相依套件
   ```bash
   npm install
   ```

3. 建立.env檔案（選擇性）進行設定：
   ```
   PORT=3000
   ```

## 使用方法

### 啟動伺服器

```bash
# 使用npm
npm start

# 使用Windows批次檔
start.bat
```

### 存取應用程式
開啟瀏覽器並導覽至 `http://localhost:3000`

## 設定
- **推送通知**：在應用程式設定中新增推送通知URL
- **語言**：應用程式會自動偵測您的語言偏好，也可在設定中手動切換

## 授權條款
AGPL-3.0授權條款

## 使用的技術
- [Express](https://expressjs.com/) - Web框架
- [Socket.io](https://socket.io/) - 即時通訊
- [SQLite3](https://www.sqlite.org/) - 資料庫
- [Sharp](https://sharp.pixelplumbing.com/) - 影像處理