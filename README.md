# Messenger

A real-time chat application with WebSocket support, featuring a modern UI and internationalization capabilities.

## Languages
This documentation is available in the following languages:
- [English (US)](README.md)
- [English (UK)](docs/README-en-GB.md)
- [Spanish](docs/README-es.md)
- [French](docs/README-fr.md)
- [Japanese](docs/README-ja.md)
- [Korean](docs/README-ko.md)
- [Malay](docs/README-ms.md)
- [Chinese (Simplified)](docs/README-zh-CN.md)
- [Chinese (Hong Kong)](docs/README-zh-HK.md)
- [Chinese (Taiwan)](docs/README-zh-TW.md)

## Localization Files
Localization JSON files are available in the [public/locales](public/locales/) directory.

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
   PORT=3001
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
Open your browser and navigate to `http://localhost:3001`

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