const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { setupVoice, getVoiceStatus, testVoice, listVoices } = require('../controllers/voice.controller');

// Configure multer for audio uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '..', 'uploads');
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, `voice_${Date.now()}${path.extname(file.originalname) || '.webm'}`);
  }
});
const upload = multer({ storage });

router.post('/setup', upload.single('voiceRecording'), setupVoice);
router.get('/status', getVoiceStatus);
router.post('/test', testVoice);
router.get('/list', listVoices);

module.exports = router;
