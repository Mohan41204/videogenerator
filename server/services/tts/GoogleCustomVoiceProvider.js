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
      if (!this.hasCredentials()) {
        throw new Error('Google Cloud credentials not configured. Please set GOOGLE_APPLICATION_CREDENTIALS in your environment to use Google TTS.');
      }
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
      }
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

    // Map language codes appropriately
    switch (language) {
      case 'ta': languageCode = 'ta-IN'; defaultName = voiceGender === 'male' ? 'ta-IN-Wavenet-B' : 'ta-IN-Wavenet-A'; break;
      case 'hi': languageCode = 'hi-IN'; defaultName = voiceGender === 'male' ? 'hi-IN-Wavenet-B' : 'hi-IN-Wavenet-A'; break;
      case 'te': languageCode = 'te-IN'; defaultName = voiceGender === 'male' ? 'te-IN-Wavenet-B' : 'te-IN-Wavenet-A'; break;
      case 'kn': languageCode = 'kn-IN'; defaultName = voiceGender === 'male' ? 'kn-IN-Wavenet-B' : 'kn-IN-Wavenet-A'; break;
      case 'ml': languageCode = 'ml-IN'; defaultName = voiceGender === 'male' ? 'ml-IN-Wavenet-B' : 'ml-IN-Wavenet-A'; break;
      case 'en':
      default:
        languageCode = 'en-IN';
        defaultName = voiceGender === 'male' ? 'en-IN-Wavenet-B' : 'en-IN-Wavenet-A';
        break;
    }

    const request = {
      input: { text },
      voice: {
        languageCode,
        name: voiceId ? undefined : defaultName
      },
      audioConfig: {
        audioEncoding: 'MP3',
        speakingRate: 0.85 // Exceptionally slow speaking rate for teaching (1.0 is default)
      },
    };

    // If using a custom voice ID (e.g. Chirp 3 Custom Voice)
    if (voiceId) {
      // Typically, custom voice is specified via customVoiceParams or setting the name
      // Assuming the voiceId corresponds to the model name in GCP
      request.voice.name = voiceId;
      // For real custom voice, there might be 'customVoice' configuration object.
      // e.g. request.voice.customVoice = { model: voiceId, reportedUsage: 'REALTIME' }
    }

    try {
      const client = this.getClient();
      const [response] = await client.synthesizeSpeech(request);
      const writeFile = util.promisify(fs.writeFile);
      await writeFile(outputPath, response.audioContent, 'binary');
      return outputPath;
    } catch (error) {
      console.error(`Google TTS Error for language ${language}:`, error);
      throw error;
    }
  }
}

module.exports = GoogleCustomVoiceProvider;
