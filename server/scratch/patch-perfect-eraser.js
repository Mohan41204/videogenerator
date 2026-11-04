const fs = require('fs');
const path = require('path');

const targetFile = path.resolve(__dirname, '../templates/screen_share.html');
let content = fs.readFileSync(targetFile, 'utf8');

const isCRLF = content.includes('\r\n');
content = content.replace(/\r\n/g, '\n');

// 1. CSS for .wb-erase-whiteout
content = content.replace(
  /\.wb-erase-layer\s*\{[^}]*\}\s*\.wb-erase-layer\.hidden\s*\{[^}]*\}/s,
  `.wb-erase-whiteout {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 0px;
      z-index: 45;
      background: #ffffff;
      pointer-events: none;
      overflow: hidden;
    }
    .wb-erase-whiteout.hidden {
      display: none !important;
    }`
);

// 2. DOM element in paint-canvas-sheet
content = content.replace(
  '<div id="wb-erase-layer" class="wb-erase-layer hidden"></div>',
  '<div id="wb-erase-whiteout" class="wb-erase-whiteout hidden"></div>'
);

// 3. Update loadSlide to defer building new slide when erasing
const loadSlideTarget = `  // Snapshot previous whiteboard content into erase layer for authentic eraser wipe
  if (isWbToWb) {
    var eraseLayer = document.getElementById('wb-erase-layer');
    var prevViewport = document.getElementById('wb-viewport');
    if (eraseLayer && prevViewport) {
      eraseLayer.innerHTML = prevViewport.innerHTML;
      eraseLayer.classList.remove('hidden');
      eraseLayer.style.clipPath = 'inset(0% 0 0 0)';
    }
  }`;

const loadSlideReplacement = `  window._pendingSlideBuild = false;
  if (isWbToWb) {
    var whiteout = document.getElementById('wb-erase-whiteout');
    if (whiteout) {
      whiteout.style.height = '0px';
      whiteout.classList.remove('hidden');
    }
    window._pendingSlideBuild = true;
  }`;

content = content.replace(loadSlideTarget, loadSlideReplacement);

// 4. Update renderFrame to wipe whiteout and trigger pending build
const renderFrameTarget = `  if (isErasing) {
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
  }`;

const renderFrameReplacement = `  var whiteout = document.getElementById('wb-erase-whiteout');
  if (isErasing) {
    var eraseProgress = Math.min(1, elapsedSecs / (window._eraserDuration || 1.0));

    // Activate Eraser tool button in toolbar
    if (toolEraser) toolEraser.classList.add('active');
    if (toolPencil) toolPencil.classList.remove('active');

    // Show whiteout layer and eraser cursor
    if (whiteout) whiteout.classList.remove('hidden');
    if (eraserCursor) eraserCursor.classList.remove('hidden');

    // Natural sweeping motion across the text/canvas area
    var startX = 220, endX = 640;
    var startY = 80, endY = 450;
    var sweepAngle = eraseProgress * Math.PI * 4;
    var curX = (startX + endX) / 2 + Math.sin(sweepAngle) * ((endX - startX) / 2);
    var curY = startY + eraseProgress * (endY - startY);

    if (eraserCursor) {
      eraserCursor.style.left = Math.round(curX) + 'px';
      eraserCursor.style.top = Math.round(curY) + 'px';
    }

    // Whiteout layer smoothly paints white over the previous slide's text
    if (whiteout) {
      whiteout.style.height = Math.round(curY + 45) + 'px';
    }

    // Update live cursor coordinates in status bar
    if (coordsEl) {
      coordsEl.textContent = Math.round(curX) + ', ' + Math.round(curY) + 'px';
    }
  } else {
    if (whiteout) {
      whiteout.classList.add('hidden');
      whiteout.style.height = '0px';
    }
    if (eraserCursor) eraserCursor.classList.add('hidden');
    if (toolEraser) toolEraser.classList.remove('active');
    if (toolPencil) toolPencil.classList.add('active');
    if (coordsEl) coordsEl.textContent = '562, 195px';

    // Trigger deferred build of new slide once eraser completes
    if (window._pendingSlideBuild) {
      _buildCurrentWhiteboardSlide(_slide);
      window._pendingSlideBuild = false;
    }
  }`;

content = content.replace(renderFrameTarget, renderFrameReplacement);

// 5. Wrap the whiteboard DOM builder into _buildCurrentWhiteboardSlide
const buildSectionStart = '    _showWhiteboard();\n    document.getElementById(\'wb-lesson-title-label\').textContent = slide.heading || \'Theory / Concept\';';
const buildSectionTarget = `    // Clear and build the whiteboard canvas elements
    var canvas = document.getElementById('wb-canvas');`;

const wrappedBuilder = `    function _buildCurrentWhiteboardSlide(slide) {
      if (!slide) return;
      document.getElementById('wb-lesson-title-label').textContent = slide.heading || 'Theory / Concept';
      var workspace = document.getElementById('wb-workspace');
      var hasBoard = !!(slide.board && (slide.board.nodes || slide.board.strokes || slide.board.heading));
      if (hasBoard) {
        if (workspace) workspace.classList.add('wb-has-board');
        var boardCanvas = document.getElementById('board-canvas');
        if (boardCanvas && window.Board) {
          var panel = document.getElementById('wb-board-panel');
          var panelW = (panel && panel.clientWidth && panel.clientWidth > 100) ? panel.clientWidth : Math.floor(1280 * 0.62);
          var panelH = (panel && panel.clientHeight && panel.clientHeight > 100) ? panel.clientHeight : 640;
          window.Board.load(slide.board, panelW, panelH, { slideHeading: slide.heading });
        }
      } else {
        if (workspace) workspace.classList.remove('wb-has-board');
      }

      var canvas = document.getElementById('wb-canvas');`;

// Let's replace the top of the whiteboard build block
const oldWbBlock = `    _showWhiteboard();
    document.getElementById('wb-lesson-title-label').textContent = slide.heading || 'Theory / Concept';
    
    // Toggle whiteboard drawing board split layout
    var workspace = document.getElementById('wb-workspace');
    var hasBoard = !!(slide.board && (slide.board.nodes || slide.board.strokes || slide.board.heading));
    if (hasBoard) {
      if (workspace) workspace.classList.add('wb-has-board');
      var boardCanvas = document.getElementById('board-canvas');
      if (boardCanvas && window.Board) {
        var panel = document.getElementById('wb-board-panel');
        var panelW = (panel && panel.clientWidth && panel.clientWidth > 100) ? panel.clientWidth : Math.floor(1280 * 0.62);
        var panelH = (panel && panel.clientHeight && panel.clientHeight > 100) ? panel.clientHeight : 640;
        window.Board.load(slide.board, panelW, panelH, { slideHeading: slide.heading });
      }
    } else {
      if (workspace) workspace.classList.remove('wb-has-board');
    }

    // Clear and build the whiteboard canvas elements
    var canvas = document.getElementById('wb-canvas');`;

const newWbBlock = `    _showWhiteboard();
    window._buildCurrentWhiteboardSlide = function(s) {
      if (!s) return;
      document.getElementById('wb-lesson-title-label').textContent = s.heading || 'Theory / Concept';
      var workspace = document.getElementById('wb-workspace');
      var hasBoard = !!(s.board && (s.board.nodes || s.board.strokes || s.board.heading));
      if (hasBoard) {
        if (workspace) workspace.classList.add('wb-has-board');
        var boardCanvas = document.getElementById('board-canvas');
        if (boardCanvas && window.Board) {
          var panel = document.getElementById('wb-board-panel');
          var panelW = (panel && panel.clientWidth && panel.clientWidth > 100) ? panel.clientWidth : Math.floor(1280 * 0.62);
          var panelH = (panel && panel.clientHeight && panel.clientHeight > 100) ? panel.clientHeight : 640;
          window.Board.load(s.board, panelW, panelH, { slideHeading: s.heading });
        }
      } else {
        if (workspace) workspace.classList.remove('wb-has-board');
      }

      var canvas = document.getElementById('wb-canvas');`;

content = content.replace(oldWbBlock, newWbBlock);

// Now at the end of loadSlide's else block, close the function and call it if not erasing:
const loadSlideEndTarget = `    // Reset last active bullet index
    window._lastActiveBulletIdx = -1;
  }
};`;

const loadSlideEndReplacement = `    // Reset last active bullet index
    window._lastActiveBulletIdx = -1;
    }; // end _buildCurrentWhiteboardSlide

    if (!window._pendingSlideBuild) {
      window._buildCurrentWhiteboardSlide(slide);
    }
  }
};`;

content = content.replace(loadSlideEndTarget, loadSlideEndReplacement);

if (isCRLF) {
  content = content.replace(/\n/g, '\r\n');
}

fs.writeFileSync(targetFile, content, 'utf8');
console.log('Successfully patched perfect eraser whiteout wipe!');

