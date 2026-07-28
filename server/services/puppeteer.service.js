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
const { spawn } = require('child_process');
const ffmpegPath = require('ffmpeg-static');
const diagramService = require('./diagram.service');

// FPS for the rendered video. 5fps is ideal for screen-share/typing content —
// smooth enough visually, fast enough to render quickly.
const FPS = 5;

/**
 * Render all slides into a silent screen-share MP4 video.
 * @param {Array}  slides     - Array of slide objects from Gemini
 * @param {Array}  durations  - Array of audio durations in seconds (one per slide)
 * @param {string} videoPath  - Output path for the silent screen-recording .mp4
 * @returns {Promise<string>} - Resolves with videoPath when done
 */
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

  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-web-security',
      '--allow-file-access-from-files',
      '--disable-features=VizDisplayCompositor',
      '--disable-gpu',
      '--window-size=1920,1080'
    ]
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });

  // Load the screen-share HTML template
  const templatePath = path.join(__dirname, '../templates/screen_share.html');
  const templateUrl = 'file:///' + templatePath.replace(/\\/g, '/');
  await page.goto(templateUrl, { waitUntil: 'networkidle0' });

  // Make sure the animation API is ready
  await page.waitForFunction(() => typeof window.loadSlide === 'function' && typeof window.renderFrame === 'function');
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
    '-vf', `scale=1920:1080`,
    '-c:v', 'libx264',
    '-preset', 'ultrafast',
    '-tune', 'stillimage',
    '-pix_fmt', 'yuv420p',
    '-threads', '0',
    videoPath
  ];

  const ffmpegProc = spawn(ffmpegPath, ffmpegArgs);

  ffmpegProc.stderr.on('data', (data) => {
    const msg = data.toString();
    if (msg.includes('fps') || msg.includes('frame')) {
      process.stdout.write('\r[FFmpeg] ' + msg.split('\n')[0]);
    }
  });

  let ffmpegClosed = false;
  const ffmpegFinished = new Promise((resolve, reject) => {
    ffmpegProc.on('close', (code) => {
      ffmpegClosed = true;
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`FFmpeg process exited with code ${code}`));
      }
    });
    ffmpegProc.on('error', (err) => {
      reject(new Error('FFmpeg process error: ' + err.message));
    });
  });

  // --- Render each slide frame by frame ---
  try {
    let prevIsCode = null;

    for (let slideIdx = 0; slideIdx < slides.length; slideIdx++) {
      const slide = slides[slideIdx];
      const duration = durations[slideIdx];
      const slideTotalFrames = Math.ceil(duration * FPS);

      console.log(`\n[Puppeteer] Slide ${slideIdx + 1}/${slides.length}: "${slide.heading}" (${duration.toFixed(1)}s, ${slideTotalFrames} frames)`);

      // ── DIAGRAM SLIDE ─────────────────────────────────────────────────────
      // When the LLM marks a slide as isDiagram:true and provides mermaid code,
      // Mermaid is injected into THIS same page (no new browser, no FFmpeg conflict).
      if (slide.isDiagram && slide.mermaid) {
        console.log(`[Puppeteer]   → Rendering Mermaid diagram for slide ${slideIdx + 1}...`);

        // Render Mermaid SVG inside the already-open page and display it.
        // This uses page.addScriptTag (CDN, loaded once) — no second browser spawned.
        await diagramService.renderMermaidInPage(page, slide.mermaid);

        // Hold the diagram frame for the full slide duration
        for (let f = 0; f < slideTotalFrames; f++) {
          const frameBuffer = await page.screenshot({
            type: 'jpeg',
            quality: 82,
            clip: { x: 0, y: 0, width: 1920, height: 1080 }
          });

          const written = ffmpegProc.stdin.write(frameBuffer);
          if (!written) {
            await new Promise((resolve) => ffmpegProc.stdin.once('drain', resolve));
          }

          if (f % 25 === 0) {
            const totalRendered = slides.slice(0, slideIdx).reduce((a, _, i) => a + Math.ceil(durations[i] * FPS), 0) + f;
            const pct = Math.round((totalRendered / totalFrames) * 100);
            process.stdout.write(`\r[Puppeteer] Rendering... ${pct}% (slide ${slideIdx + 1}/${slides.length}, frame ${f}/${slideTotalFrames})`);
          }
        }

        // Restore normal slide view before next slide
        await page.evaluate(() => window.hideDiagram());
        prevIsCode = false;
        continue; // Skip to next slide
      }

      // ── NORMAL SLIDE (Notepad / VS Code) ──────────────────────────────────
      // Load the slide into the browser
      await page.evaluate((slideData, prevType) => {
        window._prevIsCode = prevType;
        window.loadSlide(slideData);
      }, slide, prevIsCode);

      // Capture frames for this slide
      for (let f = 0; f < slideTotalFrames; f++) {
        const elapsedSecs = f / FPS;

        // Tell the browser to render this point in time
        await page.evaluate((elapsed, total) => {
          window.renderFrame(elapsed, total);
        }, elapsedSecs, duration);

        // Screenshot as JPEG (much smaller than PNG, fast enough for our FPS)
        const frameBuffer = await page.screenshot({
          type: 'jpeg',
          quality: 82,
          clip: { x: 0, y: 0, width: 1920, height: 1080 }
        });

        // Write frame to FFmpeg stdin
        const written = ffmpegProc.stdin.write(frameBuffer);

        // Back-pressure handling: if buffer is full, wait for drain
        if (!written) {
          await new Promise((resolve) => ffmpegProc.stdin.once('drain', resolve));
        }

        // Log progress every 25 frames
        if (f % 25 === 0) {
          const totalRendered = slides.slice(0, slideIdx).reduce((a, _, i) => a + Math.ceil(durations[i] * FPS), 0) + f;
          const pct = Math.round((totalRendered / totalFrames) * 100);
          process.stdout.write(`\r[Puppeteer] Rendering... ${pct}% (slide ${slideIdx + 1}/${slides.length}, frame ${f}/${slideTotalFrames})`);
        }
      }

      prevIsCode = !!slide.isCode;
    }

    console.log('\n[Puppeteer] All frames rendered. Waiting for FFmpeg to finish encoding...');
    ffmpegProc.stdin.end();
    await ffmpegFinished;
    console.log('[Puppeteer] Screen-recording video complete: ' + videoPath);

  } catch (err) {
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
