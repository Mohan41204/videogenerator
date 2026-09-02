class TTSProvider {
  /**
   * Generates speech and saves it to the output path.
   * @param {Object} options
   * @param {string} options.text - The text to synthesize.
   * @param {string} options.language - The target language code (e.g., 'en', 'ta', 'hi').
   * @param {string} options.voiceId - The custom voice ID, if available.
   * @param {string} options.outputPath - The absolute path to save the generated audio file.
   * @returns {Promise<string>} The output path.
   */
  async generateSpeech({ text, language, voiceId, outputPath }) {
    throw new Error('generateSpeech() must be implemented by the provider');
  }
}

module.exports = TTSProvider;
