/**
 * vscode.renderer.js
 *
 * Wrapper around the existing puppeteer.service.js.
 * Implements the BaseRenderer interface so the factory can route
 * programming tutorials here without modifying the original service.
 *
 * This file adds ZERO new rendering logic — it purely delegates.
 */

const BaseRenderer = require('./baseRenderer');
const puppeteerService = require('../services/puppeteer.service');

class VSCodeRenderer extends BaseRenderer {
  constructor() {
    super('VSCode', {
      fps: 5,
      width: 1920,
      height: 1080,
      screenshotQuality: 82,
    });
  }

  /**
   * No-op — the existing puppeteer service manages its own browser lifecycle.
   */
  async initialize() {
    this.log('Initialized (delegates to puppeteer.service.js).');
  }

  /**
   * Delegates directly to the existing puppeteer.service.renderScreenShareVideo().
   * @param {Array} slides - Slide objects from Gemini
   * @param {Array} durations - Audio durations per slide (seconds)
   * @param {string} outputPath - Output path for silent screen-recording .mp4
   * @returns {Promise<string>}
   */
  async renderVideo(slides, durations, outputPath) {
    this.log(`Rendering ${slides.length} slides via existing puppeteer service...`);
    return puppeteerService.renderScreenShareVideo(slides, durations, outputPath);
  }

  /**
   * No-op — the existing puppeteer service closes its own browser.
   */
  async cleanup() {
    this.log('Cleanup complete (handled by puppeteer.service.js).');
  }
}

module.exports = VSCodeRenderer;
