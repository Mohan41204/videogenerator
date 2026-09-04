const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

// Initialize env
dotenv.config();
if (!process.env.GOOGLE_CLOUD_PROJECT) {
  dotenv.config({ path: path.join(__dirname, '../../.env') });
}

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: true, // Allow any origin for local testing
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Ensure output directories exist
const outputDir = path.join(__dirname, 'output');
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Serve static files (forces download header for MP4 videos)
app.use('/output', express.static(path.join(__dirname, 'output'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.mp4')) {
      res.setHeader('Content-Disposition', 'attachment');
    }
  }
}));

// Routes
const videoRoutes = require('./routes/video.routes');
const voiceRoutes = require('./routes/voice.routes');
const generateRoutes = require('./routes/generate.routes');

app.use('/api/videos', videoRoutes);
app.use('/api/voice', voiceRoutes);
app.use('/api/generate', generateRoutes);

// Error Middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, message: err.message || 'Server Error' });
});

const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

server.on('error', (err) => {
  console.error('Server failed to start:', err);
});

// Increase timeouts for long video generation processes
server.setTimeout(1200000); // 20 minutes
server.keepAliveTimeout = 1200000;
server.headersTimeout = 1200000;

// Prevent unhandled promise rejections from crashing the server
process.on('unhandledRejection', (reason, promise) => {
  console.warn('[Warning] Unhandled Rejection:', reason);
});
