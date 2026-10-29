#!/usr/bin/env node
/**
 * board-preview.js
 *
 * Standalone Puppeteer test tool for Phase 1 Whiteboard Drawing Board.
 * Loads `server/templates/screen_share.html`, invokes `loadSlide(slide)`,
 * and renders stroke-animation PNG frames via `renderFrame(elapsed, duration)`.
 *
 * Usage:
 *   node scripts/board-preview.js                                    # default binary search, 5s
 *   node scripts/board-preview.js scripts/mock/mock-binary-search.json 5
 *   node scripts/board-preview.js scripts/mock/mock-flowchart.json 6
 *   node scripts/board-preview.js scripts/mock/mock-architecture.json 6
 *   node scripts/board-preview.js scripts/mock/mock-concept.json 6
 *
 * Flags:
 *   --full   Capture full 1920x1080 screen share window instead of canvas only
 *
 * Output: server/output/board-preview/frame_00000.png ... frame_NNNNN.png
 */

const path = require('path');
const fs = require('fs');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const puppeteer = require('puppeteer');

async function main() {
  const args = process.argv.slice(2).filter(a => !a.startsWith('--'));
  const captureFull = process.argv.includes('--full');

  let slidePath = path.join(__dirname, 'mock/mock-binary-search.json');
  let durationSecs = 5;

  if (args[0]) {
    slidePath = path.resolve(args[0]);
  }
  if (args[1]) {
    durationSecs = parseFloat(args[1]) || 5;
  }

  if (!fs.existsSync(slidePath)) {
    console.error(`[board-preview] Slide file not found: ${slidePath}`);
    process.exit(1);
  }

  const slide = JSON.parse(fs.readFileSync(slidePath, 'utf8'));
  console.log(`[board-preview] Loaded slide: "${slide.heading}"`);

  // Target FPS: VIDEO_RENDER_FPS_BOARD or default 8
  const fps = parseInt(process.env.VIDEO_RENDER_FPS_BOARD, 10) || 8;
  const totalFrames = Math.max(1, Math.ceil(durationSecs * fps));

  const outDir = path.join(__dirname, '../output/board-preview');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  } else {
    // Clean old frames
    const old = fs.readdirSync(outDir).filter(f => f.endsWith('.png'));
    for (const f of old) fs.unlinkSync(path.join(outDir, f));
  }

  console.log(`[board-preview] Rendering ${totalFrames} frames at ${fps} FPS (${durationSecs}s)`);
  console.log(`[board-preview] Output directory: ${outDir}`);

  // Puppeteer launch configuration
  const launchOpts = {
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-web-security',
      '--allow-file-access-from-files',
      '--disable-dev-shm-usage',
    ],
  };

  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    launchOpts.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
  } else if (process.platform === 'win32') {
    const winPaths = [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    ];
    for (const p of winPaths) {
      if (p && fs.existsSync(p)) { launchOpts.executablePath = p; break; }
    }
  }

  const browser = await puppeteer.launch(launchOpts);
  const page = await browser.newPage();

  // Full HD 1920x1080 screen share resolution
  await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });

  const templatePath = path.join(__dirname, '../templates/screen_share.html');
  const templateUri = 'file:///' + templatePath.replace(/\\/g, '/');

  await page.goto(templateUri, { waitUntil: 'load' });

  // Wait for fonts to be ready
  await page.evaluateHandle('document.fonts.ready');

  // Verify loadSlide and renderFrame are available
  await page.waitForFunction(() => typeof window.loadSlide === 'function' && typeof window.renderFrame === 'function', { timeout: 10000 });

  // Load the mock slide into screen_share.html
  await page.evaluate((s) => {
    window.loadSlide(s);
  }, slide);

  // Give the DOM / canvas a brief tick to layout
  await new Promise(r => setTimeout(r, 100));

  const canvasEl = await page.$('#board-canvas');
  if (!canvasEl) {
    console.error('[board-preview] Error: #board-canvas element not found in DOM.');
    await browser.close();
    process.exit(1);
  }

  console.log('[board-preview] Template initialized. Capturing animation frames...');

  const startTime = Date.now();
  const frames = [];

  for (let f = 0; f < totalFrames; f++) {
    const elapsed = (f / (totalFrames - 1 || 1)) * durationSecs;

    // Call renderFrame on the page
    await page.evaluate((e, dur) => {
      window.renderFrame(e, dur);
    }, elapsed, durationSecs);

    const frameName = `frame_${String(f).padStart(5, '0')}.png`;
    const framePath = path.join(outDir, frameName);

    if (captureFull) {
      // Capture the full split screen share view
      await page.screenshot({
        type: 'png',
        path: framePath,
        clip: { x: 0, y: 0, width: 1920, height: 1080 }
      });
    } else {
      // Capture the transparent board canvas
      await canvasEl.screenshot({
        type: 'png',
        omitBackground: true,
        path: framePath
      });
    }

    frames.push(framePath);

    if ((f + 1) % 10 === 0 || f === totalFrames - 1) {
      const pct = Math.round(((f + 1) / totalFrames) * 100);
      console.log(`[board-preview] Frame ${f + 1}/${totalFrames} (${pct}%)`);
    }
  }

  // Also save a snapshot of the full composite slide at the end for visual inspection
  const fullSnapshotPath = path.join(outDir, 'composite_final_slide.png');
  await page.screenshot({ type: 'png', path: fullSnapshotPath });

  await browser.close();

  const renderTimeSec = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log('\n======================================================');
  console.log('  Board Preview Complete');
  console.log(`  Slide:        ${slide.heading}`);
  console.log(`  Frames:       ${frames.length} PNGs at ${fps} FPS`);
  console.log(`  Duration:     ${durationSecs}s (Rendered in ${renderTimeSec}s)`);
  console.log(`  Output dir:   ${outDir}`);
  console.log(`  First frame:  ${frames[0]}`);
  console.log(`  Last frame:   ${frames[frames.length - 1]}`);
  console.log(`  Full slide:   ${fullSnapshotPath}`);
  console.log('======================================================\n');
}

main().catch(err => {
  console.error('[board-preview] Fatal error:', err);
  process.exit(1);
});
