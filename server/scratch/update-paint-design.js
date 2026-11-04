const fs = require('fs');
const path = require('path');

const targetFile = path.join(__dirname, '..', 'templates', 'screen_share.html');
let content = fs.readFileSync(targetFile, 'utf8');

// Normalize line endings
const isCRLF = content.includes('\r\n');
content = content.replace(/\r\n/g, '\n');

// 1. CSS Replacement
const oldCssStart = '    /* ---- WHITEBOARD THEME ---- */';
const oldCssEnd = '    #board-canvas {\n      width: 100%;\n      height: 100%;\n      display: block;\n    }';

const newCss = `    /* ---- AUTHENTIC WINDOWS 11 MS PAINT THEME ---- */
    #whiteboard-window {
      background: #f9f9fb;
      color: #1c1c1c;
      font-family: 'Segoe UI Variable Text', 'Segoe UI', -apple-system, BlinkMacSystemFont, 'Inter', 'Noto Sans Tamil', 'Noto Sans Devanagari', sans-serif;
      display: flex;
      flex-direction: column;
      height: 100vh;
      overflow: hidden;
      user-select: none;
    }

    /* 1. Paint Title Bar */
    .paint-titlebar {
      height: 34px;
      background: #f9f9fb;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding-left: 10px;
      flex-shrink: 0;
      border-bottom: 1px solid #f0f0f3;
    }
    .paint-titlebar-left {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .paint-app-icon {
      width: 16px;
      height: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .paint-window-title {
      font-size: 12px;
      font-weight: 400;
      color: #1b1b1b;
      letter-spacing: -0.01em;
    }
    .paint-caption-controls {
      display: flex;
      align-items: center;
      height: 100%;
    }
    .paint-caption-btn {
      width: 44px;
      height: 34px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: transparent;
      border: none;
      color: #1b1b1b;
      cursor: default;
      transition: background 0.1s;
    }
    .paint-caption-btn:hover {
      background: #e5e5e5;
    }
    .paint-caption-btn.close:hover {
      background: #e81123;
      color: #ffffff;
    }

    /* 2. Paint Menu Bar */
    .paint-menubar {
      height: 28px;
      background: #f9f9fb;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 10px;
      flex-shrink: 0;
    }
    .paint-menubar-left {
      display: flex;
      align-items: center;
      gap: 2px;
    }
    .paint-menu-item {
      padding: 3px 8px;
      font-size: 12px;
      color: #1b1b1b;
      border-radius: 4px;
      cursor: default;
      background: transparent;
      border: none;
      font-family: inherit;
    }
    .paint-menu-item:hover {
      background: #ebebeb;
    }
    .paint-menu-divider {
      width: 1px;
      height: 14px;
      background: #e0e0e0;
      margin: 0 6px;
    }
    .paint-icon-btn {
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 4px;
      background: transparent;
      border: none;
      color: #444;
      cursor: default;
    }
    .paint-icon-btn:hover {
      background: #ebebeb;
    }
    .paint-menubar-right {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    /* 3. Paint Fluent Ribbon Toolbar */
    .paint-ribbon {
      height: 98px;
      background: #f9f9fb;
      border-top: 1px solid #ebebeb;
      border-bottom: 1px solid #e1e1e1;
      display: flex;
      align-items: stretch;
      padding: 4px 10px 2px 10px;
      gap: 0;
      flex-shrink: 0;
      box-sizing: border-box;
    }
    .ribbon-section {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: space-between;
      padding: 0 5px;
      position: relative;
    }
    .ribbon-section-content {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .ribbon-label {
      font-size: 10px;
      color: #606060;
      font-weight: 400;
      text-align: center;
      margin-top: 2px;
      line-height: 1.1;
      white-space: nowrap;
    }
    .ribbon-divider {
      width: 1px;
      background: #e5e5e5;
      margin: 4px 4px 14px 4px;
      align-self: stretch;
    }

    /* Selection Section */
    .ribbon-btn-large {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 2px;
      padding: 4px 6px;
      border-radius: 4px;
      background: transparent;
      border: 1px solid transparent;
      cursor: default;
      color: #333;
    }
    .ribbon-btn-large:hover {
      background: #ebebeb;
    }

    /* Image Section */
    .ribbon-grid-2x2 {
      display: flex;
      flex-direction: column;
      gap: 3px;
    }
    .ribbon-row {
      display: flex;
      gap: 3px;
    }
    .ribbon-btn-mini {
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 4px;
      background: transparent;
      border: 1px solid transparent;
      cursor: default;
      color: #333;
    }
    .ribbon-btn-mini:hover {
      background: #ebebeb;
    }
    .ribbon-btn-mini.active {
      background: #e0e8f5;
      border-color: #005fb8;
      color: #005fb8;
    }

    /* Tools Section: 3x2 Grid */
    .ribbon-tools-grid {
      display: grid;
      grid-template-columns: repeat(3, 24px);
      grid-template-rows: repeat(2, 24px);
      gap: 2px;
    }

    /* Shapes Section */
    .ribbon-shapes-wrap {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .ribbon-shapes-box {
      background: #ffffff;
      border: 1px solid #d4d4d8;
      border-radius: 4px;
      padding: 3px 4px;
      display: flex;
      align-items: center;
      gap: 3px;
    }
    .ribbon-shapes-grid {
      display: grid;
      grid-template-columns: repeat(7, 18px);
      grid-template-rows: repeat(3, 17px);
      gap: 1px 2px;
    }
    .shape-icon {
      width: 18px;
      height: 17px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 2px;
      cursor: default;
      color: #374151;
    }
    .shape-icon:hover {
      background: #f1f5f9;
    }
    .ribbon-shapes-scroll {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .shape-scroll-arrow {
      width: 12px;
      height: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #64748b;
      cursor: default;
    }
    .ribbon-shapes-options {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .ribbon-opt-btn {
      display: flex;
      align-items: center;
      gap: 3px;
      padding: 2px 4px;
      font-size: 11px;
      color: #374151;
      border-radius: 4px;
      border: 1px solid transparent;
      background: transparent;
      cursor: default;
    }
    .ribbon-opt-btn:hover {
      background: #ebebeb;
    }

    /* Colors Section */
    .ribbon-colors-wrap {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .ribbon-active-colors {
      display: flex;
      align-items: center;
      gap: 5px;
    }
    .color-box-primary {
      width: 26px;
      height: 26px;
      border-radius: 50%;
      background: #000000;
      box-shadow: 0 0 0 2px #f9f9fb, 0 0 0 4px #005fb8;
      cursor: default;
    }
    .color-box-secondary {
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: #ffffff;
      border: 1px solid #94a3b8;
      cursor: default;
    }
    .color-swatches-grid {
      display: grid;
      grid-template-columns: repeat(10, 15px);
      grid-template-rows: repeat(2, 15px);
      gap: 3px;
    }
    .swatch-dot {
      width: 14px;
      height: 14px;
      border-radius: 50%;
      box-shadow: 0 0 0 1px rgba(0,0,0,0.15);
      cursor: default;
    }
    .swatch-dot:hover {
      transform: scale(1.15);
    }
    .color-wheel-btn {
      width: 22px;
      height: 22px;
      border-radius: 50%;
      background: conic-gradient(red, yellow, lime, aqua, blue, magenta, red);
      border: 1px solid #cbd5e1;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: default;
      position: relative;
    }
    .color-wheel-btn::after {
      content: "+";
      font-size: 11px;
      font-weight: 700;
      color: #ffffff;
      text-shadow: 0 0 2px #000;
    }

    /* Copilot & Layers */
    .copilot-icon {
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .layers-icon {
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #374151;
    }

    /* 4. Canvas Desk & Paper Sheet */
    .wb-workspace {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #f0f2f5;
      position: relative;
      overflow: hidden;
      padding: 10px 14px;
      box-sizing: border-box;
    }
    .paint-canvas-sheet {
      width: 100%;
      height: 100%;
      max-width: 1252px;
      max-height: 524px;
      background: #ffffff;
      border: 1px solid #d4d4d8;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
      position: relative;
      display: flex;
      overflow: hidden;
    }

    /* 8 Paint Canvas Resize Handles */
    .paint-handle {
      width: 6px;
      height: 6px;
      background: #ffffff;
      border: 1px solid #475569;
      position: absolute;
      z-index: 25;
      box-sizing: border-box;
    }
    .paint-handle.top-left { top: -4px; left: -4px; cursor: nwse-resize; }
    .paint-handle.top-center { top: -4px; left: 50%; transform: translateX(-50%); cursor: ns-resize; }
    .paint-handle.top-right { top: -4px; right: -4px; cursor: nesw-resize; }
    .paint-handle.left-center { top: 50%; left: -4px; transform: translateY(-50%); cursor: ew-resize; }
    .paint-handle.right-center { top: 50%; right: -4px; transform: translateY(-50%); cursor: ew-resize; }
    .paint-handle.bottom-left { bottom: -4px; left: -4px; cursor: nesw-resize; }
    .paint-handle.bottom-center { bottom: -4px; left: 50%; transform: translateX(-50%); cursor: ns-resize; }
    .paint-handle.bottom-right { bottom: -4px; right: -4px; cursor: nwse-resize; }

    /* Teacher Avatar Column (Hidden) */
    .wb-teacher-col {
      display: none !important;
    }

    /* Inside the Canvas Sheet */
    .wb-canvas-viewport {
      flex: 1;
      height: 100%;
      overflow: hidden;
      position: relative;
      background: #ffffff;
    }
    .wb-canvas {
      width: 100%;
      height: 100%;
      position: relative;
      background-color: #ffffff;
      background-image: none;
      transform-origin: center center;
      padding: 24px 44px;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      gap: 12px;
      align-items: center;
      word-wrap: break-word;
      overflow-wrap: break-word;
      white-space: pre-wrap;
    }
    .wb-canvas * {
      word-wrap: break-word;
      overflow-wrap: break-word;
    }

    /* Whiteboard Split Layout (when slide.board is present) */
    .wb-board-panel {
      display: none;
    }
    .wb-workspace.wb-has-board .wb-canvas-viewport {
      flex: 0 0 38%;
      max-width: 38%;
      border-right: 1px solid #e2e8f0;
      background: #ffffff;
    }
    .wb-workspace.wb-has-board .wb-canvas {
      padding: 20px 24px;
      align-items: flex-start;
      text-align: left;
    }
    .wb-workspace.wb-has-board .wb-board-panel {
      display: flex;
      flex: 0 0 62%;
      max-width: 62%;
      height: 100%;
      position: relative;
      background: #ffffff;
      overflow: hidden;
      align-items: center;
      justify-content: center;
    }
    #board-canvas {
      width: 100%;
      height: 100%;
      display: block;
    }

    /* 5. Paint Status Bar */
    .paint-statusbar {
      height: 26px;
      background: #fbfbfd;
      border-top: 1px solid #e5e5e5;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 14px;
      font-size: 11px;
      color: #555555;
      flex-shrink: 0;
      position: relative;
      box-sizing: border-box;
    }
    .paint-status-left {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .paint-status-item {
      display: flex;
      align-items: center;
      gap: 5px;
      color: #52525b;
    }
    .paint-status-divider {
      width: 1px;
      height: 12px;
      background: #d4d4d8;
    }
    .paint-status-right {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .paint-status-zoom {
      display: flex;
      align-items: center;
      gap: 3px;
      color: #3f3f46;
      font-weight: 500;
      padding: 1px 4px;
      border-radius: 3px;
    }
    .paint-zoom-slider {
      display: flex;
      align-items: center;
      width: 70px;
      height: 10px;
    }
    .paint-zoom-track {
      width: 100%;
      height: 2px;
      background: #cbd5e1;
      position: relative;
    }
    .paint-zoom-thumb {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #005fb8;
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
    }
    .paint-timeline-progress {
      position: absolute;
      bottom: 0;
      left: 0;
      height: 2.5px;
      background: #005fb8;
      width: 0%;
      transition: width 0.1s linear;
    }`;

const oldCssRegex = /\/\* ---- WHITEBOARD THEME ---- \*\/[\s\S]*?#board-canvas \{\s*width: 100%;\s*height: 100%;\s*display: block;\s*\}/;

if (!oldCssRegex.test(content)) {
  console.error('Failed to match old whiteboard CSS block!');
  process.exit(1);
}
content = content.replace(oldCssRegex, newCss);

// 2. HTML Markup Replacement
const oldHtmlRegex = /<!-- WHITEBOARD WINDOW \(DIGITAL EDUCATIONAL WHITEBOARD\) -->[\s\S]*?<div id="whiteboard-window" class="window">[\s\S]*?<\/div>\s*<\/div>\s*<!-- Whiteboard Drawing Board Scripts -->/;

const newHtml = `<!-- WHITEBOARD WINDOW (AUTHENTIC WINDOWS 11 MS PAINT UI) -->
  <div id="whiteboard-window" class="window">

    <!-- 1. Window Title Bar -->
    <div class="paint-titlebar">
      <div class="paint-titlebar-left">
        <span class="paint-app-icon">
          <!-- Windows 11 MS Paint Palette Icon -->
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M12 2C6.48 2 2 6.48 2 12c0 5.52 4.48 10 10 10 1.25 0 2.25-.94 2.25-2.19 0-.58-.23-1.11-.6-1.5-.38-.4-.6-.94-.6-1.53 0-1.25 1-2.28 2.25-2.28H17c3.87 0 7-3.13 7-7 0-4.14-5.37-7.5-12-7.5z" fill="#f0f3f6" stroke="#c0c4cc" stroke-width="0.8"/>
            <circle cx="6.5" cy="11.5" r="1.8" fill="#e81123"/>
            <circle cx="9.5" cy="7.2" r="1.8" fill="#ff8c00"/>
            <circle cx="14.5" cy="7.2" r="1.8" fill="#ffb900"/>
            <circle cx="17.8" cy="11.5" r="1.8" fill="#00a4ef"/>
            <circle cx="14" cy="16" r="1.8" fill="#107c41"/>
            <path d="M19 16.5l2.5 2.5a1.2 1.2 0 0 1-1.7 1.7L17.3 18.2" stroke="#4a5568" stroke-width="1.8" stroke-linecap="round"/>
          </svg>
        </span>
        <span class="paint-window-title"><span id="wb-lesson-title-label">Untitled</span> - Paint</span>
      </div>
      <div class="paint-caption-controls">
        <button class="paint-caption-btn" title="Minimize" type="button">
          <svg width="10" height="1" viewBox="0 0 10 1"><path d="M0 0h10v1H0z" fill="currentColor"/></svg>
        </button>
        <button class="paint-caption-btn" title="Maximize" type="button">
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1"><rect x="0.5" y="0.5" width="9" height="9"/></svg>
        </button>
        <button class="paint-caption-btn close" title="Close" type="button">
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1"><path d="M0 0l10 10M10 0L0 10"/></svg>
        </button>
      </div>
    </div>

    <!-- 2. Menu Bar & Quick Actions -->
    <div class="paint-menubar">
      <div class="paint-menubar-left">
        <button class="paint-menu-item" type="button">File</button>
        <button class="paint-menu-item" type="button">Edit</button>
        <button class="paint-menu-item" type="button">View</button>
        <span class="paint-menu-divider"></span>
        <button class="paint-icon-btn" title="Save (Ctrl+S)" type="button">
          <!-- Floppy Disk -->
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2">
            <path d="M3 2h8l3 3v9H2V2h1z"/>
            <rect x="4" y="2" width="6" height="4"/>
            <rect x="4" y="9" width="8" height="5"/>
          </svg>
        </button>
        <button class="paint-icon-btn" title="Share" type="button">
          <!-- Share / Export -->
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2">
            <path d="M9 3l4 4-4 4"/>
            <path d="M13 7H6a4 4 0 0 0-4 4v2"/>
          </svg>
        </button>
        <button class="paint-icon-btn" title="Undo (Ctrl+Z)" type="button">
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4">
            <path d="M6 4L2 8l4 4"/><path d="M2 8h8a4 4 0 0 1 4 4v1"/>
          </svg>
        </button>
        <button class="paint-icon-btn" title="Redo (Ctrl+Y)" type="button">
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4">
            <path d="M10 4l4 4-4 4"/><path d="M14 8H6a4 4 0 0 0-4 4v1"/>
          </svg>
        </button>
      </div>
      <div class="paint-menubar-right">
        <button class="paint-icon-btn" title="What's new" type="button">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2">
            <path d="M12 2l-6 4H3v4h3l6 4V2z"/><path d="M14 6a3 3 0 0 1 0 4"/>
          </svg>
        </button>
        <button class="paint-icon-btn" title="Account" type="button">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2">
            <circle cx="8" cy="5" r="3"/><path d="M2 14c0-3.3 2.7-6 6-6s6 2.7 6 6"/>
          </svg>
        </button>
        <button class="paint-icon-btn" title="Settings" type="button">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2">
            <circle cx="8" cy="8" r="2.5"/>
            <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M3.05 12.95l1.41-1.41M11.54 4.46l1.41-1.41"/>
          </svg>
        </button>
      </div>
    </div>

    <!-- 3. Fluent Ribbon Toolbar -->
    <div class="paint-ribbon">
      <!-- Section: Selection -->
      <div class="ribbon-section">
        <div class="ribbon-section-content">
          <button class="ribbon-btn-large" type="button" title="Select">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4">
              <rect x="3" y="3" width="18" height="18" stroke-dasharray="3 2" rx="1"/>
            </svg>
            <svg width="8" height="6" viewBox="0 0 8 6" fill="currentColor"><path d="M1 1.5l3 3 3-3z"/></svg>
          </button>
        </div>
        <span class="ribbon-label">Selection</span>
      </div>

      <div class="ribbon-divider"></div>

      <!-- Section: Image -->
      <div class="ribbon-section">
        <div class="ribbon-section-content">
          <div class="ribbon-grid-2x2">
            <div class="ribbon-row">
              <button class="ribbon-btn-mini" type="button" title="Crop">
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3">
                  <path d="M4 1v11h11M1 4h11v11"/>
                </svg>
              </button>
              <button class="ribbon-btn-mini" type="button" title="Resize and skew">
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3">
                  <rect x="2" y="2" width="7" height="7"/>
                  <rect x="7" y="7" width="7" height="7"/>
                </svg>
              </button>
            </div>
            <div class="ribbon-row">
              <button class="ribbon-btn-mini" type="button" title="Rotate or flip">
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="#005fb8" stroke-width="1.4">
                  <path d="M13 8A5 5 0 1 1 8 3"/><path d="M8 1l3 2-3 2"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
        <span class="ribbon-label">Image</span>
      </div>

      <div class="ribbon-divider"></div>

      <!-- Section: Tools -->
      <div class="ribbon-section">
        <div class="ribbon-section-content">
          <div class="ribbon-tools-grid">
            <!-- Pencil (Active) -->
            <button class="ribbon-btn-mini active" type="button" title="Pencil">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M12.5 1.5l2 2-9 9-2.5.5.5-2.5 9-9z" fill="#ffca28" stroke="#333" stroke-width="0.8"/>
                <path d="M3.5 10.5l2 2" stroke="#333" stroke-width="0.8"/>
                <path d="M3 13l-1.5.5.5-1.5L3 13z" fill="#222"/>
              </svg>
            </button>
            <!-- Fill Bucket -->
            <button class="ribbon-btn-mini" type="button" title="Fill with color">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="#2563eb" stroke-width="1.2">
                <path d="M3 7l6-6 5 5-6 6-5-5z"/><path d="M1 13c1 1 2 1 3 0s2-1 3 0" fill="#2563eb"/>
              </svg>
            </button>
            <!-- Text Tool -->
            <button class="ribbon-btn-mini" type="button" title="Text">
              <span style="font-size: 13px; font-weight: 700; color: #1e293b; font-family: serif;">A</span>
            </button>
            <!-- Eraser -->
            <button class="ribbon-btn-mini" type="button" title="Eraser">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M4 12l-2-2 7-7 4 4-7 7-2-2z" fill="#f48fb1" stroke="#333" stroke-width="0.8"/>
                <path d="M1 14h14" stroke="#333" stroke-width="1"/>
              </svg>
            </button>
            <!-- Color Picker -->
            <button class="ribbon-btn-mini" type="button" title="Color picker">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="#333" stroke-width="1.2">
                <path d="M14 2a2 2 0 0 0-2.8 0L9 4.2 11.8 7l2.2-2.2A2 2 0 0 0 14 2zM8 5.2L2 11.2V14h2.8l6-6L8 5.2z"/>
              </svg>
            </button>
            <!-- Magnifier -->
            <button class="ribbon-btn-mini" type="button" title="Magnifier">
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="#333" stroke-width="1.3">
                <circle cx="6.5" cy="6.5" r="4.5"/><path d="M10 10l4.5 4.5"/>
              </svg>
            </button>
          </div>
        </div>
        <span class="ribbon-label">Tools</span>
      </div>

      <div class="ribbon-divider"></div>

      <!-- Section: Brushes -->
      <div class="ribbon-section">
        <div class="ribbon-section-content">
          <button class="ribbon-btn-large" type="button" title="Brushes">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#333" stroke-width="1.4">
              <path d="M18 3l3 3-9 9H8v-4l10-8z"/>
              <path d="M4 21c2 0 4-1 4-3s-2-3-4-3-4 1-4 3 2 3 4 3z" fill="#4a5568"/>
            </svg>
            <svg width="8" height="6" viewBox="0 0 8 6" fill="currentColor"><path d="M1 1.5l3 3 3-3z"/></svg>
          </button>
        </div>
        <span class="ribbon-label">Brushes</span>
      </div>

      <div class="ribbon-divider"></div>

      <!-- Section: Shapes -->
      <div class="ribbon-section">
        <div class="ribbon-section-content">
          <div class="ribbon-shapes-wrap">
            <div class="ribbon-shapes-box">
              <div class="ribbon-shapes-grid">
                <!-- Line, Curve, Oval, Rect, RoundedRect, Polygon, Triangle -->
                <span class="shape-icon" title="Line"><svg width="12" height="12" viewBox="0 0 16 16"><path d="M2 14L14 2" stroke="currentColor" stroke-width="1.4"/></svg></span>
                <span class="shape-icon" title="Curve"><svg width="12" height="12" viewBox="0 0 16 16"><path d="M2 12C6 14 10 2 14 4" fill="none" stroke="currentColor" stroke-width="1.4"/></svg></span>
                <span class="shape-icon" title="Oval"><svg width="12" height="12" viewBox="0 0 16 16"><ellipse cx="8" cy="8" rx="6" ry="4.5" fill="none" stroke="currentColor" stroke-width="1.4"/></svg></span>
                <span class="shape-icon" title="Rectangle"><svg width="12" height="12" viewBox="0 0 16 16"><rect x="2" y="3" width="12" height="10" fill="none" stroke="currentColor" stroke-width="1.4"/></svg></span>
                <span class="shape-icon" title="Rounded Rectangle"><svg width="12" height="12" viewBox="0 0 16 16"><rect x="2" y="3" width="12" height="10" rx="3" fill="none" stroke="currentColor" stroke-width="1.4"/></svg></span>
                <span class="shape-icon" title="Polygon"><svg width="12" height="12" viewBox="0 0 16 16"><path d="M8 2l6 4-2 7H4L2 6z" fill="none" stroke="currentColor" stroke-width="1.3"/></svg></span>
                <span class="shape-icon" title="Triangle"><svg width="12" height="12" viewBox="0 0 16 16"><path d="M8 2l6 11H2z" fill="none" stroke="currentColor" stroke-width="1.3"/></svg></span>
                <!-- Row 2: RightTriangle, Diamond, Pentagon, Hexagon, RightArrow, LeftArrow, UpArrow -->
                <span class="shape-icon" title="Right Triangle"><svg width="12" height="12" viewBox="0 0 16 16"><path d="M2 2v11h11z" fill="none" stroke="currentColor" stroke-width="1.3"/></svg></span>
                <span class="shape-icon" title="Diamond"><svg width="12" height="12" viewBox="0 0 16 16"><path d="M8 2l5 6-5 6-5-6z" fill="none" stroke="currentColor" stroke-width="1.3"/></svg></span>
                <span class="shape-icon" title="Pentagon"><svg width="12" height="12" viewBox="0 0 16 16"><path d="M8 2l5 4-2 7H5L3 6z" fill="none" stroke="currentColor" stroke-width="1.3"/></svg></span>
                <span class="shape-icon" title="Hexagon"><svg width="12" height="12" viewBox="0 0 16 16"><path d="M5 2h6l4 6-4 6H5L1 8z" fill="none" stroke="currentColor" stroke-width="1.3"/></svg></span>
                <span class="shape-icon" title="Right Arrow"><svg width="12" height="12" viewBox="0 0 16 16"><path d="M2 6h7V3l5 5-5 5v-3H2z" fill="none" stroke="currentColor" stroke-width="1.2"/></svg></span>
                <span class="shape-icon" title="Left Arrow"><svg width="12" height="12" viewBox="0 0 16 16"><path d="M14 6H7V3L2 8l5 5v-3h7z" fill="none" stroke="currentColor" stroke-width="1.2"/></svg></span>
                <span class="shape-icon" title="Up Arrow"><svg width="12" height="12" viewBox="0 0 16 16"><path d="M6 14V7H3l5-5 5 5h-3v7z" fill="none" stroke="currentColor" stroke-width="1.2"/></svg></span>
                <!-- Row 3: DownArrow, 4-Star, 5-Star, Bubble, Cloud, Lightning, Heart -->
                <span class="shape-icon" title="Down Arrow"><svg width="12" height="12" viewBox="0 0 16 16"><path d="M6 2v7H3l5 5 5-5h-3V2z" fill="none" stroke="currentColor" stroke-width="1.2"/></svg></span>
                <span class="shape-icon" title="4-Point Star"><svg width="12" height="12" viewBox="0 0 16 16"><path d="M8 1l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" fill="none" stroke="currentColor" stroke-width="1.2"/></svg></span>
                <span class="shape-icon" title="5-Point Star"><svg width="12" height="12" viewBox="0 0 16 16"><path d="M8 1.5l2 4 4.5.7-3.2 3.2.8 4.6L8 11.8l-4.1 2.2.8-4.6L1.5 6.2l4.5-.7z" fill="none" stroke="currentColor" stroke-width="1.1"/></svg></span>
                <span class="shape-icon" title="Speech Bubble"><svg width="12" height="12" viewBox="0 0 16 16"><path d="M2 3h12v7H6l-3 3v-3H2z" fill="none" stroke="currentColor" stroke-width="1.2"/></svg></span>
                <span class="shape-icon" title="Cloud"><svg width="12" height="12" viewBox="0 0 16 16"><path d="M4 12h8a3 3 0 0 0 1-5.8 4 4 0 0 0-7.8-1A3 3 0 0 0 4 12z" fill="none" stroke="currentColor" stroke-width="1.2"/></svg></span>
                <span class="shape-icon" title="Lightning"><svg width="12" height="12" viewBox="0 0 16 16"><path d="M9 1L3 9h5l-1 6 6-8H8z" fill="none" stroke="currentColor" stroke-width="1.2"/></svg></span>
                <span class="shape-icon" title="Heart"><svg width="12" height="12" viewBox="0 0 16 16"><path d="M8 14s-6-3.5-6-7.5a3.5 3.5 0 0 1 6-2 3.5 3.5 0 0 1 6 2c0 4-6 7.5-6 7.5z" fill="none" stroke="currentColor" stroke-width="1.2"/></svg></span>
              </div>
              <div class="ribbon-shapes-scroll">
                <span class="shape-scroll-arrow"><svg width="8" height="6" viewBox="0 0 8 6"><path d="M1 4.5l3-3 3 3z" fill="currentColor"/></svg></span>
                <span class="shape-scroll-arrow"><svg width="8" height="6" viewBox="0 0 8 6"><path d="M1 1.5l3 3 3-3z" fill="currentColor"/></svg></span>
              </div>
            </div>
            <div class="ribbon-shapes-options">
              <button class="ribbon-opt-btn" type="button" title="Outline">
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2"><path d="M2 14l10-10 2 2L4 16H2v-2z"/></svg>
                <svg width="6" height="5" viewBox="0 0 8 6" fill="currentColor"><path d="M1 1.5l3 3 3-3z"/></svg>
              </button>
              <button class="ribbon-opt-btn" type="button" title="Fill">
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2"><path d="M3 7l6-6 5 5-6 6z"/><path d="M1 13c1 1 2 1 3 0"/></svg>
                <svg width="6" height="5" viewBox="0 0 8 6" fill="currentColor"><path d="M1 1.5l3 3 3-3z"/></svg>
              </button>
              <button class="ribbon-opt-btn" type="button" title="Size">
                <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                  <rect x="1" y="2" width="14" height="1"/>
                  <rect x="1" y="6" width="14" height="2"/>
                  <rect x="1" y="11" width="14" height="3"/>
                </svg>
                <svg width="6" height="5" viewBox="0 0 8 6" fill="currentColor"><path d="M1 1.5l3 3 3-3z"/></svg>
              </button>
            </div>
          </div>
        </div>
        <span class="ribbon-label">Shapes</span>
      </div>

      <div class="ribbon-divider"></div>

      <!-- Section: Colors -->
      <div class="ribbon-section">
        <div class="ribbon-section-content">
          <div class="ribbon-colors-wrap">
            <div class="ribbon-active-colors">
              <span class="color-box-primary" title="Color 1 (Foreground)"></span>
              <span class="color-box-secondary" title="Color 2 (Background)"></span>
            </div>
            <div class="color-swatches-grid">
              <!-- Row 1: 10 Colors -->
              <span class="swatch-dot" style="background:#000000;" title="Black"></span>
              <span class="swatch-dot" style="background:#7f7f7f;" title="Gray-50%"></span>
              <span class="swatch-dot" style="background:#880015;" title="Dark red"></span>
              <span class="swatch-dot" style="background:#ed1c24;" title="Red"></span>
              <span class="swatch-dot" style="background:#ff7f27;" title="Orange"></span>
              <span class="swatch-dot" style="background:#fff200;" title="Yellow"></span>
              <span class="swatch-dot" style="background:#22b14c;" title="Green"></span>
              <span class="swatch-dot" style="background:#00a2e8;" title="Turquoise"></span>
              <span class="swatch-dot" style="background:#3f48cc;" title="Indigo"></span>
              <span class="swatch-dot" style="background:#a349a4;" title="Purple"></span>
              <!-- Row 2: 10 Colors -->
              <span class="swatch-dot" style="background:#ffffff;" title="White"></span>
              <span class="swatch-dot" style="background:#c3c3c3;" title="Light gray"></span>
              <span class="swatch-dot" style="background:#b97a57;" title="Brown"></span>
              <span class="swatch-dot" style="background:#ffaec9;" title="Rose"></span>
              <span class="swatch-dot" style="background:#ffc90e;" title="Gold"></span>
              <span class="swatch-dot" style="background:#efe4b0;" title="Light yellow"></span>
              <span class="swatch-dot" style="background:#b5e61d;" title="Lime"></span>
              <span class="swatch-dot" style="background:#99d9ea;" title="Light turquoise"></span>
              <span class="swatch-dot" style="background:#7092be;" title="Blue gray"></span>
              <span class="swatch-dot" style="background:#c8bfe7;" title="Lavender"></span>
            </div>
            <button class="color-wheel-btn" type="button" title="Edit colors"></button>
          </div>
        </div>
        <span class="ribbon-label">Colors</span>
      </div>

      <div class="ribbon-divider"></div>

      <!-- Section: Copilot -->
      <div class="ribbon-section">
        <div class="ribbon-section-content">
          <button class="ribbon-btn-large" type="button" title="Copilot">
            <span class="copilot-icon">
              <!-- Microsoft Copilot ribbon SVG -->
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <path d="M12 2C6.5 2 3 5.5 3 10.5c0 3.2 1.6 5.8 4.2 7.2l-.7 2.8 3.4-1.4c.7.2 1.4.3 2.1.3 5.5 0 9-3.5 9-8.5S17.5 2 12 2z" fill="url(#copilot-grad)"/>
                <defs>
                  <linearGradient id="copilot-grad" x1="3" y1="2" x2="21" y2="21" gradientUnits="userSpaceOnUse">
                    <stop stop-color="#0078d4"/>
                    <stop offset="0.5" stop-color="#8764b8"/>
                    <stop offset="1" stop-color="#f7630c"/>
                  </linearGradient>
                </defs>
              </svg>
            </span>
          </button>
        </div>
        <span class="ribbon-label">Copilot</span>
      </div>

      <div class="ribbon-divider"></div>

      <!-- Section: Layers -->
      <div class="ribbon-section">
        <div class="ribbon-section-content">
          <button class="ribbon-btn-large" type="button" title="Layers">
            <span class="layers-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3">
                <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 12l10 5 10-5"/><path d="M2 17l10 5 10-5"/>
              </svg>
            </span>
          </button>
        </div>
        <span class="ribbon-label">Layers</span>
      </div>

      <!-- Far Right: Collapse Ribbon -->
      <div style="margin-left: auto; display: flex; align-items: flex-end; padding-bottom: 6px;">
        <button class="paint-icon-btn" title="Collapse ribbon" type="button">
          <svg width="10" height="6" viewBox="0 0 10 6" fill="currentColor"><path d="M1 1l4 4 4-4z"/></svg>
        </button>
      </div>
    </div>

    <!-- 4. Canvas Desk & Centered Paper Sheet -->
    <div class="wb-workspace" id="wb-workspace">
      <div class="paint-canvas-sheet" id="paint-canvas-sheet">
        <!-- 8 Resize Handles (Windows 11 MS Paint style) -->
        <span class="paint-handle top-left"></span>
        <span class="paint-handle top-center"></span>
        <span class="paint-handle top-right"></span>
        <span class="paint-handle left-center"></span>
        <span class="paint-handle right-center"></span>
        <span class="paint-handle bottom-left"></span>
        <span class="paint-handle bottom-center"></span>
        <span class="paint-handle bottom-right"></span>

        <!-- Viewport & Typographic Educational Canvas -->
        <div class="wb-canvas-viewport" id="wb-viewport">
          <div class="wb-canvas" id="wb-canvas">
            <!-- Dynamically populated card structure -->
          </div>
          <div id="wb-pointer" class="wb-pointer"></div>
        </div>

        <!-- Whiteboard Drawing Board Panel (Right ~60% when board is present) -->
        <div class="wb-board-panel" id="wb-board-panel">
          <canvas id="board-canvas"></canvas>
        </div>
      </div>
    </div>

    <!-- 5. Paint Status Bar -->
    <div class="paint-statusbar">
      <div class="paint-status-left">
        <span class="paint-status-item">
          <!-- Crosshair Cursor -->
          <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3">
            <path d="M8 1v5M8 10v5M1 8h5M10 8h5M8 7a1 1 0 1 0 0 2 1 1 0 0 0 0-2z"/>
          </svg>
          562, 195px
        </span>
        <span class="paint-status-divider"></span>
        <span class="paint-status-item" title="Selection">
          <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3">
            <rect x="2" y="2" width="12" height="12" stroke-dasharray="2 2" rx="1"/>
          </svg>
        </span>
        <span class="paint-status-divider"></span>
        <span class="paint-status-item">
          <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3">
            <rect x="2" y="3" width="12" height="10" rx="1"/>
          </svg>
          1801 × 648px
        </span>
        <span class="paint-status-divider"></span>
        <span class="paint-status-item" id="wb-timeline-time" style="font-variant-numeric: tabular-nums; color: #71717a;">0:00 / 0:00</span>
      </div>
      <div class="paint-status-right">
        <button class="paint-icon-btn" style="width:20px;height:20px;" title="Fit to window" type="button">
          <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3">
            <path d="M2 5V2h3M14 5V2h-3M2 11v3h3M14 11v3h-3"/>
          </svg>
        </button>
        <span class="paint-status-zoom">100% <svg width="7" height="5" viewBox="0 0 8 6" fill="currentColor"><path d="M1 1.5l3 3 3-3z"/></svg></span>
        <button class="paint-icon-btn" style="width:20px;height:20px;" title="Zoom out" type="button">
          <svg width="9" height="9" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 8h10"/></svg>
        </button>
        <div class="paint-zoom-slider">
          <div class="paint-zoom-track">
            <div class="paint-zoom-thumb"></div>
          </div>
        </div>
        <button class="paint-icon-btn" style="width:20px;height:20px;" title="Zoom in" type="button">
          <svg width="9" height="9" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3v10M3 8h10"/></svg>
        </button>
      </div>

      <!-- Live playback progress accent line -->
      <div class="paint-timeline-progress" id="wb-progress-fill"></div>
    </div>

  </div>

  <!-- Whiteboard Drawing Board Scripts -->`;

if (!oldHtmlRegex.test(content)) {
  console.error('Failed to match old whiteboard HTML markup block!');
  process.exit(1);
}
content = content.replace(oldHtmlRegex, newHtml);

if (isCRLF) {
  content = content.replace(/\n/g, '\r\n');
}

fs.writeFileSync(targetFile, content, 'utf8');
console.log('Successfully updated screen_share.html with Windows 11 MS Paint design!');

