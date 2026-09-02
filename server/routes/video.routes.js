const express = require('express');
const router = express.Router();
const videoController = require('../controllers/video.controller');
const upload = require('../middleware/upload.middleware');

// Generate video endpoint
router.post('/generate', upload.single('background'), videoController.generateVideo);

// Generate script endpoint
router.post('/generate-script', videoController.generateScript);

// Generate AWS script endpoint
router.post('/generate-aws-script', videoController.generateAwsScript);

// Regenerate language video endpoint
router.post('/:id/video/:lang/regenerate', videoController.regenerateLanguageVideo);

module.exports = router;
