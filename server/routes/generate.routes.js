const express = require('express');
const router = express.Router();
const generateController = require('../controllers/generate.controller');

// One-shot: generate script + video in a single call
router.post('/one-shot', generateController.generateOneShot);

module.exports = router;
