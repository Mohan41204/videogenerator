const express = require('express');
const router = express.Router();
const videoController = require('../controllers/video.controller');
const upload = require('../middleware/upload.middleware');

// Generate video endpoint
router.post('/generate', upload.single('background'), videoController.generateVideo);

// Generate script endpoint
router.post('/generate-script', videoController.generateScript);

module.exports = router;
