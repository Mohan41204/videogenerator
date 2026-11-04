const fs = require('fs');
const path = require('path');
const GeminiTTSProvider = require('../services/tts/GeminiTTSProvider');

const VOICES_FILE = path.join(__dirname, '..', 'voices.json');
let geminiTTS = null;

const getGeminiTTS = () => {
  if (!geminiTTS) {
    geminiTTS = new GeminiTTSProvider();
  }
  return geminiTTS;
};

const getVoices = () => {
  if (fs.existsSync(VOICES_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(VOICES_FILE, 'utf8'));
    } catch (e) {
      console.error('[VoiceController] Error parsing voices.json:', e.message);
      return {};
    }
  }
  return {};
};

const saveVoices = (data) => {
  fs.writeFileSync(VOICES_FILE, JSON.stringify(data, null, 2));
};

/**
 * Clones a voice using Gemini 3.8 Flash Voice Replication on Google Vertex AI.
 * Supports referenceAudio + consentAudio.
 */
const setupVoice = async (req, res) => {
  try {
    const referenceFile = req.files?.referenceAudio?.[0] || req.files?.voiceRecording?.[0] || req.file;
    const consentFile = req.files?.consentAudio?.[0];

    const displayName = String(
      req.body?.name || req.body?.displayName || 'My Cloned Voice'
    ).trim().slice(0, 100);

    if (!referenceFile) {
      return res.status(400).json({
        success: false,
        message: 'Reference audio recording is required.'
      });
    }

    let referenceBuffer = referenceFile.buffer;
    if (!referenceBuffer && referenceFile.path && fs.existsSync(referenceFile.path)) {
      referenceBuffer = fs.readFileSync(referenceFile.path);
    }

    let consentBuffer = consentFile?.buffer;
    if (!consentBuffer && consentFile?.path && fs.existsSync(consentFile.path)) {
      consentBuffer = fs.readFileSync(consentFile.path);
    }

    // If no separate consent file was provided, use reference buffer as consent audio fallback
    if (!consentBuffer) {
      consentBuffer = referenceBuffer;
    }

    console.log(`[VoiceController] Replicating voice "${displayName}" via Gemini 3.8 Flash...`);
    const provider = getGeminiTTS();
    const voiceId = await provider.createReplicatedVoice({
      referenceBuffer,
      consentBuffer,
      displayName
    });

    const voices = getVoices();
    voices[voiceId] = {
      voiceId,
      name: displayName,
      status: 'READY',
      type: 'gemini-replicated',
      createdAt: new Date().toISOString()
    };
    voices['default'] = voices[voiceId];
    saveVoices(voices);

    // Clean up temporary files if created by disk storage
    if (referenceFile.path && fs.existsSync(referenceFile.path)) {
      fs.unlink(referenceFile.path, () => {});
    }
    if (consentFile?.path && fs.existsSync(consentFile.path)) {
      fs.unlink(consentFile.path, () => {});
    }

    return res.status(200).json({
      success: true,
      voiceId,
      name: displayName,
      status: 'READY',
      message: 'Voice cloned successfully using Gemini 3.8 Flash.'
    });
  } catch (error) {
    console.error('[VoiceController] Voice setup error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to setup custom voice with Gemini 3.8 Flash.',
      error: error.message
    });
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
      status: voice.status,
      name: voice.name
    });
  } catch (error) {
    console.error('[VoiceController] Voice status error:', error);
    res.status(500).json({ success: false, message: 'Failed to get voice status' });
  }
};

const getActiveVoiceId = () => {
  const voices = getVoices();
  const voice = voices['default'];
  return voice && voice.status === 'READY' ? voice.voiceId : null;
};

/**
 * List all voices available for video generation:
 * - Gemini 3.8 Flash TTS Prebuilt Voices
 * - User's Cloned Voices (replicated via Gemini 3.8 Flash)
 * - Google Cloud Wavenet Voices (legacy)
 */
const listVoices = async (req, res) => {
  try {
    const voices = getVoices();
    const clonedVoices = Object.keys(voices)
      .filter(k => k !== 'default')
      .map(k => ({
        id: voices[k].voiceId || k,
        name: voices[k].name || 'My Cloned Voice',
        category: 'Cloned Voices (Gemini 3.8 Flash)',
        gender: voices[k].gender || 'custom',
        isCloned: true
      }));

    // Prebuilt Gemini 3.8 Flash Teacher Voices
    const geminiVoices = [
      {
        id: 'gemini-3.8-flash-tts-aoede',
        name: 'Gemini 3.8 Flash TTS - Teacher (Female / Aoede)',
        category: 'Gemini 3.8 Flash TTS',
        gender: 'female',
        isDefault: true
      },
      {
        id: 'gemini-3.8-flash-tts-achird',
        name: 'Gemini 3.8 Flash TTS - Friendly Teacher (Male / Achird)',
        category: 'Gemini 3.8 Flash TTS',
        gender: 'male'
      },
      {
        id: 'gemini-3.8-flash-tts-alnilam',
        name: 'Gemini 3.8 Flash TTS - Authoritative Teacher (Male / Alnilam)',
        category: 'Gemini 3.8 Flash TTS',
        gender: 'male'
      },
      {
        id: 'gemini-3.8-flash-tts-achernar',
        name: 'Gemini 3.8 Flash TTS - Calm Narrator (Female / Achernar)',
        category: 'Gemini 3.8 Flash TTS',
        gender: 'female'
      }
    ];

    // Standard Google Cloud Wavenet Voices
    const googleCloudVoices = [
      {
        id: 'google-cloud-tts-female',
        name: 'Google Cloud TTS (Female Wavenet)',
        category: 'Google Cloud Wavenet',
        gender: 'female'
      },
      {
        id: 'google-cloud-tts-male',
        name: 'Google Cloud TTS (Male Wavenet)',
        category: 'Google Cloud Wavenet',
        gender: 'male'
      }
    ];

    const allVoices = [...clonedVoices, ...geminiVoices, ...googleCloudVoices];

    res.status(200).json({
      success: true,
      voices: allVoices
    });
  } catch (error) {
    console.error('[VoiceController] List voices error:', error);
    res.status(500).json({ success: false, message: 'Failed to list voices' });
  }
};

const testVoice = async (req, res) => {
  try {
    const { text, language = 'en', voiceId } = req.body;
    if (!text) {
      return res.status(400).json({ success: false, message: 'Text is required for test' });
    }

    const testAudioName = `test_${Date.now()}_${language}.mp3`;
    const outputPath = path.join(__dirname, '../output/audio', testAudioName);
    const audioService = require('../services/audio.service');

    await audioService.generateAudio(text, outputPath, language, voiceId);

    const storageService = require('../services/storage.service');
    let audioUrl = `/output/audio/${testAudioName}`;
    if (storageService.isStorageConfigured()) {
      const uploadRes = await storageService.uploadFile(outputPath, `voices/test/${testAudioName}`);
      if (uploadRes) {
        audioUrl = uploadRes.url;
        if (fs.existsSync(outputPath)) fs.unlink(outputPath, () => {});
      }
    }

    res.status(200).json({
      success: true,
      audioUrl
    });
  } catch (error) {
    console.error('[VoiceController] Test voice error:', error);
    res.status(500).json({ success: false, message: error.message || 'Test failed' });
  }
};

module.exports = {
  setupVoice,
  getVoiceStatus,
  getActiveVoiceId,
  testVoice,
  listVoices
};
