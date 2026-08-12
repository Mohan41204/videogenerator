/**
 * diagram.service.js
 *
 * Renders a Mermaid.js diagram INSIDE an already-running Puppeteer page.
 *
 * IMPORTANT: This module does NOT launch its own browser — doing so while
 * FFmpeg is piping frames causes the FFmpeg process to be killed (null exit code).
 * Instead, it injects Mermaid.js via page.addScriptTag() into the existing page
 * and renders the SVG directly into the diagram overlay panel in screen_share.html.
 *
 * Usage:
 *   const diagramService = require('./diagram.service');
 *   await diagramService.renderMermaidInPage(page, mermaidCode);
 */

const MERMAID_CDN = 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js';

// Track whether Mermaid has already been injected into the page
// so we only pay the CDN load cost once per recording session.
let _mermaidInjected = false;

/**
 * Reset the injection flag between recording sessions.
 * Call this at the start of each renderScreenShareVideo() call.
 */
function reset() {
  _mermaidInjected = false;
}

/**
 * Inject Mermaid.js into the existing page (once) and render the given
 * Mermaid code as an SVG inside the diagram overlay panel.
 *
 * The page must have already called window.showDiagramSvg() defined in
 * screen_share.html.
 *
 * @param {import('puppeteer').Page} page        - The already-open Puppeteer page
 * @param {string}                   mermaidCode - Valid Mermaid.js diagram code
 * @returns {Promise<void>}
 */
function sanitizeMermaid(mermaidCode) {
  if (!mermaidCode) return '';
  
  // Extract orientation/graph type
  let orientation = 'TD';
  let graphType = 'graph';
  const headerMatch = mermaidCode.match(/^\s*(graph|flowchart)\s+(TD|LR|TB|BT|RL)/i);
  if (headerMatch) {
    graphType = headerMatch[1];
    orientation = headerMatch[2];
  }
  
  const nodes = new Map(); // id -> label
  const edges = [];
  
  const lines = mermaidCode.split('\n');
  for (let line of lines) {
    line = line.trim();
    if (!line || line.startsWith('graph') || line.startsWith('flowchart')) continue;
    
    // We require node definitions to be at the start of a line/statement or directly after edge connectors
    const prefix = '(^\\s*|-->\\s*|---\\s*|-\\.-?>\\s*|-\\.-?\\s*)';
    const stadiumRegex = new RegExp(`${prefix}([a-zA-Z0-9_-]+)\\s*\\(\\[\\s*(.*?)\\s*\\]\\)`, 'g');
    const rectRegex = new RegExp(`${prefix}([a-zA-Z0-9_-]+)\\s*\\[\\s*(.*?)\\s*\\]`, 'g');
    const roundRegex = new RegExp(`${prefix}([a-zA-Z0-9_-]+)\\s*\\(\\s*(.*?)\\s*\\)`, 'g');
    const rhombusRegex = new RegExp(`${prefix}([a-zA-Z0-9_-]+)\\s*\\{\\s*(.*?)\\s*\\}`, 'g');
    
    let match;
    // 1. Double bracket stadium shape ([label])
    while ((match = stadiumRegex.exec(line)) !== null) {
      nodes.set(match[2], match[3].trim());
    }
    stadiumRegex.lastIndex = 0; // reset
    
    // 2. Standard rectangular [label]
    while ((match = rectRegex.exec(line)) !== null) {
      nodes.set(match[2], match[3].trim());
    }
    rectRegex.lastIndex = 0; // reset
    
    // 3. Round (label)
    while ((match = roundRegex.exec(line)) !== null) {
      const id = match[2];
      const val = match[3].trim();
      if (!val.startsWith('[') || !val.endsWith(']')) {
        nodes.set(id, val);
      }
    }
    roundRegex.lastIndex = 0; // reset
    
    // 4. Decision/Rhombus {label}
    while ((match = rhombusRegex.exec(line)) !== null) {
      nodes.set(match[2], match[3].trim());
    }
    rhombusRegex.lastIndex = 0; // reset
    
    // Clean node definitions on this line to isolate edges
    let cleanLine = line;
    cleanLine = cleanLine.replace(stadiumRegex, '$1$2');
    cleanLine = cleanLine.replace(rectRegex, '$1$2');
    cleanLine = cleanLine.replace(roundRegex, '$1$2');
    cleanLine = cleanLine.replace(rhombusRegex, '$1$2');
    
    if (cleanLine.includes('-->') || cleanLine.includes('---') || cleanLine.includes('-.->')) {
      edges.push(cleanLine);
    }
  }
  
  if (nodes.size === 0 && edges.length === 0) {
    return mermaidCode;
  }
  
  let safeMermaid = `${graphType} ${orientation}\n`;
  for (const [id, label] of nodes.entries()) {
    const escapedLabel = label.replace(/"/g, '\\"');
    safeMermaid += `  ${id}["${escapedLabel}"]\n`;
  }
  for (const edge of edges) {
    safeMermaid += `  ${edge}\n`;
  }
  
  return safeMermaid;
}

/**
 * Inject Mermaid.js into the existing page (once) and render the given
 * Mermaid code as an SVG inside the diagram overlay panel.
 *
 * @param {import('puppeteer').Page} page        - The already-open Puppeteer page
 * @param {string}                   mermaidCode - Valid Mermaid.js diagram code
 * @returns {Promise<void>}
 */
async function renderMermaidInPage(page, mermaidCode) {
  console.log(`[Diagram] Data received: ${!!mermaidCode}`);
  console.log(`[Diagram] Generated Mermaid:\n${mermaidCode}`);

  const sanitizedCode = sanitizeMermaid(mermaidCode);
  console.log(`[Diagram] Sanitized Mermaid:\n${sanitizedCode}`);

  // ── Step 1: Inject Mermaid from CDN (only once per session) ────────────────
  if (!_mermaidInjected) {
    console.log('[DiagramService] Loading Mermaid.js from CDN into existing page...');
    try {
      await page.addScriptTag({ url: MERMAID_CDN });
      await page.waitForFunction(() => typeof window.mermaid !== 'undefined', { timeout: 20000 });
      await page.evaluate(() => {
        window.mermaid.initialize({
          startOnLoad: false,
          theme:        'default',
          securityLevel:'loose',
          fontFamily:   'Segoe UI, Arial, sans-serif',
          fontSize:      20,
          flowchart:    { curve: 'basis', padding: 30, nodeSpacing: 60, rankSpacing: 80 },
          sequence:     { actorMargin: 80, messageMargin: 30 },
          wrap:          true
        });
      });
      _mermaidInjected = true;
      console.log('[DiagramService] Mermaid.js ready.');
    } catch (err) {
      throw new Error(`[DiagramService] Failed to load Mermaid from CDN: ${err.message}`);
    }
  }

  // ── Step 2: Validate Mermaid syntax inside Puppeteer ──────────────────────
  let isValid = false;
  try {
    await page.evaluate(async (code) => {
      await window.mermaid.parse(code);
    }, sanitizedCode);
    isValid = true;
  } catch (err) {
    console.error(`[Diagram] Validation FAIL: ${err.message}`);
  }
  console.log(`[Diagram] Mermaid valid: ${isValid}`);

  // ── Step 3: Render the Mermaid code → SVG string inside the page ───────────
  const uniqueId = `mermaid-${Date.now()}`;

  const svg = await page.evaluate(async (code, id) => {
    try {
      const { svg } = await window.mermaid.render(id, code);
      return svg;
    } catch (err) {
      console.error('[Diagram] Rendering FAILED:', err.message);
      // Return a blank transparent SVG so the video doesn't show an error box
      return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="400" viewBox="0 0 800 400" style="background:transparent;"></svg>`;
    }
  }, sanitizedCode, uniqueId);

  console.log(`[Diagram] SVG generated: ${!!svg}`);

  // ── Step 4: Display the SVG in the overlay panel ────────────────────────────
  await page.evaluate((svgHtml) => {
    window.showDiagramSvg(svgHtml);
  }, svg);

  console.log(`[Diagram] Added to whiteboard: true`);
  console.log(`[Diagram] Visible: true`);
  console.log(`[Diagram] Captured: true`);

  // Brief settle for any SVG layout/font rendering
  await new Promise(r => setTimeout(r, 300));
}

module.exports = { renderMermaidInPage, reset };
