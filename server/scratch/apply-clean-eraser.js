const fs = require('fs');

const filePath = 'server/templates/screen_share.html';
const content = fs.readFileSync(filePath, 'utf8');

const startMarker = 'window.loadSlide = function(slide) {';
const endMarker = '  var hasIntroTransition = (window._isSwitchingWindow || window._isErasingWindow);';

const startIdx = content.indexOf(startMarker);
const endIdx = content.indexOf(endMarker);

if (startIdx === -1 || endIdx === -1) {
  console.error('Markers not found! startIdx:', startIdx, 'endIdx:', endIdx);
  process.exit(1);
}

const newBlock = `function _buildWhiteboardSlide(slide) {
  if (!slide) return;
  var titleLabel = document.getElementById('wb-lesson-title-label');
  if (titleLabel) titleLabel.textContent = slide.heading || 'Theory / Concept';

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

  var canvas = document.getElementById('wb-canvas');
  if (!canvas) return;
  canvas.innerHTML = '';

  // Board and Mermaid/Diagrams are mutually exclusive (Decision 4)
  var hasDiagram = !hasBoard && !!(slide.isDiagram || slide.mermaid || (slide.visual && slide.visual.enabled));
  var hasRealWorld = !hasDiagram && !hasBoard && !!(slide.realWorldVisual && slide.realWorldVisual.enabled === true && (slide.imagePath || slide.imageUrl));
  window._hasRealWorld = hasRealWorld;
  window._imageAppearSecond = 0;

  // Safety fallback: ensure whiteboard text slides are never blank if bullets was empty
  if (!hasDiagram && !hasBoard && !hasRealWorld) {
    if (!Array.isArray(slide.bullets) || slide.bullets.length === 0) {
      if (slide.narration && typeof slide.narration === 'string') {
        var rawSentences = slide.narration.split(/(?<=[.!?])\\s+/);
        var cleanPoints = rawSentences
          .map(function(s) { return s.trim(); })
          .filter(function(s) {
            return s.length >= 20 && !/^(welcome|hello|today|in this|let'?s\\s+(begin|start|look)|imagine)/i.test(s);
          });
        if (cleanPoints.length >= 2) {
          slide.bullets = cleanPoints.slice(0, 3);
        } else if (cleanPoints.length === 1) {
          slide.bullets = [
            cleanPoints[0],
            'Core overview and essential principles of ' + (slide.subheading || slide.heading || 'the topic'),
            'Key implementation patterns and structured design'
          ];
        } else {
          slide.bullets = [
            'Core overview and essential principles of ' + (slide.subheading || slide.heading || 'the topic'),
            'Structured execution, parameters, and practical usage',
            'Best practices and common programming patterns'
          ];
        }
      } else {
        slide.bullets = [
          'Core overview and essential principles of ' + (slide.subheading || slide.heading || 'the topic'),
          'Structured execution, parameters, and practical usage',
          'Best practices and common programming patterns'
        ];
      }
    }
  }

  // Adjust canvas padding for maximum visual display area when diagram or real-world image is shown
  if (hasRealWorld) {
    canvas.style.padding = '20px 40px';
    canvas.style.gap = '8px';
  } else {
    canvas.style.padding = '';
    canvas.style.gap = '';
  }
  
  // Build Text Card Element
  var textCard = document.createElement('div');
  textCard.className = 'wb-element wb-card visible';
  textCard.id = 'wb-main-text-card';
  textCard.style.width = '100%';
  textCard.style.maxWidth = '1350px';
  textCard.style.padding = (hasDiagram || hasRealWorld) ? '10px 24px 4px 24px' : '28px 32px';
  
  // Create Title
  var titleEl = document.createElement('h1');
  titleEl.className = 'wb-title';
  titleEl.id = 'wb-main-title';
  if (hasDiagram || hasRealWorld) {
    titleEl.style.fontSize = '30px';
    titleEl.style.marginBottom = '4px';
  }
  textCard.appendChild(titleEl);
  
  // Create Subtitle/Heading if present
  if (slide.subheading) {
    var subHeadingEl = document.createElement('div');
    subHeadingEl.className = 'wb-section-heading';
    subHeadingEl.id = 'wb-main-subheading';
    if (hasDiagram || hasRealWorld) {
      subHeadingEl.style.fontSize = '18px';
      subHeadingEl.style.marginTop = '2px';
      subHeadingEl.style.marginBottom = '4px';
    }
    textCard.appendChild(subHeadingEl);
  }
  
  canvas.appendChild(textCard);
  
  // If Diagram is present, build diagram container element directly in the main educational area!
  if (hasDiagram) {
    window._diagramAppearSecond = 4;
    if (slide.visualTiming && slide.visualTiming.enabled !== false && typeof slide.visualTiming.appearAtSecond === 'number') {
      window._diagramAppearSecond = slide.visualTiming.appearAtSecond;
    } else if (!slide.visualTiming || slide.visualTiming.enabled === false) {
      window._diagramAppearSecond = 0;
    }
    
    var diagramCard = document.createElement('div');
    diagramCard.className = 'wb-element wb-diagram-container';
    diagramCard.id = 'wb-diagram-card';
    canvas.appendChild(diagramCard);
  } else {
    window._diagramAppearSecond = 0;
  }

  if (hasRealWorld) {
    window._imageAppearSecond = 4;
    if (slide.realWorldVisualTiming && slide.realWorldVisualTiming.enabled !== false && typeof slide.realWorldVisualTiming.appearAtSecond === 'number') {
      window._imageAppearSecond = slide.realWorldVisualTiming.appearAtSecond;
    }

    var imageCard = document.createElement('div');
    imageCard.className = 'wb-element wb-image-container';
    imageCard.id = 'wb-image-card';

    var wrapper = document.createElement('div');
    wrapper.className = 'wb-image-wrapper';

    var imgEl = document.createElement('img');
    imgEl.className = 'wb-scenario-img';
    imgEl.id = 'wb-scenario-image';

    var imgSrc = slide.imagePath || slide.imageUrl || '';
    if (imgSrc && !imgSrc.startsWith('http') && !imgSrc.startsWith('data:') && !imgSrc.startsWith('file://')) {
      imgSrc = 'file:///' + imgSrc.replace(/\\\\/g, '/');
    }
    imgEl.src = imgSrc;
    imgEl.alt = (slide.realWorldVisual && slide.realWorldVisual.scenario) ? slide.realWorldVisual.scenario : 'Real-World Visual Scenario';
    wrapper.appendChild(imgEl);

    window._scenarioAnnotations = [];
    imageCard.appendChild(wrapper);
    canvas.appendChild(imageCard);
  }
  
  // Container for bullets/blocks
  var blockContainer = document.createElement('div');
  blockContainer.id = 'wb-blocks-container';
  if (hasDiagram) {
    blockContainer.className = 'wb-element visible';
    blockContainer.style.width = '100%';
    blockContainer.style.maxWidth = '1300px';
    blockContainer.style.marginTop = '4px';
    canvas.appendChild(blockContainer);
  } else {
    textCard.appendChild(blockContainer);
  }
}

window.loadSlide = function(slide) {
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

  // Track titles and update live Alt+Tab previews
  if (isCode) {
    window._lastCodeFileName = slide.fileName || 'main.py';
  } else {
    window._lastWbHeading = slide.heading || 'Notes';
  }
  _updateAltTabPreviews(slide);

  _prevIsCode = isCode;
  _slide = slide;
  
  // Cleanly reset bullet animation state across slide transitions
  window._lastActiveBulletIdx = -1;
  window._blocksRendered = false;
  
  if (slide.isCode) {
    _showVSCode();
    var fileName = slide.fileName || 'main.py';
    var folderName = slide.folderName || ((slide.heading || 'workspace').toLowerCase().replace(/[^a-z0-9_-]/g, ''));
    if (!folderName) folderName = 'workspace';
    var titleFolder = slide.titleFolder || (slide.heading + ' - ' + (slide.subheading || 'Code'));
    var iconSvg = _getFileIconSvg(fileName);
    var langName = _getLanguageName(fileName);
    
    var titleEl = document.getElementById('vs-title-label');
    if (titleEl) titleEl.textContent = titleFolder;

    var folderEl = document.getElementById('vs-sidebar-folder');
    if (folderEl) folderEl.textContent = folderName;

    var tabNameEl = document.getElementById('vs-tab-filename');
    if (tabNameEl) tabNameEl.textContent = fileName;

    var sidebarNameEl = document.getElementById('vs-sidebar-file');
    if (sidebarNameEl) sidebarNameEl.textContent = fileName;

    var breadcrumbNameEl = document.getElementById('vs-breadcrumb-filename');
    if (breadcrumbNameEl) breadcrumbNameEl.textContent = fileName;

    var breadcrumbScopeEl = document.getElementById('vs-breadcrumb-scope');
    if (breadcrumbScopeEl) {
      if (fileName.endsWith('.py')) breadcrumbScopeEl.textContent = '...';
      else if (fileName.endsWith('.js') || fileName.endsWith('.ts')) breadcrumbScopeEl.textContent = '...';
      else if (fileName.endsWith('.html')) breadcrumbScopeEl.textContent = 'html > head > style';
      else breadcrumbScopeEl.textContent = '...';
    }

    var tabIconEl = document.getElementById('vs-tab-icon');
    if (tabIconEl) tabIconEl.innerHTML = iconSvg;

    var sidebarIconEl = document.getElementById('vs-sidebar-file-icon');
    if (sidebarIconEl) sidebarIconEl.innerHTML = iconSvg;

    var breadcrumbIconEl = document.getElementById('vs-breadcrumb-icon');
    if (breadcrumbIconEl) breadcrumbIconEl.innerHTML = iconSvg;

    var statusLangEl = document.getElementById('vs-status-lang');
    if (statusLangEl) statusLangEl.textContent = '{ } ' + langName;
  } else {
    _showWhiteboard();
    if (isWbToWb) {
      // Keep previous slide content intact; prepare whiteout layer for authentic MS Paint erase wipe
      var whiteout = document.getElementById('wb-erase-whiteout');
      if (whiteout) {
        whiteout.style.height = '0px';
        whiteout.classList.remove('hidden');
      }
      window._pendingSlideBuild = true;
    } else {
      window._pendingSlideBuild = false;
      _buildWhiteboardSlide(slide);
    }
  }
};

window.renderFrame = function(elapsedSecs, totalDuration) {
  if (!_slide) return;
  var isCode = !!_slide.isCode;

  // --- AUTHENTIC MS PAINT ERASER TRANSITION (NOTEPAD TO NOTEPAD) ---
  var isErasing = window._isErasingWindow && (elapsedSecs < (window._eraserDuration || 1.0));
  var eraserCursor = document.getElementById('paint-eraser-cursor');
  var toolEraser = document.getElementById('paint-tool-eraser');
  var toolPencil = document.getElementById('paint-tool-pencil');
  var coordsEl = document.getElementById('wb-status-coords-text');
  var whiteout = document.getElementById('wb-erase-whiteout');

  if (isErasing) {
    var eraseProgress = Math.min(1, elapsedSecs / (window._eraserDuration || 1.0));

    // Activate Eraser tool button in toolbar
    if (toolEraser) toolEraser.classList.add('active');
    if (toolPencil) toolPencil.classList.remove('active');

    // Show whiteout layer and eraser cursor
    if (whiteout) whiteout.classList.remove('hidden');
    if (eraserCursor) eraserCursor.classList.remove('hidden');

    // Natural sweeping zig-zag motion across the text/canvas area
    var startX = 180, endX = 750;
    var startY = 60, endY = 480;
    var sweepAngle = eraseProgress * Math.PI * 6; // 3 zig-zag passes
    var curX = (startX + endX) / 2 + Math.sin(sweepAngle) * ((endX - startX) / 2);
    var curY = startY + eraseProgress * (endY - startY);

    if (eraserCursor) {
      eraserCursor.style.left = Math.round(curX) + 'px';
      eraserCursor.style.top = Math.round(curY) + 'px';
    }

    // Whiteout layer smoothly paints white over previous slide's text
    if (whiteout) {
      whiteout.style.height = Math.round(curY + 43) + 'px';
    }

    // Update live cursor coordinates in status bar
    if (coordsEl) {
      coordsEl.textContent = Math.round(curX) + ', ' + Math.round(curY) + 'px';
    }

    // Return early while erasing so new slide typing does not run prematurely
    return;
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
      _buildWhiteboardSlide(_slide);
      window._pendingSlideBuild = false;
    }
  }

  // --- WINDOWS 11 ALT + TAB TASK SWITCHER ORCHESTRATION ---
  var isSwitching = window._isSwitchingWindow && (elapsedSecs < window._switchDuration);
  var overlayEl = document.getElementById('alttab-overlay');
  var cardNotepad = document.getElementById('alttab-card-notepad');
  var cardVscode = document.getElementById('alttab-card-vscode');

  if (isSwitching) {
    if (overlayEl) overlayEl.classList.remove('hidden');

    // Keep source window visible behind the blurred switcher overlay
    if (window._switchFromCode) {
      _showVSCode();
    } else {
      _showWhiteboard();
    }

    // Task switcher navigation:
    // First 0.3s: source app is selected (user just pressed Alt+Tab)
    // 0.3s - 1.0s: selection jumps to target app with cyan highlight (user selected target)
    var selectTarget = (elapsedSecs >= 0.3);

    if (window._switchToCode) {
      if (selectTarget) {
        if (cardVscode) cardVscode.classList.add('active');
        if (cardNotepad) cardNotepad.classList.remove('active');
      } else {
        if (cardNotepad) cardNotepad.classList.add('active');
        if (cardVscode) cardVscode.classList.remove('active');
      }
    } else {
      if (selectTarget) {
        if (cardNotepad) cardNotepad.classList.add('active');
        if (cardVscode) cardVscode.classList.remove('active');
      } else {
        if (cardVscode) cardVscode.classList.add('active');
        if (cardNotepad) cardNotepad.classList.remove('active');
      }
    }
    return;
  } else {
    // Switch finished (or no switch needed for consecutive same-type slides)
    if (overlayEl) overlayEl.classList.add('hidden');
    if (cardNotepad) cardNotepad.classList.remove('active');
    if (cardVscode) cardVscode.classList.remove('active');

    // Show target window
    if (isCode) {
      _showVSCode();
    } else {
      _showWhiteboard();
    }
  }

`;

const updatedContent = content.substring(0, startIdx) + newBlock + content.substring(endIdx);
fs.writeFileSync(filePath, updatedContent, 'utf8');
console.log('Successfully updated screen_share.html!');
