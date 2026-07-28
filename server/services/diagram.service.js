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
async function renderMermaidInPage(page, mermaidCode) {
  // ── Step 1: Inject Mermaid from CDN (only once per session) ────────────────
  if (!_mermaidInjected) {
    console.log('[DiagramService] Loading Mermaid.js from CDN into existing page...');
    try {
      await page.addScriptTag({ url: MERMAID_CDN });
      // Wait until mermaid global is available
      await page.waitForFunction(() => typeof window.mermaid !== 'undefined', { timeout: 20000 });
      // Initialise with educational whiteboard styling
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

  // ── Step 2: Render the Mermaid code → SVG string inside the page ───────────
  const uniqueId = `mermaid-${Date.now()}`;

  const svg = await page.evaluate(async (code, id) => {
    try {
      const { svg } = await window.mermaid.render(id, code);
      return svg;
    } catch (err) {
      // Return a visible error placeholder so the video doesn't silently break
      return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="200">
        <rect width="800" height="200" fill="#fff0f0" rx="12"/>
        <text x="20" y="60" font-size="18" fill="#cc0000" font-family="Arial">
          Diagram render error:
        </text>
        <text x="20" y="100" font-size="14" fill="#333" font-family="Arial">
          ${err.message.substring(0, 120)}
        </text>
      </svg>`;
    }
  }, mermaidCode, uniqueId);

  // ── Step 3: Display the SVG in the overlay panel ────────────────────────────
  await page.evaluate((svgHtml) => {
    window.showDiagramSvg(svgHtml);
  }, svg);

  // Brief settle for any SVG layout/font rendering
  await new Promise(r => setTimeout(r, 300));
}

module.exports = { renderMermaidInPage, reset };
