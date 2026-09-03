const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const VOICES_FILE = path.join(__dirname, '..', 'voices.json');

const getVoices = () => {
  if (fs.existsSync(VOICES_FILE)) {
    return JSON.parse(fs.readFileSync(VOICES_FILE, 'utf8'));
  }
  return {};
};

const saveVoices = (data) => {
  fs.writeFileSync(VOICES_FILE, JSON.stringify(data, null, 2));
};

const setupVoice = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No voice recording provided.' });
    }

    const { language, name } = req.body;
    
    // In a real application, you would:
    // 1. Upload req.file.path to GCP Storage.
    // 2. Call GCP Custom Voice training API.
    // 3. Receive a custom model voice ID.
    // For now, we mock the custom voice ID or use the default setup.

    const voiceId = `custom-voice-${uuidv4()}`;
    
    const voices = getVoices();
    voices[voiceId] = {
      voiceId,
      status: 'READY',
      originalFile: req.file.filename,
      language: language || 'en',
      name: name || voiceId,
      createdAt: new Date().toISOString()
    };
    // Defaulting to user 'default' for fallback
    voices['default'] = voices[voiceId];
    saveVoices(voices);

    res.status(200).json({
      success: true,
      voiceId,
      status: 'READY'
    });
  } catch (error) {
    console.error('Voice setup error:', error);
    res.status(500).json({ success: false, message: 'Failed to setup custom voice', error: error.message });
  }
};

const getVoiceStatus = async (req, res) => {
  try {
    const voices = getVoices();
    const voice = voices['default'];
    
    if (!voice) {
      return res.status(200).json({
        success: true,
        status: 'NOT_CONFIGURED'
      });
    }

    res.status(200).json({
      success: true,
      voiceId: voice.voiceId,
      status: voice.status
    });
  } catch (error) {
    console.error('Voice status error:', error);
    res.status(500).json({ success: false, message: 'Failed to get voice status' });
  }
};

// Expose internal getter for video controller
const getActiveVoiceId = () => {
  const voices = getVoices();
  const voice = voices['default'];
  return voice && voice.status === 'READY' ? voice.voiceId : null;
};

const testVoice = async (req, res) => {
  try {
    const { text, language, voiceId: reqVoiceId } = req.body;
    const isCustomVoice = reqVoiceId && typeof reqVoiceId === 'string' && reqVoiceId.trim() !== '' && reqVoiceId !== 'default' && reqVoiceId !== 'default-computer';
    const voiceId = isCustomVoice ? reqVoiceId.trim() : null;

    if (!text || !language) {
      return res.status(400).json({ success: false, message: 'Text and language are required' });
    }

    const SUPPORTED_LANGUAGES = require('../config/languages');
    const langConfig = SUPPORTED_LANGUAGES[language];
    if (!langConfig) {
      return res.status(400).json({ success: false, message: 'Unsupported language' });
    }

    const translationService = require('../services/translation.service');
    const audioService = require('../services/audio.service');
    
    // 1. Translate text using LLM
    const translatedText = await translationService.translateText(text, langConfig.name);

    // 2. Generate Audio
    const testAudioName = `test_${Date.now()}_${language}.mp3`;
    const outputPath = path.join(__dirname, '../output/audio', testAudioName);
    
    // Ensure directory exists
    if (!fs.existsSync(path.dirname(outputPath))) {
      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    }

    await audioService.generateAudio(translatedText, outputPath, langConfig.code, voiceId);

    res.status(200).json({
      success: true,
      translatedText,
      audioUrl: `/output/audio/${testAudioName}`
    });
  } catch (error) {
    console.error('Test voice error:', error);
    res.status(500).json({ success: false, message: 'Test failed', error: error.message });
  }
};

const listVoices = async (req, res) => {
  try {
    const voices = getVoices();
    const voiceList = Object.keys(voices)
      .filter(k => k !== 'default')
      .map(k => voices[k]);

    res.status(200).json({
      success: true,
      voices: voiceList
    });
  } catch (error) {
    console.error('List voices error:', error);
    res.status(500).json({ success: false, message: 'Failed to list voices' });
  }
};

module.exports = {
  setupVoice,
  getVoiceStatus,
  getActiveVoiceId,
  testVoice,
  listVoices
};
