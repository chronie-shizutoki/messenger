# Messenger

A real-time chat application with WebSocket support, featuring a modern UI and internationalisation capabilities.

## Features

- Real-time messaging using Socket.io
- File and image upload functionality
- Push notification support
- Multi-language interface
- Responsive design with sakura animation effects
- SQLite database integration

## Installation

### Prerequisites
- Node.js (v14 or higher)
- npm (v6 or higher)

### Steps
1. Clone the repository
   ```bash
   git clone https://github.com/quiettimejsg/messenger.git
   cd messenger
   ```

2. Install dependencies
   ```bash
   npm install
   ```

3. Create a `.env` file (optional) for configuration:
   ```
   PORT=3000
   ```

## Usage

### Starting the Server

```bash
# Using npm
npm start

# Using Windows batch file
start.bat
```

### Accessing the Application
Open your browser and navigate to `http://localhost:3000`

## Configuration
- **Push Notifications**: Add push notification URLs in the application settings
- **Language**: The app automatically detects your language preference, with manual override available in settings

## License
AGPL-3.0 License

## Technologies Used
- [Express](https://expressjs.com/) - Web framework
- [Socket.io](https://socket.io/) - Real-time communication
- [SQLite3](https://www.sqlite.org/) - Database
- [Sharp](https://sharp.pixelplumbing.com/) - Image processing