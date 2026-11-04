const fs = require('fs');
const path = require('path');

const targetFile = path.resolve(__dirname, '../templates/screen_share.html');
let content = fs.readFileSync(targetFile, 'utf8');

const isCRLF = content.includes('\r\n');
content = content.replace(/\r\n/g, '\n');

// 1. Add Eraser CSS styles
const cssTarget = '    /* ---- WINDOWS 11 ALT + TAB TASK SWITCHER OVERLAY (AUTHENTIC PIXEL-PERFECT) ---- */';
const eraserCss = `    /* ---- AUTHENTIC MS PAINT ERASER TRANSITION (NOTEPAD TO NOTEPAD) ---- */
    .paint-canvas-sheet {
      position: relative;
    }
    .wb-erase-layer {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: 45;
      background: #ffffff;
      pointer-events: none;
      overflow: hidden;
      box-sizing: border-box;
    }
    .wb-erase-layer.hidden {
      display: none !important;
    }
    .paint-eraser-cursor {
      position: absolute;
      width: 86px;
      height: 86px;
      background: #ffffff;
      border: 1.5px solid #222222;
      box-sizing: border-box;
      pointer-events: none;
      z-index: 60;
      transform: translate(-50%, -50%);
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
    }
    .paint-eraser-cursor.hidden {
      display: none !important;
    }
    .paint-eraser-crosshair {
      width: 11px;
      height: 11px;
      position: relative;
    }
    .paint-eraser-crosshair::before {
      content: '';
      position: absolute;
      top: 5px;
      left: 0;
      width: 11px;
      height: 1px;
      background: #404040;
    }
    .paint-eraser-crosshair::after {
      content: '';
      position: absolute;
      top: 0;
      left: 5px;
      width: 1px;
      height: 11px;
      background: #404040;
    }

`;

if (!content.includes('.paint-eraser-cursor')) {
  content = content.replace(cssTarget, eraserCss + cssTarget);
}

// 2. Add IDs to toolbar buttons
content = content.replace(
  '<button class="ribbon-btn-mini active" type="button" title="Pencil">',
  '<button class="ribbon-btn-mini active" id="paint-tool-pencil" type="button" title="Pencil">'
);

content = content.replace(
  '<button class="ribbon-btn-mini" type="button" title="Eraser">',
  '<button class="ribbon-btn-mini" id="paint-tool-eraser" type="button" title="Eraser">'
);

// 3. Add erase layer and eraser cursor inside paint-canvas-sheet
const canvasSheetTarget = '        <!-- Viewport & Typographic Educational Canvas -->';
const canvasSheetElements = `        <!-- Erase Layer (Snapshots previous slide for authentic MS Paint Eraser wipe) -->
        <div id="wb-erase-layer" class="wb-erase-layer hidden"></div>

        <!-- Authentic MS Paint Square Eraser Cursor -->
        <div id="paint-eraser-cursor" class="paint-eraser-cursor hidden">
          <div class="paint-eraser-crosshair"></div>
        </div>

`;

if (!content.includes('id="paint-eraser-cursor"')) {
  content = content.replace(canvasSheetTarget, canvasSheetElements + canvasSheetTarget);
}

// 4. Update status bar coords element with an ID so it can track eraser cursor position
content = content.replace(
  '562, 195px\n        </span>',
  '<span id="wb-status-coords-text">562, 195px</span>\n        </span>'
);

// 5. Update loadSlide to setup eraser transition on Notepad -> Notepad transitions
const loadSlideOld = `window.loadSlide = function(slide) {
  var isCode = !!slide.isCode;
  var prev = (window._prevIsCode !== undefined && window._prevIsCode !== null) ? window._prevIsCode : _prevIsCode;
  var isSwitch = (prev !== null && prev !== isCode);

  window._isSwitchingWindow = isSwitch;
  window._switchDuration = 1.0;
  window._switchFromCode = prev;
  window._switchToCode = isCode;`;

const loadSlideNew = `window.loadSlide = function(slide) {
  var isCode = !!slide.isCode;
  var prev = (window._prevIsCode !== undefined && window._prevIsCode !== null) ? window._prevIsCode : _prevIsCode;
  var isAppSwitch = (prev !== null && prev !== isCode);
  var isWbToWb = (prev !== null && !prev && !isCode);

  window._isSwitchingWindow = isAppSwitch;
  window._isErasingWindow = isWbToWb;
  window._switchDuration = (isAppSwitch || isWbToWb) ? 1.0 : 0;
  window._eraserDuration = 1.0;
  window._switchFromCode = prev;
  window._switchToCode = isCode;

  // Snapshot previous whiteboard content into erase layer for authentic eraser wipe
  if (isWbToWb) {
    var eraseLayer = document.getElementById('wb-erase-layer');
    var prevViewport = document.getElementById('wb-viewport');
    if (eraseLayer && prevViewport) {
      eraseLayer.innerHTML = prevViewport.innerHTML;
      eraseLayer.classList.remove('hidden');
      eraseLayer.style.clipPath = 'inset(0% 0 0 0)';
    }
  }`;

content = content.replace(loadSlideOld, loadSlideNew);

// 6. Update renderFrame to orchestrate eraser animation
const renderFrameOld = `  // --- WINDOWS 11 ALT + TAB TASK SWITCHER ORCHESTRATION ---
  var isSwitching = window._isSwitchingWindow && (elapsedSecs < window._switchDuration);
  var overlayEl = document.getElementById('alttab-overlay');
  var cardNotepad = document.getElementById('alttab-card-notepad');
  var cardVscode = document.getElementById('alttab-card-vscode');`;

const renderFrameNew = `  // --- AUTHENTIC MS PAINT ERASER TRANSITION (NOTEPAD TO NOTEPAD) ---
  var isErasing = window._isErasingWindow && (elapsedSecs < (window._eraserDuration || 1.0));
  var eraseLayer = document.getElementById('wb-erase-layer');
  var eraserCursor = document.getElementById('paint-eraser-cursor');
  var toolEraser = document.getElementById('paint-tool-eraser');
  var toolPencil = document.getElementById('paint-tool-pencil');
  var coordsEl = document.getElementById('wb-status-coords-text');

  if (isErasing) {
    var eraseProgress = Math.min(1, elapsedSecs / (window._eraserDuration || 1.0));

    // Activate Eraser tool button in toolbar
    if (toolEraser) toolEraser.classList.add('active');
    if (toolPencil) toolPencil.classList.remove('active');

    // Show erase layer and eraser cursor
    if (eraseLayer) eraseLayer.classList.remove('hidden');
    if (eraserCursor) eraserCursor.classList.remove('hidden');

    // Natural sweeping motion across the text/canvas area
    var startX = 220, endX = 640;
    var startY = 90, endY = 440;
    var sweepAngle = eraseProgress * Math.PI * 4;
    var curX = (startX + endX) / 2 + Math.sin(sweepAngle) * ((endX - startX) / 2);
    var curY = startY + eraseProgress * (endY - startY);

    if (eraserCursor) {
      eraserCursor.style.left = Math.round(curX) + 'px';
      eraserCursor.style.top = Math.round(curY) + 'px';
    }

    // Wipe previous slide content progressively from top to bottom
    if (eraseLayer) {
      var wipePercent = Math.min(100, Math.round(eraseProgress * 115));
      eraseLayer.style.clipPath = 'inset(' + wipePercent + '% 0 0 0)';
    }

    // Update live cursor coordinates in status bar
    if (coordsEl) {
      coordsEl.textContent = Math.round(curX) + ', ' + Math.round(curY) + 'px';
    }
  } else {
    if (eraseLayer) eraseLayer.classList.add('hidden');
    if (eraserCursor) eraserCursor.classList.add('hidden');
    if (toolEraser) toolEraser.classList.remove('active');
    if (toolPencil) toolPencil.classList.add('active');
    if (coordsEl) coordsEl.textContent = '562, 195px';
  }

  // --- WINDOWS 11 ALT + TAB TASK SWITCHER ORCHESTRATION ---
  var isSwitching = window._isSwitchingWindow && (elapsedSecs < window._switchDuration);
  var overlayEl = document.getElementById('alttab-overlay');
  var cardNotepad = document.getElementById('alttab-card-notepad');
  var cardVscode = document.getElementById('alttab-card-vscode');`;

content = content.replace(renderFrameOld, renderFrameNew);

// 7. Update effectiveElapsed in renderFrame
const effOld = `  // Calculate effective progress (typing/drawing begins smoothly after switch)
  var effectiveElapsed = window._isSwitchingWindow ? Math.max(0, elapsedSecs - window._switchDuration) : elapsedSecs;
  var effectiveTotal = window._isSwitchingWindow ? Math.max(1, totalDuration - window._switchDuration) : totalDuration;`;

const effNew = `  // Calculate effective progress (typing/drawing begins smoothly after switch or erase wipe)
  var hasIntroTransition = (window._isSwitchingWindow || window._isErasingWindow);
  var effectiveElapsed = hasIntroTransition ? Math.max(0, elapsedSecs - window._switchDuration) : elapsedSecs;
  var effectiveTotal = hasIntroTransition ? Math.max(1, totalDuration - window._switchDuration) : totalDuration;`;

content = content.replace(effOld, effNew);

if (isCRLF) {
  content = content.replace(/\n/g, '\r\n');
}

fs.writeFileSync(targetFile, content, 'utf8');
console.log('Successfully applied MS Paint Eraser transition!');

