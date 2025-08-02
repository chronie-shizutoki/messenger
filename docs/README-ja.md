# Messenger

WebSocketをサポートするリアルタイムチャットアプリケーションで、モダンなUIと国際化機能を備えています。

## 特徴

- Socket.ioを使用したリアルタイムメッセージング
- ファイルおよび画像アップロード機能
- プッシュ通知サポート
- 多言語インターフェース
- SQLiteデータベース統合

## インストール

### 前提条件
- Node.js (v14以上)
- npm (v6以上)

### 手順
1. リポジトリをクローン
   ```bash
   git clone https://github.com/quiettimejsg/messenger.git
   cd messenger
   ```

2. 依存関係をインストール
   ```bash
   npm install
   ```

3. 設定用の.envファイルを作成（オプション）:
   ```
   PORT=3000
   ```

## 使用方法

### サーバーの起動

```bash
# npmを使用する場合
npm start

# Windowsバッチファイルを使用する場合
start.bat
```

### アプリケーションへのアクセス
ブラウザを開き、`http://localhost:3000`に移動します

## 設定
- **プッシュ通知**: アプリケーション設定でプッシュ通知URLを追加します
- **言語**: アプリは言語設定を自動的に検出し、設定で手動で変更することもできます

## ライセンス
AGPL-3.0ライセンス

## 使用技術
- [Express](https://expressjs.com/) - Webフレームワーク
- [Socket.io](https://socket.io/) - リアルタイム通信
- [SQLite3](https://www.sqlite.org/) - データベース
- [Sharp](https://sharp.pixelplumbing.com/) - 画像処理