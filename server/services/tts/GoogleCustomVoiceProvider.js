const fs = require('fs');
const util = require('util');
const textToSpeech = require('@google-cloud/text-to-speech');
const TTSProvider = require('./TTSProvider');

class GoogleCustomVoiceProvider extends TTSProvider {
  constructor() {
    super();
    this.client = null;
  }

  hasCredentials() {
    // Return true if running on Cloud Run / GCP (ADC available) or if explicit credential env is present
    if (process.env.K_SERVICE || process.env.GOOGLE_CLOUD_PROJECT) {
      return true;
    }
    const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    if (process.env.GOOGLE_CREDENTIALS_JSON) {
      return true;
    }
    if (credPath && credPath.trim().startsWith('{')) {
      return true; // It's a JSON string
    }
    if (credPath && fs.existsSync(credPath)) {
      return true;
    }
    return false;
  }

  getClient() {
    if (!this.client) {
      let ttsOptions = {};
      const credsEnv = process.env.GOOGLE_APPLICATION_CREDENTIALS;

      if (process.env.GOOGLE_CREDENTIALS_JSON) {
        try {
          ttsOptions.credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON);
        } catch (err) {
          console.error("❌ Error parsing GOOGLE_CREDENTIALS_JSON:", err.message);
        }
      } else if (credsEnv && credsEnv.trim().startsWith('{')) {
        try {
          ttsOptions.credentials = JSON.parse(credsEnv);
        } catch (err) {
          console.error("❌ Error parsing GOOGLE_APPLICATION_CREDENTIALS as JSON:", err.message);
        }
      } else if (credsEnv && fs.existsSync(credsEnv)) {
        ttsOptions.keyFilename = credsEnv;
      }

      if (process.env.GOOGLE_CLOUD_PROJECT) {
        ttsOptions.projectId = process.env.GOOGLE_CLOUD_PROJECT;
      }

      // Initialize TextToSpeechClient — automatically resolves Application Default Credentials (ADC) on Cloud Run
      this.client = new textToSpeech.TextToSpeechClient(ttsOptions);
    }
    return this.client;
  }

  /**
   * Generates speech and saves it to the output path.
   */
  async generateSpeech({ text, language, voiceId, voiceGender, outputPath }) {
    if (!text || text.trim() === '') {
      throw new Error('Text is required for speech generation.');
    }

    // Determine standard voice mapping if custom voice is unavailable
    let languageCode = 'en-IN';
    let defaultName = voiceGender === 'male' ? 'en-IN-Wavenet-B' : 'en-IN-Wavenet-A';

    // Map language codes appropriately using Neural2 and Journey voices for ultra-realistic speech
    switch (language) {
      case 'ta': languageCode = 'ta-IN'; defaultName = voiceGender === 'male' ? 'ta-IN-Wavenet-B' : 'ta-IN-Wavenet-A'; break; // ta-IN doesn't have Neural2 yet
      case 'hi': languageCode = 'hi-IN'; defaultName = voiceGender === 'male' ? 'hi-IN-Neural2-B' : 'hi-IN-Neural2-A'; break;
      case 'te': languageCode = 'te-IN'; defaultName = voiceGender === 'male' ? 'te-IN-Standard-B' : 'te-IN-Standard-A'; break; // te-IN limited
      case 'kn': languageCode = 'kn-IN'; defaultName = voiceGender === 'male' ? 'kn-IN-Wavenet-B' : 'kn-IN-Wavenet-A'; break; // kn-IN limited
      case 'ml': languageCode = 'ml-IN'; defaultName = voiceGender === 'male' ? 'ml-IN-Wavenet-B' : 'ml-IN-Wavenet-A'; break; // ml-IN limited
      case 'en':
      default:
        languageCode = 'en-IN';
        // Using high-quality Neural2 voices with an Indian accent
        defaultName = voiceGender === 'male' ? 'en-IN-Neural2-B' : 'en-IN-Neural2-A';
        break;
    }

    const voiceName = voiceId || defaultName;
    console.log(`[TTS] Generating ${language === 'te' ? 'Telugu' : language} audio using Google Cloud TTS voice ${voiceName} (${languageCode})`);

    const request = {
      input: { text },
      voice: {
        languageCode,
        name: voiceName
      },
      audioConfig: {
        audioEncoding: 'MP3',
        speakingRate: 0.85 // Exceptionally slow speaking rate for teaching (1.0 is default)
      },
    };

    try {
      const client = this.getClient();
      const [response] = await client.synthesizeSpeech(request);
      const writeFile = util.promisify(fs.writeFile);
      await writeFile(outputPath, response.audioContent, 'binary');
      return outputPath;
    } catch (error) {
      console.error(`Google TTS Error for language ${language} using voice ${voiceName}:`, error.message);
      
      // Safe language-level fallback for Telugu if voice synthesis fails with requested voice
      if (language === 'te' && voiceName !== 'te-IN-Standard-A') {
        console.warn(`[TTS] Retrying Telugu TTS with fallback voice te-IN-Standard-A...`);
        request.voice.name = 'te-IN-Standard-A';
        const client = this.getClient();
        const [response] = await client.synthesizeSpeech(request);
        const writeFile = util.promisify(fs.writeFile);
        await writeFile(outputPath, response.audioContent, 'binary');
        return outputPath;
      }
      throw error;
    }
  }
}

module.exports = GoogleCustomVoiceProvider;
