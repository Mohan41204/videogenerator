/**
 * puppeteer.service.js
 *
 * Renders an animated "Online Class Screen-Share" video by:
 * 1. Loading screen_share.html in headless Chromium (via Puppeteer)
 * 2. For each slide: injecting slide data and calling window.renderFrame() per frame
 *    - For normal slides  → animated Notepad / VS Code template
 *    - For diagram slides → Mermaid rendered INSIDE this same page (no new browser)
 * 3. Piping JPEG screenshots directly to FFmpeg stdin to build raw screen video
 *
 * The result is a silent .mp4 screen-recording that must then be merged with audio.
 */

const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const ffmpegPath = require('../utils/ffmpegPath');
const diagramService = require('./diagram.service');

// FPS for the rendered video. 3fps is ideal for screen-share/typing content —
// smooth enough visually, fast enough to render quickly.
const FPS = 3;

/**
 * Render all slides into a silent screen-share MP4 video.
 * @param {Array}  slides     - Array of slide objects from Gemini
 * @param {Array}  durations  - Array of audio durations in seconds (one per slide)
 * @param {string} videoPath  - Output path for the silent screen-recording .mp4
 * @returns {Promise<string>} - Resolves with videoPath when done
 */
const findChromeInCache = () => {
  const searchDirs = [
    path.join(__dirname, '../.cache'),
    path.join(process.cwd(), '.cache'),
    '/opt/render/project/src/server/.cache'
  ];

  for (const baseDir of searchDirs) {
    if (fs.existsSync(baseDir)) {
      const findChromeRecursive = (dir) => {
        try {
          const entries = fs.readdirSync(dir, { withFileTypes: true });
          for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
              const found = findChromeRecursive(fullPath);
              if (found) return found;
            } else if (entry.name === 'chrome' || entry.name === 'chrome.exe') {
              return fullPath;
            }
          }
        } catch (e) {
          // Ignore read errors
        }
        return null;
      };
      const found = findChromeRecursive(baseDir);
      if (found) return found;
    }
  }
  return null;
};

const renderScreenShareVideo = async (slides, durations, videoPath) => {
  let puppeteer;
  try {
    puppeteer = require('puppeteer');
  } catch (e) {
    throw new Error(
      'Puppeteer is not installed. Please run: npm install puppeteer\n' +
      'in the server directory, then restart the server.'
    );
  }

  console.log('[Puppeteer] Launching headless browser...');

  const launchOptions = {
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-web-security',
      '--allow-file-access-from-files',
      '--disable-features=VizDisplayCompositor',
      '--disable-gpu',
      '--window-size=1280,720'
    ]
  };

  console.log('[Puppeteer] Resolving Chromium executable path...');
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    launchOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
    console.log(`[Puppeteer] Using PUPPETEER_EXECUTABLE_PATH env: ${launchOptions.executablePath}`);
  } else {
    try {
      const chromium = require('@sparticuz/chromium');
      launchOptions.executablePath = await chromium.executablePath();
      if (chromium.args) {
        launchOptions.args = [...new Set([...launchOptions.args, ...chromium.args])];
      }
      console.log(`[Puppeteer] Using @sparticuz/chromium binary at ${launchOptions.executablePath}`);
    } catch (e) {
      console.warn(`[Puppeteer] @sparticuz/chromium resolution failed: ${e.message}. Checking system Chrome paths...`);
      const possiblePaths = [
        '/usr/bin/google-chrome-stable',
        '/usr/bin/google-chrome',
        '/usr/bin/chromium-browser',
        '/usr/bin/chromium'
      ];
      for (const chromePath of possiblePaths) {
        if (fs.existsSync(chromePath)) {
          launchOptions.executablePath = chromePath;
          console.log(`[Puppeteer] Using system Chrome binary at ${chromePath}`);
          break;
        }
      }

      if (!launchOptions.executablePath) {
        const cachedChrome = findChromeInCache();
        if (cachedChrome) {
          launchOptions.executablePath = cachedChrome;
          console.log(`[Puppeteer] Found Chrome binary in project cache at ${cachedChrome}`);
        }
      }
    }
  }

  console.log(`[Puppeteer] Launching browser process with executable: ${launchOptions.executablePath || 'default Puppeteer Chromium'}...`);
  const launchStartTime = Date.now();
  const browser = await puppeteer.launch(launchOptions);
  console.log(`[Puppeteer] Browser process launched successfully in ${Date.now() - launchStartTime}ms.`);

  console.log('[Puppeteer] Creating new browser page...');
  const page = await browser.newPage();
  page.setDefaultNavigationTimeout(90000);
  page.setDefaultTimeout(90000);
  await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 });
  console.log('[Puppeteer] Browser page created and viewport configured (1280x720, deviceScaleFactor: 1).');

  // Load the screen-share HTML template
  const templatePath = path.join(__dirname, '../templates/screen_share.html');
  const templateUrl = 'file:///' + templatePath.replace(/\\/g, '/');
  console.log(`[Puppeteer] Navigating to template URL: ${templateUrl}...`);
  await page.goto(templateUrl, { waitUntil: 'domcontentloaded', timeout: 90000 });
  console.log('[Puppeteer] Template HTML loaded (domcontentloaded).');

  // Make sure the animation API is ready
  console.log('[Puppeteer] Waiting for window.loadSlide and window.renderFrame animation functions...');
  await page.waitForFunction(() => typeof window.loadSlide === 'function' && typeof window.renderFrame === 'function', { timeout: 90000 });
  console.log('[Puppeteer] Template loaded, animation engine ready.');

  // Reset diagram injection flag for this new session
  diagramService.reset();

  // --- Start FFmpeg process receiving JPEG frames via stdin ---
  const totalDurationSecs = durations.reduce((a, b) => a + b, 0);
  const totalFrames = Math.ceil(totalDurationSecs * FPS);
  console.log(`[Puppeteer] Rendering ${totalFrames} frames at ${FPS}fps for ${totalDurationSecs.toFixed(1)}s video...`);

  const ffmpegArgs = [
    '-y',
    '-f', 'image2pipe',
    '-vcodec', 'mjpeg',
    '-r', String(FPS),
    '-i', 'pipe:0',
    '-c:v', 'libx264',
    '-preset', 'ultrafast',
    '-tune', 'stillimage',
    '-pix_fmt', 'yuv420p',
    '-threads', '0',
    videoPath
  ];

  console.log(`[FFmpeg] Spawning process: ${ffmpegPath} ${ffmpegArgs.join(' ')}`);
  console.log(`[FFmpeg] Configuration: stdin=pipe:0, input_format=mjpeg, output_fps=${FPS}, target_resolution=1280x720, codec=libx264 (preset=ultrafast), total_expected_frames=${totalFrames}`);
  const ffmpegStartTime = Date.now();

  const ffmpegProc = spawn(ffmpegPath, ffmpegArgs);
  console.log(`[FFmpeg] Process spawned successfully (PID: ${ffmpegProc.pid || 'unknown'}).`);

  ffmpegProc.stderr.on('data', (data) => {
    const msg = data.toString();
    if (msg.includes('fps') || msg.includes('frame')) {
      process.stdout.write('\r[FFmpeg] ' + msg.split('\n')[0]);
    }
  });

  let ffmpegClosed = false;
  const ffmpegFinished = new Promise((resolve, reject) => {
    ffmpegProc.on('close', (code, signal) => {
      ffmpegClosed = true;
      const durationSec = ((Date.now() - ffmpegStartTime) / 1000).toFixed(2);
      console.log(`\n[FFmpeg] Process exited after ${durationSec}s with code ${code} (signal: ${signal})`);
      if (code === 0 || code === null) {
        resolve();
      } else {
        reject(new Error(`FFmpeg process exited with code ${code} (signal: ${signal})`));
      }
    });
    ffmpegProc.on('error', (err) => {
      console.error(`\n[FFmpeg] Process error event: ${err.message}`);
      reject(new Error('FFmpeg process error: ' + err.message));
    });
  });
  
  // Prevent UnhandledPromiseRejection if FFmpeg crashes while we're not awaiting it:
  ffmpegFinished.catch(() => {});

  // --- Render each slide frame by frame ---
  try {
    let prevIsCode = null;
    let globalFrameCounter = 0;

    for (let slideIdx = 0; slideIdx < slides.length; slideIdx++) {
      const slide = slides[slideIdx];
      const duration = durations[slideIdx];
      const slideTotalFrames = Math.ceil(duration * FPS);

      console.log(`\n[Puppeteer] Slide ${slideIdx + 1}/${slides.length}: "${slide.heading}" (${duration.toFixed(1)}s, ${slideTotalFrames} frames)`);

      // Synchronize visualTiming appearAtSecond with actual TTS audio duration
      if (slide.visualTiming && slide.visualTiming.enabled !== false && typeof slide.visualTiming.appearAtSecond === 'number') {
        const estimatedTotal = slide.estimatedDurationSeconds || duration;
        const ratio = Math.max(0.15, Math.min(0.75, slide.visualTiming.appearAtSecond / estimatedTotal));
        slide.visualTiming.appearAtSecond = Math.max(2.5, Number((ratio * duration).toFixed(2)));
        console.log(`[Puppeteer]   → Diagram scheduled to reveal at ${slide.visualTiming.appearAtSecond}s (of ${duration.toFixed(1)}s actual duration)`);
      } else if ((slide.isDiagram && slide.mermaid) || (slide.visual && slide.visual.enabled)) {
        // Legacy fallback: reveal after initial intro (~28% of slide duration)
        const fallbackAppear = Math.max(2.5, Number((duration * 0.28).toFixed(2)));
        slide.visualTiming = { enabled: true, appearAtSecond: fallbackAppear };
        console.log(`[Puppeteer]   → Diagram (legacy) scheduled to reveal at ${fallbackAppear}s`);
      }

      // Synchronize realWorldVisualTiming appearAtSecond with actual TTS audio duration
      if (slide.realWorldVisualTiming && slide.realWorldVisualTiming.enabled !== false && typeof slide.realWorldVisualTiming.appearAtSecond === 'number') {
        const estimatedTotal = slide.estimatedDurationSeconds || duration;
        const ratio = Math.max(0.15, Math.min(0.75, slide.realWorldVisualTiming.appearAtSecond / estimatedTotal));
        slide.realWorldVisualTiming.appearAtSecond = Math.max(2.5, Number((ratio * duration).toFixed(2)));
        console.log(`[Puppeteer]   → Real-world scenario image scheduled to reveal at ${slide.realWorldVisualTiming.appearAtSecond}s (of ${duration.toFixed(1)}s actual duration)`);
      } else if (slide.realWorldVisual && slide.realWorldVisual.enabled) {
        const fallbackAppear = Math.max(2.5, Number((duration * 0.28).toFixed(2)));
        slide.realWorldVisualTiming = { enabled: true, appearAtSecond: fallbackAppear };
        console.log(`[Puppeteer]   → Real-world visual scheduled to reveal at ${fallbackAppear}s`);
      }

      // Synchronize individual real-world annotations with actual TTS audio duration
      if (slide.realWorldVisual && Array.isArray(slide.realWorldVisual.annotations)) {
        const estimatedTotal = slide.estimatedDurationSeconds || duration;
        const baseAppear = slide.realWorldVisualTiming ? slide.realWorldVisualTiming.appearAtSecond : 2.5;
        slide.realWorldVisual.annotations.forEach((ann) => {
          if (typeof ann.appearAtSecond === 'number') {
            const ratio = Math.max(0.18, Math.min(0.90, ann.appearAtSecond / estimatedTotal));
            ann.appearAtSecond = Math.max(baseAppear, Number((ratio * duration).toFixed(2)));
          }
        });
      }

      // Ensure real-world image asset exists before loading slide
      if (slide.realWorldVisual && slide.realWorldVisual.enabled && slide.realWorldVisual.imagePrompt && !slide.imagePath) {
        const imageGenService = require('./imageGeneration.service');
        const imagesDir = path.join(__dirname, '../output/images');
        if (!fs.existsSync(imagesDir)) fs.mkdirSync(imagesDir, { recursive: true });
        const fallbackPath = path.join(imagesDir, `render_scene_${slideIdx}_scenario.jpg`);
        try {
          const res = await imageGenService.generateScenarioImage(slide.realWorldVisual.imagePrompt, fallbackPath);
          if (res.success) {
            slide.imagePath = fallbackPath;
          }
        } catch (e) {
          console.warn(`[Puppeteer] Fallback image generation skipped: ${e.message}`);
        }
      }

      // ── LOAD SLIDE ────────────────────────────────────────────────────────
      // Load the slide into the browser
      console.log(`[Puppeteer] Evaluating loadSlide for slide ${slideIdx + 1}...`);
      await page.evaluate((slideData, prevType) => {
        window._prevIsCode = prevType;
        window.loadSlide(slideData);
      }, slide, prevIsCode);
      console.log(`[Puppeteer] slideData loaded into DOM for slide ${slideIdx + 1}.`);

      // If it is a diagram slide, render the Mermaid SVG into the container
      const hasDiagram = (slide.isDiagram && slide.mermaid) || (slide.visual && slide.visual.enabled);
      if (hasDiagram) {
        console.log(`[Puppeteer]   → Rendering diagram for slide ${slideIdx + 1}...`);
        let mermaidCode = slide.mermaid;
        if (!mermaidCode && slide.visual) {
          const teachingEngine = require('./teachingEngine.service');
          mermaidCode = teachingEngine.visualToMermaid(slide.visual);
        }
        if (mermaidCode) {
          try {
            await diagramService.renderMermaidInPage(page, mermaidCode);
          } catch (diagramErr) {
            console.warn(`[Puppeteer] Diagram rendering failed on slide ${slideIdx + 1}: ${diagramErr.message}. Continuing with normal frame capture.`);
          }
        }
      }

      console.log(`[Puppeteer] Starting frame capture for slide ${slideIdx + 1} (${slideTotalFrames} frames)...`);
      // Capture frames for this slide
      for (let f = 0; f < slideTotalFrames; f++) {
        globalFrameCounter++;
        const frameStart = Date.now();
        const elapsedSecs = f / FPS;

        // Tell the browser to render this point in time
        const evaluateStart = Date.now();
        await page.evaluate((elapsed, total) => {
          window.renderFrame(elapsed, total);
        }, elapsedSecs, duration);
        const evaluateTime = Date.now() - evaluateStart;

        // Screenshot as JPEG (much smaller than PNG, fast enough for our FPS)
        const screenshotStart = Date.now();
        const frameBuffer = await page.screenshot({
          type: 'jpeg',
          quality: 75,
          optimizeForSpeed: true,
          clip: { x: 0, y: 0, width: 1280, height: 720 }
        });
        const screenshotTime = Date.now() - screenshotStart;

        // Write frame to FFmpeg stdin with back-pressure handling
        const ffmpegStart = Date.now();
        const canWrite = ffmpegProc.stdin.write(frameBuffer);
        if (!canWrite) {
          await new Promise((resolve, reject) => {
            ffmpegProc.stdin.once('drain', resolve);
            ffmpegProc.stdin.once('error', reject);
          });
        }
        const ffmpegWriteTime = Date.now() - ffmpegStart;
        const totalTime = Date.now() - frameStart;

        console.log(
          `[Frame ${globalFrameCounter}/${totalFrames}] ` +
          `evaluate=${evaluateTime}ms | ` +
          `screenshot=${screenshotTime}ms | ` +
          `ffmpegWrite=${ffmpegWriteTime}ms | ` +
          `total=${totalTime}ms | ` +
          `size=${Math.round(frameBuffer.length / 1024)}KB`
        );
      }

      // Cleanup diagram if it was rendered
      if (hasDiagram) {
        await page.evaluate(() => window.hideDiagram());
      }

      prevIsCode = !!slide.isCode;
    }

    console.log('\n[Puppeteer] All frames rendered. Waiting for FFmpeg to finish encoding...');
    ffmpegProc.stdin.end();
    await ffmpegFinished;
    console.log('[Puppeteer] Screen-recording video complete: ' + videoPath);

  } catch (err) {
    console.error('\n[Puppeteer] Fatal error during rendering:', err);
    // Kill FFmpeg if something went wrong
    if (!ffmpegClosed) {
      ffmpegProc.stdin.end();
      ffmpegProc.kill('SIGKILL');
    }
    throw err;
  } finally {
    await browser.close();
  }

  return videoPath;
};

module.exports = { renderScreenShareVideo };
