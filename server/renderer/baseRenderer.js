/**
 * baseRenderer.js
 *
 * Abstract base class that defines the renderer interface.
 * Every renderer (VS Code, AWS, Azure, etc.) must extend this class
 * and implement the abstract methods.
 *
 * Provides shared utilities for FFmpeg frame piping and progress logging.
 */

const path = require('path');
const { spawn } = require('child_process');
const ffmpegPath = require('ffmpeg-static');

class BaseRenderer {
  /**
   * @param {string} name - Human-readable renderer name for logging
   * @param {object} options - Renderer-specific options
   * @param {number} [options.fps=5] - Frames per second for recording
   * @param {number} [options.width=1920] - Viewport width
   * @param {number} [options.height=1080] - Viewport height
   * @param {number} [options.screenshotQuality=82] - JPEG quality (1-100)
   */
  constructor(name, options = {}) {
    if (new.target === BaseRenderer) {
      throw new Error('BaseRenderer is abstract and cannot be instantiated directly.');
    }
    this.name = name;
    this.fps = options.fps || 5;
    this.width = options.width || 1920;
    this.height = options.height || 1080;
    this.screenshotQuality = options.screenshotQuality || 82;
    this._browser = null;
    this._ffmpegProc = null;
    this._ffmpegClosed = false;
  }

  /**
   * Initialize the renderer (launch browser, load templates, etc.)
   * Must be implemented by subclasses.
   * @abstract
   */
  async initialize() {
    throw new Error('initialize() must be implemented by subclass.');
  }

  /**
   * Render the video content.
   * Must be implemented by subclasses.
   * @abstract
   * @param {Array} slides - Slide/step data from Gemini
   * @param {Array} durations - Audio durations per slide (seconds)
   * @param {string} outputPath - Output path for the silent screen-recording .mp4
   * @returns {Promise<string>} - Resolves with outputPath when done
   */
  async renderVideo(slides, durations, outputPath) {
    throw new Error('renderVideo() must be implemented by subclass.');
  }

  /**
   * Clean up resources (close browser, kill processes, etc.)
   * Must be implemented by subclasses.
   * @abstract
   */
  async cleanup() {
    throw new Error('cleanup() must be implemented by subclass.');
  }

  // ── Shared Utilities ─────────────────────────────────────────────────

  /**
   * Start an FFmpeg process that accepts JPEG frames via stdin.
   * @param {string} outputPath - Path for the output .mp4
   * @returns {{ proc: ChildProcess, finished: Promise<void> }}
   */
  startFFmpegPipeline(outputPath) {
    const args = [
      '-y',
      '-f', 'image2pipe',
      '-vcodec', 'mjpeg',
      '-r', String(this.fps),
      '-i', 'pipe:0',
      '-vf', `scale=${this.width}:${this.height}`,
      '-c:v', 'libx264',
      '-preset', 'ultrafast',
      '-tune', 'stillimage',
      '-pix_fmt', 'yuv420p',
      '-threads', '0',
      outputPath,
    ];

    const proc = spawn(ffmpegPath, args);
    this._ffmpegProc = proc;
    this._ffmpegClosed = false;

    proc.stderr.on('data', (data) => {
      const msg = data.toString();
      if (msg.includes('fps') || msg.includes('frame')) {
        process.stdout.write(`\r[${this.name}:FFmpeg] ${msg.split('\n')[0]}`);
      }
    });

    const finished = new Promise((resolve, reject) => {
      proc.on('close', (code) => {
        this._ffmpegClosed = true;
        if (code === 0) resolve();
        else reject(new Error(`FFmpeg exited with code ${code}`));
      });
      proc.on('error', (err) => {
        reject(new Error('FFmpeg process error: ' + err.message));
      });
    });

    return { proc, finished };
  }

  /**
   * Write a screenshot frame buffer to the FFmpeg stdin pipe.
   * Handles back-pressure automatically.
   * @param {ChildProcess} proc - The FFmpeg process
   * @param {Buffer} frameBuffer - JPEG frame data
   */
  async writeFrame(proc, frameBuffer) {
    const written = proc.stdin.write(frameBuffer);
    if (!written) {
      await new Promise((resolve) => proc.stdin.once('drain', resolve));
    }
  }

  /**
   * Finalize the FFmpeg pipeline — close stdin and wait for exit.
   * @param {ChildProcess} proc - The FFmpeg process
   * @param {Promise<void>} finished - The promise returned by startFFmpegPipeline
   */
  async finalizeFFmpeg(proc, finished) {
    proc.stdin.end();
    await finished;
    this.log('FFmpeg encoding complete.');
  }

  /**
   * Kill the FFmpeg process if it's still running.
   * @param {ChildProcess} proc - The FFmpeg process
   */
  killFFmpeg(proc) {
    if (!this._ffmpegClosed && proc) {
      proc.stdin.end();
      proc.kill('SIGKILL');
    }
  }

  /**
   * Log a message with the renderer name prefix.
   * @param {string} message
   */
  log(message) {
    console.log(`[${this.name}] ${message}`);
  }

  /**
   * Log a warning with the renderer name prefix.
   * @param {string} message
   */
  warn(message) {
    console.warn(`[${this.name}] ⚠ ${message}`);
  }

  /**
   * Log an error with the renderer name prefix.
   * @param {string} message
   * @param {Error} [err]
   */
  error(message, err) {
    console.error(`[${this.name}] ✖ ${message}`, err || '');
  }
}

module.exports = BaseRenderer;
