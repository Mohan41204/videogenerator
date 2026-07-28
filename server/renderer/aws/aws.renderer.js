/**
 * aws.renderer.js
 *
 * AWS Console tutorial renderer.
 *
 * Instead of rendering a custom HTML template (like the VS Code renderer),
 * this opens a real Chromium browser, authenticates with AWS Console,
 * and executes the Gemini-generated action steps while recording the screen.
 *
 * The recording uses the same screenshot-to-FFmpeg pipeline as the VS Code
 * renderer for consistency.
 *
 * Architecture:
 *   sessionManager → authenticate
 *   actionExecutor → execute each step
 *   humanBehavior  → make interactions look natural
 *   baseRenderer   → FFmpeg frame piping
 */

const BaseRenderer = require('../baseRenderer');
const awsConfig = require('../../config/aws.config');
const sessionManager = require('./sessionManager');
const { executeSteps } = require('./actionExecutor');
const human = require('./humanBehavior');

class AWSRenderer extends BaseRenderer {
  constructor() {
    super('AWS', {
      fps: awsConfig.recording.fps,
      width: awsConfig.viewport.width,
      height: awsConfig.viewport.height,
      screenshotQuality: awsConfig.recording.screenshotQuality,
    });
    this._browser = null;
    this._page = null;
  }

  /**
   * Launch browser and authenticate with AWS Console.
   */
  async initialize() {
    this.log('Initializing AWS Console renderer...');
    const { browser, page } = await sessionManager.getAuthenticatedPage();
    this._browser = browser;
    this._page = page;
    this.log('AWS Console session ready.');
  }

  /**
   * Render the AWS tutorial video.
   *
   * For AWS tutorials the `slides` parameter is actually a single lesson object
   * with a `steps` array (not multiple slides). The narration is provided
   * as a single block, and audio durations tell us how long to record.
   *
   * Recording strategy:
   *   1. Start FFmpeg pipeline
   *   2. Execute each action step, capturing frames in parallel
   *   3. Finalize FFmpeg when all steps (and their allocated time) are done
   *
   * @param {Array|object} slides - Either the full lesson object or array with one lesson
   * @param {Array} durations - Audio durations (one entry for the entire lesson, or per-step)
   * @param {string} outputPath - Output path for silent screen-recording .mp4
   */
  async renderVideo(slides, durations, outputPath) {
    // Normalize input: accept either a single lesson or an array
    const lesson = Array.isArray(slides) ? slides[0] : slides;
    const steps = lesson.steps || [];
    const totalDuration = durations.reduce((a, b) => a + b, 0);

    this.log(`Recording AWS tutorial: "${lesson.title || 'Untitled'}"`);
    this.log(`Steps: ${steps.length}, Total audio duration: ${totalDuration.toFixed(1)}s`);

    // Verify the browser/page are still alive — the singleton renderer may hold
    // stale references from a previous run where the browser disconnected.
    if (
      !this._page ||
      !this._browser ||
      !this._browser.connected ||
      this._page.isClosed()
    ) {
      this._page = null;
      this._browser = null;
      await this.initialize();
    }

    const page = this._page;
    const browser = this._browser;

    // ── Inject custom mouse cursor overlay ─────────────────────────────
    // Puppeteer screenshots don't capture the OS cursor, so we draw our own.
    await page.evaluate(() => {
      if (document.getElementById('__vg_cursor')) return;
      
      const cursor = document.createElement('div');
      cursor.id = '__vg_cursor';
      cursor.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M5 3L19 12L12 13L9 20L5 3Z" fill="white" stroke="black" stroke-width="1.5" stroke-linejoin="round"/>
      </svg>`;
      cursor.style.cssText = `
        position: fixed;
        top: 0; left: 0;
        width: 24px; height: 24px;
        pointer-events: none;
        z-index: 2147483647;
        transform: translate(-2px, -2px);
        filter: drop-shadow(1px 2px 2px rgba(0,0,0,0.4));
        transition: top 0.05s linear, left 0.05s linear;
      `;
      document.body.appendChild(cursor);
      
      // Track mouse movement
      document.addEventListener('mousemove', (e) => {
        cursor.style.left = e.clientX + 'px';
        cursor.style.top = e.clientY + 'px';
      }, true);
    });
    this.log('Custom mouse cursor injected.');

    // ── Start FFmpeg pipeline ──────────────────────────────────────────
    const { proc: ffmpegProc, finished: ffmpegFinished } = this.startFFmpegPipeline(outputPath);

    // ── Frame capture loop (runs in background) ────────────────────────
    // Each 1920x1080 screenshot takes ~300-500ms, so actual capture rate is ~2-3 FPS.
    // We set FFmpeg input to match this rate (fps config = 5) and do NOT add
    // extra delay between captures — the screenshot time IS the pacing.
    let isRecording = true;
    let totalFramesCaptured = 0;
    const totalFrames = Math.ceil(totalDuration * this.fps);
    const frameInterval = 1000 / this.fps; // ms between frames

    const captureLoop = (async () => {
      while (isRecording) {
        // Bail out if the browser or page died mid-recording
        if (!browser.connected || page.isClosed()) {
          console.warn('[AWS:CaptureLoop] Browser/page disconnected — stopping capture.');
          break;
        }

        try {
          // Use JPEG (quality 80) — 3-4x faster than PNG, perfectly adequate for screen recording
          const screenshotPromise = page.screenshot({
            type: 'jpeg',
            quality: 80,
            clip: { x: 0, y: 0, width: this.width, height: this.height },
          });

          // Race against a 5-second timeout so one slow frame never kills recording
          const frameBuffer = await Promise.race([
            screenshotPromise,
            new Promise((_, reject) => setTimeout(() => reject(new Error('frame timeout')), 5000)),
          ]);

          await this.writeFrame(ffmpegProc, frameBuffer);
          totalFramesCaptured++;

          // Log progress every 25 frames
          if (totalFramesCaptured % 25 === 0) {
            const pct = Math.min(100, Math.round((totalFramesCaptured / totalFrames) * 100));
            process.stdout.write(`\r[AWS] Recording... ${pct}% (${totalFramesCaptured}/${totalFrames} frames)`);
          }
        } catch (err) {
          // Skip this frame (page navigating, or frame timeout) — do not crash
          if (!isRecording) break;
          // Detached frame/page means we should stop entirely
          if (err.message.includes('detached') || err.message.includes('Target closed')) {
            console.warn('[AWS:CaptureLoop] Page detached — stopping capture.');
            break;
          }
          if (err.message !== 'frame timeout') {
            console.error(`[AWS:CaptureError] ${err.message}`);
          }
        }

        // No extra delay — screenshot capture time naturally paces the loop.
        await new Promise((r) => setTimeout(r, 10));
      }
    })();

    // ── Execute action steps ───────────────────────────────────────────
    try {
      await executeSteps(page, steps, browser, {
        stopOnFailure: false,
        onStepComplete: (stepIndex, result) => {
          const status = result.success ? '✓' : '✖';
          this.log(`Step ${stepIndex + 1}: ${status} ${result.message}`);
        },
      });

      // If action execution finishes before audio duration, keep recording
      const elapsedFrames = totalFramesCaptured;
      const remainingFrames = totalFrames - elapsedFrames;
      
      if (remainingFrames > 0) {
        this.log(`Actions complete. Continuing recording for ${remainingFrames} more frames...`);

        // Add subtle mouse jitter while waiting
        const waitMs = remainingFrames * frameInterval;
        const jitterInterval = setInterval(async () => {
          try { await human.naturalMouseJitter(page); } catch { /* ok */ }
        }, 2000);

        await new Promise((r) => setTimeout(r, waitMs));
        clearInterval(jitterInterval);
      }
    } catch (err) {
      this.error('Error during action execution:', err);
    }

    // ── Stop recording and finalize ────────────────────────────────────
    isRecording = false;
    // Give capture loop a moment to finish its last frame
    await new Promise((r) => setTimeout(r, frameInterval * 2));

    this.log(`\nTotal frames captured: ${totalFramesCaptured}`);
    await this.finalizeFFmpeg(ffmpegProc, ffmpegFinished);
    this.log(`Screen recording saved: ${outputPath}`);

    return outputPath;
  }

  /**
   * Clean up — close browser tabs but keep the browser profile alive
   * for session persistence.
   */
  async cleanup() {
    this.log('Cleanup: keeping browser session alive for reuse.');
    // Don't close the browser — just reset state
    // The session manager handles the browser lifecycle
    this._page = null;
    // Note: we intentionally do NOT call sessionManager.closeBrowser()
    // so the next video generation can reuse the session.
  }
}

module.exports = AWSRenderer;
