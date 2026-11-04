const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { setupVoice, getVoiceStatus, testVoice, listVoices } = require('../controllers/voice.controller');

const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Memory storage keeps file buffers ready for direct conversion / transmission
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024,
    files: 3
  }
});

const voiceUploadMiddleware = upload.fields([
  { name: 'referenceAudio', maxCount: 1 },
  { name: 'consentAudio', maxCount: 1 },
  { name: 'voiceRecording', maxCount: 1 }
]);

router.post('/setup', voiceUploadMiddleware, setupVoice);
router.post('/clone', voiceUploadMiddleware, setupVoice);
router.post('/create-voice', voiceUploadMiddleware, setupVoice);
router.get('/status', getVoiceStatus);
router.post('/test', testVoice);
router.get('/list', listVoices);

module.exports = router;
