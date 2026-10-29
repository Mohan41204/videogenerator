/**
 * board.service.js
 *
 * Phase 1: Board (whiteboard drawing) renderer.
 *
 * Renders a sequence of stroke items on a transparent HTML5 <canvas> element
 * inside a headless Puppeteer page.  Each stroke item is progressively drawn
 * over a timeline, producing one PNG per frame at VIDEO_RENDER_FPS_BOARD fps.
 *
 * ─── DATA MODEL ──────────────────────────────────────────────────────────────
 *
 *  board: {
 *    heading?:  string          // optional, max 4 words, drawn as the first stroke item
 *    width?:    number          // logical canvas width  (default 1280)
 *    height?:   number          // logical canvas height (default 720)
 *    strokes:   StrokeItem[]
 *  }
 *
 *  StrokeItem = one of:
 *
 *    { type:"path", id, points:[{x,y},...], color, width, sentenceIndex? }
 *        Free-hand path.  Drawn with quadratic curves for smoothness.
 *
 *    { type:"line", id, x1, y1, x2, y2, color, width, sentenceIndex? }
 *        Straight line.
 *
 *    { type:"arrow", id, x1, y1, x2, y2, color, width, sentenceIndex? }
 *        Straight line with an arrowhead at (x2,y2).
 *
 *    { type:"rect", id, x, y, w, h, color, width, fill?, sentenceIndex? }
 *        Rectangle (outline or filled).
 *
 *    { type:"ellipse", id, cx, cy, rx, ry, color, width, fill?, sentenceIndex? }
 *        Ellipse (outline or filled).
 *
 *    { type:"text", id, x, y, text, color, fontSize?, fontWeight?, sentenceIndex? }
 *        Static text label.  fontSize defaults to 28.
 *
 *  ─── sentenceIndex ───
 *  Optional 0-based index linking the stroke to a narration sentence.
 *  Used later (Phase 2+) to time appearance against TTS chunks.
 *  If omitted, the stroke is drawn in its natural array order during the
 *  proportional-time animation.
 *
 * ─── RENDERING STRATEGY ─────────────────────────────────────────────────────
 *
 *  • Transparent canvas background (no white fill, no grid).
 *  • Heading (if present) is the first stroke item (type:"text") rendered
 *    before the user-defined strokes.  Skip it if the caller already has
 *    a slide heading that duplicates it.
 *  • Strokes are animated in array order proportionally across the slide
 *    duration.  Each stroke "draws in" from 0 % → 100 % over its slice of
 *    the total time.
 *  • PNG output has an alpha channel so later compositing can overlay it
 *    on top of a slide background or video frame.
 */

const path = require('path');
const fs   = require('fs');

// ─── Constants ───────────────────────────────────────────────────────────────

const DEFAULT_BOARD_WIDTH  = 1280;
const DEFAULT_BOARD_HEIGHT = 720;

// ─── Validation helpers ──────────────────────────────────────────────────────

/**
 * Validate and normalise a board object.
 * Throws on invalid structure, returns a clean copy.
 */
function validateBoard(board) {
  if (!board || typeof board !== 'object') {
    throw new Error('board must be a non-null object');
  }

  const clean = {
    width:   Math.max(100, parseInt(board.width,  10) || DEFAULT_BOARD_WIDTH),
    height:  Math.max(100, parseInt(board.height, 10) || DEFAULT_BOARD_HEIGHT),
    strokes: [],
  };

  // Optional heading — max 4 words
  if (board.heading && typeof board.heading === 'string') {
    const words = board.heading.trim().split(/\s+/);
    if (words.length > 4) {
      throw new Error(`board.heading must be at most 4 words (got ${words.length})`);
    }
    clean.heading = words.join(' ');
  }

  // Whiteboard drawing style configuration
  if (board.drawingStyle) clean.drawingStyle = board.drawingStyle;
  if (typeof board.roughness === 'number') clean.roughness = board.roughness;
  if (typeof board.bowing === 'number') clean.bowing = board.bowing;
  if (typeof board.strokeWidthVariation === 'number') clean.strokeWidthVariation = board.strokeWidthVariation;
  if (typeof board.doubleStroke === 'boolean') clean.doubleStroke = board.doubleStroke;
  if (typeof board.seed === 'number' || typeof board.seed === 'string') clean.seed = board.seed;

  if (!Array.isArray(board.strokes) || board.strokes.length === 0) {
    throw new Error('board.strokes must be a non-empty array');
  }

  const validTypes = ['path', 'line', 'arrow', 'rect', 'ellipse', 'text'];

  for (let i = 0; i < board.strokes.length; i++) {
    const s = board.strokes[i];
    if (!s || !validTypes.includes(s.type)) {
      throw new Error(`board.strokes[${i}]: invalid or missing type "${s?.type}". Must be one of: ${validTypes.join(', ')}`);
    }

    // Common defaults
    const base = {
      type:  s.type,
      id:    s.id || `stroke_${i}`,
      color: s.color || '#1e293b',
      width: Math.max(1, parseFloat(s.width) || 3),
    };
    if (typeof s.sentenceIndex === 'number' && s.sentenceIndex >= 0) {
      base.sentenceIndex = s.sentenceIndex;
    }

    switch (s.type) {
      case 'path': {
        if (!Array.isArray(s.points) || s.points.length < 2) {
          throw new Error(`board.strokes[${i}] (path): needs ≥ 2 points`);
        }
        base.points = s.points.map(p => ({
          x: parseFloat(p.x) || 0,
          y: parseFloat(p.y) || 0,
        }));
        break;
      }
      case 'line':
      case 'arrow': {
        base.x1 = parseFloat(s.x1) || 0;
        base.y1 = parseFloat(s.y1) || 0;
        base.x2 = parseFloat(s.x2) || 0;
        base.y2 = parseFloat(s.y2) || 0;
        break;
      }
      case 'rect': {
        base.x = parseFloat(s.x) || 0;
        base.y = parseFloat(s.y) || 0;
        base.w = parseFloat(s.w) || 100;
        base.h = parseFloat(s.h) || 60;
        if (s.fill) base.fill = String(s.fill);
        break;
      }
      case 'ellipse': {
        base.cx = parseFloat(s.cx) || 0;
        base.cy = parseFloat(s.cy) || 0;
        base.rx = parseFloat(s.rx) || 50;
        base.ry = parseFloat(s.ry) || 50;
        if (s.fill) base.fill = String(s.fill);
        break;
      }
      case 'text': {
        base.x = parseFloat(s.x) || 0;
        base.y = parseFloat(s.y) || 0;
        base.text = String(s.text || '');
        base.fontSize   = Math.max(8, parseInt(s.fontSize, 10) || 28);
        base.fontWeight  = s.fontWeight || '600';
        // Text strokes don't use stroke-width in the same way
        delete base.width;
        break;
      }
    }

    clean.strokes.push(base);
  }

  return clean;
}

/**
 * Build the "heading stroke" that is prepended to the strokes array.
 * Centered near the top of the canvas.
 */
function buildHeadingStroke(heading, canvasWidth) {
  return {
    type:       'text',
    id:         '__board_heading',
    x:          canvasWidth / 2,
    y:          52,
    text:       heading,
    color:      '#0f172a',
    fontSize:   42,
    fontWeight: '800',
  };
}

// ─── Canvas drawing code (injected into Puppeteer page) ──────────────────────

/**
 * Returns a self-contained JS string that, when evaluated inside a Puppeteer
 * page, installs `window.__drawBoard(strokes, progress)` which draws all
 * strokes up to the given progress (0..1) onto a <canvas id="board-canvas">.
 */
function getBoardDrawScript() {
  // This entire function body becomes a string that runs inside the browser.
  return `
(function() {
  // ── helpers ─────────────────────────────────────
  function lerp(a, b, t) { return a + (b - a) * t; }

  function drawArrowhead(ctx, x1, y1, x2, y2, size) {
    var angle = Math.atan2(y2 - y1, x2 - x1);
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - size * Math.cos(angle - Math.PI / 6),
               y2 - size * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(x2 - size * Math.cos(angle + Math.PI / 6),
               y2 - size * Math.sin(angle + Math.PI / 6));
    ctx.closePath();
    ctx.fill();
  }

  // ── main draw function ──────────────────────────
  // progress: 0..1 across entire slide duration
  // strokes: array of stroke items (already validated)
  window.__drawBoard = function(strokes, progress) {
    var canvas = document.getElementById('board-canvas');
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    var W = canvas.width;
    var H = canvas.height;

    // Clear to fully transparent
    ctx.clearRect(0, 0, W, H);

    if (!strokes || strokes.length === 0) return;

    var n = strokes.length;
    // Each stroke gets an equal slice of the timeline
    var sliceSize = 1.0 / n;

    for (var i = 0; i < n; i++) {
      var strokeStart = i * sliceSize;
      var strokeEnd   = strokeStart + sliceSize;

      // How far through THIS stroke's animation are we?
      if (progress <= strokeStart) continue; // not started yet

      var t = Math.min(1, (progress - strokeStart) / sliceSize);
      var s = strokes[i];

      ctx.save();

      switch (s.type) {
        case 'path': {
          ctx.strokeStyle = s.color;
          ctx.lineWidth   = s.width;
          ctx.lineCap     = 'round';
          ctx.lineJoin    = 'round';

          var pts = s.points;
          var totalPts = pts.length;
          var drawUpTo = Math.max(1, Math.floor(t * totalPts));

          ctx.beginPath();
          ctx.moveTo(pts[0].x, pts[0].y);
          for (var p = 1; p < drawUpTo; p++) {
            if (p < totalPts - 1) {
              // Quadratic smoothing
              var cpx = pts[p].x;
              var cpy = pts[p].y;
              var epx = (pts[p].x + pts[p+1].x) / 2;
              var epy = (pts[p].y + pts[p+1].y) / 2;
              ctx.quadraticCurveTo(cpx, cpy, epx, epy);
            } else {
              ctx.lineTo(pts[p].x, pts[p].y);
            }
          }
          ctx.stroke();
          break;
        }

        case 'line': {
          ctx.strokeStyle = s.color;
          ctx.lineWidth   = s.width;
          ctx.lineCap     = 'round';
          ctx.beginPath();
          ctx.moveTo(s.x1, s.y1);
          ctx.lineTo(lerp(s.x1, s.x2, t), lerp(s.y1, s.y2, t));
          ctx.stroke();
          break;
        }

        case 'arrow': {
          ctx.strokeStyle = s.color;
          ctx.fillStyle   = s.color;
          ctx.lineWidth   = s.width;
          ctx.lineCap     = 'round';
          var ex = lerp(s.x1, s.x2, t);
          var ey = lerp(s.y1, s.y2, t);
          ctx.beginPath();
          ctx.moveTo(s.x1, s.y1);
          ctx.lineTo(ex, ey);
          ctx.stroke();
          // Draw arrowhead only when fully drawn
          if (t >= 0.95) {
            drawArrowhead(ctx, s.x1, s.y1, s.x2, s.y2, 14);
          }
          break;
        }

        case 'rect': {
          if (s.fill && t >= 1) {
            ctx.fillStyle = s.fill;
            ctx.fillRect(s.x, s.y, s.w, s.h);
          }
          ctx.strokeStyle = s.color;
          ctx.lineWidth   = s.width;
          ctx.lineJoin    = 'round';
          // Draw perimeter progressively (total perimeter = 2w + 2h)
          var perim = 2 * s.w + 2 * s.h;
          var drawn = t * perim;
          ctx.beginPath();
          // Start top-left, go clockwise
          var segs = [
            { dx: s.w, dy: 0 },
            { dx: 0,   dy: s.h },
            { dx: -s.w, dy: 0 },
            { dx: 0,   dy: -s.h }
          ];
          var segLens = [s.w, s.h, s.w, s.h];
          var cx = s.x, cy = s.y;
          ctx.moveTo(cx, cy);
          var remaining = drawn;
          for (var si = 0; si < 4 && remaining > 0; si++) {
            var segLen = segLens[si];
            var segT = Math.min(1, remaining / segLen);
            cx += segs[si].dx * segT;
            cy += segs[si].dy * segT;
            ctx.lineTo(cx, cy);
            remaining -= segLen;
          }
          ctx.stroke();
          break;
        }

        case 'ellipse': {
          if (s.fill && t >= 1) {
            ctx.fillStyle = s.fill;
            ctx.beginPath();
            ctx.ellipse(s.cx, s.cy, s.rx, s.ry, 0, 0, 2 * Math.PI);
            ctx.fill();
          }
          ctx.strokeStyle = s.color;
          ctx.lineWidth   = s.width;
          ctx.beginPath();
          ctx.ellipse(s.cx, s.cy, s.rx, s.ry, 0, 0, 2 * Math.PI * t);
          ctx.stroke();
          break;
        }

        case 'text': {
          var fontSize = s.fontSize || 28;
          var fontWeight = s.fontWeight || '600';
          ctx.font = fontWeight + ' ' + fontSize + 'px "Outfit", "Inter", "Segoe UI", sans-serif';
          ctx.fillStyle = s.color;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          // Reveal characters progressively
          var fullText = s.text || '';
          var showChars = Math.max(1, Math.floor(t * fullText.length));
          ctx.fillText(fullText.substring(0, showChars), s.x, s.y);
          break;
        }
      }

      ctx.restore();
    }
  };
})();
`;
}

// ─── Board HTML page ─────────────────────────────────────────────────────────

/**
 * Returns a minimal self-contained HTML page with a transparent <canvas>
 * and the board drawing script pre-loaded.
 * Fonts are loaded from Google Fonts so text rendering is consistent.
 */
function getBoardHtml(width, height) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Board Preview</title>
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body {
    width:  ${width}px;
    height: ${height}px;
    overflow: hidden;
    background: transparent;
  }
  canvas {
    display: block;
  }
</style>
</head>
<body>
<canvas id="board-canvas" width="${width}" height="${height}"></canvas>
<script>
${getBoardDrawScript()}
</script>
</body>
</html>`;
}

// ─── PNG rendering (Puppeteer) ───────────────────────────────────────────────

/**
 * Render a board into a sequence of PNG frames.
 *
 * @param {Object} board           – Validated board object
 * @param {number} durationSecs    – Total slide duration in seconds
 * @param {string} outDir          – Directory to write frame PNGs into
 * @param {Object} [opts]
 * @param {number} [opts.fps]      – Frames per second (default: VIDEO_RENDER_FPS_BOARD || 8)
 * @param {boolean} [opts.skipHeading] – If true, don't prepend the heading stroke
 * @returns {Promise<{ frames: string[], fps: number, duration: number }>}
 */
async function renderBoardFrames(board, durationSecs, outDir, opts = {}) {
  const puppeteer = require('puppeteer');

  const validated = validateBoard(board);
  const fps = opts.fps || parseInt(process.env.VIDEO_RENDER_FPS_BOARD, 10) || 8;
  const totalFrames = Math.max(1, Math.ceil(durationSecs * fps));

  // Build final strokes list: optional heading first, then user strokes
  const allStrokes = [];
  if (validated.heading && !opts.skipHeading) {
    allStrokes.push(buildHeadingStroke(validated.heading, validated.width));
  }
  allStrokes.push(...validated.strokes);

  // Ensure output directory
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  console.log(`[Board] Rendering ${totalFrames} frames at ${fps}fps (${durationSecs}s) – ${allStrokes.length} strokes, canvas ${validated.width}×${validated.height}`);

  // Launch browser
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

  // Try to find a Chrome/Chromium executable
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
  await page.setViewport({
    width:  validated.width,
    height: validated.height,
    deviceScaleFactor: 1,
  });

  // Load the board HTML
  const html = getBoardHtml(validated.width, validated.height);
  await page.setContent(html, { waitUntil: 'networkidle0' });

  // Verify __drawBoard is ready
  await page.waitForFunction(() => typeof window.__drawBoard === 'function', { timeout: 15000 });
  console.log('[Board] Canvas page ready, starting frame capture...');

  const framePaths = [];
  const startTime = Date.now();

  for (let f = 0; f < totalFrames; f++) {
    const progress = totalFrames === 1 ? 1 : f / (totalFrames - 1);

    // Draw the strokes at this progress point
    await page.evaluate((strokes, prog) => {
      window.__drawBoard(strokes, prog);
    }, allStrokes, progress);

    // Screenshot with transparency (PNG)
    const frameName = `frame_${String(f).padStart(5, '0')}.png`;
    const framePath = path.join(outDir, frameName);

    await page.screenshot({
      type: 'png',
      omitBackground: true,   // transparent background
      clip: { x: 0, y: 0, width: validated.width, height: validated.height },
      path: framePath,
    });

    framePaths.push(framePath);

    if ((f + 1) % 10 === 0 || f === totalFrames - 1) {
      const pct = Math.round(((f + 1) / totalFrames) * 100);
      console.log(`[Board] Frame ${f + 1}/${totalFrames} (${pct}%)`);
    }
  }

  await browser.close();

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`[Board] Done – ${framePaths.length} PNGs in ${elapsed}s`);

  return {
    frames:   framePaths,
    fps,
    duration: durationSecs,
  };
}

// ─── Exports ─────────────────────────────────────────────────────────────────

module.exports = {
  validateBoard,
  buildHeadingStroke,
  getBoardDrawScript,
  getBoardHtml,
  renderBoardFrames,
  DEFAULT_BOARD_WIDTH,
  DEFAULT_BOARD_HEIGHT,
};
