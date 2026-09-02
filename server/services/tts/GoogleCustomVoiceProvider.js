const fs = require('fs');
const util = require('util');
const textToSpeech = require('@google-cloud/text-to-speech');
const TTSProvider = require('./TTSProvider');

class GoogleCustomVoiceProvider extends TTSProvider {
  constructor() {
    super();
    // Initialize the Google Cloud TTS client.
    // Ensure GOOGLE_APPLICATION_CREDENTIALS or similar is set in the environment if required.
    this.client = new textToSpeech.TextToSpeechClient();
  }

  /**
   * Generates speech and saves it to the output path.
   */
  async generateSpeech({ text, language, voiceId, outputPath }) {
    if (!text || text.trim() === '') {
      throw new Error('Text is required for speech generation.');
    }

    // Determine standard voice mapping if custom voice is unavailable
    let languageCode = 'en-US';
    let defaultName = 'en-US-Journey-F'; // A natural sounding standard voice
    
    // Map language codes appropriately
    switch(language) {
      case 'ta': languageCode = 'ta-IN'; defaultName = 'ta-IN-Standard-C'; break;
      case 'hi': languageCode = 'hi-IN'; defaultName = 'hi-IN-Neural2-A'; break;
      case 'te': languageCode = 'te-IN'; defaultName = 'te-IN-Standard-A'; break;
      case 'kn': languageCode = 'kn-IN'; defaultName = 'kn-IN-Standard-A'; break;
      case 'ml': languageCode = 'ml-IN'; defaultName = 'ml-IN-Standard-A'; break;
      case 'en': 
      default:
        languageCode = 'en-IN'; 
        defaultName = 'en-IN-Neural2-A'; 
        break;
    }

    const request = {
      input: { text },
      voice: { 
        languageCode, 
        name: voiceId ? undefined : defaultName 
      },
      audioConfig: { audioEncoding: 'MP3' },
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
      const [response] = await this.client.synthesizeSpeech(request);
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
