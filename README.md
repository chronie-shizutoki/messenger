# Image Viewer

A modern image viewer application that supports image browsing, uploading, zooming, and dragging, with real-time chat functionality and an aesthetically pleasing UI design.

## Features
- 📷 Image Viewing: Display images in a grid layout. Click on an image to view it in full size.
- 🚀 Image Upload: Upload new images through the admin interface.
- 🔍 Zoom Function: Support mouse wheel and touch gestures to zoom in and out of images.
- 🖱️ Drag Function: Drag the image to view details after zooming in.
- 💬 Real-time Chat: Built-in chat function that enables real-time communication between users.
- ⏰ Clock Display: Show the current time and date at the top.
- 📱 Responsive Design: Adapt to various screen sizes.

## Tech Stack
- Frontend: HTML, CSS, JavaScript
- Backend: Node.js
- Real-time Communication: Socket.io
- UI Components: Font Awesome
- Font: LXGW WenKai GB

## Installation Steps

1. Clone the repository
```bash
git clone https://github.com/quiettimejsg/Image-Viewer.git
cd image-viewer
```

2. Install dependencies
```bash
npm install
```

3. Start the server
```bash
npm start
```

4. Access the application in your browser
```
http://localhost:3000
```

## Usage

### Viewing Images
- All images will be automatically loaded on the home page.
- Click on any image to open the full-size view mode.
- In the full-size view mode:
  - Use the mouse wheel to zoom in and out of the image.
  - Drag the mouse to move the image.
  - Click on the blank area or use the close button in the top-right corner to exit the full-size view mode.

### Uploading Images
1. Access the admin page: http://localhost:3000/upload.html
2. Click the upload icon or select file button.
3. Select the image file to upload.
4. Click the "Upload Image" button.

### Chat Functionality
- Use the bottom-right chat box to communicate with other online users in real-time.
- Click the "-" button in the chat box title bar to collapse the chat box.

## Project Structure
```
image-viewer/
├── app.js                 # Backend entry file
├── package.json           # Project dependencies
├── public/
│   ├── index.html         # Image viewer home page
│   ├── upload.html         # Image upload management page
│   ├── chat-client.js     # Chat client logic
│   ├── components/        # UI components
│   └── lib/               # Third-party libraries
└── README.md              # Project documentation
```

## License
[AGPL-3.0](LICENSE)