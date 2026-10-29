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
    const cleanLabel = label.replace(/["\\]/g, '').trim();
    safeMermaid += `  ${id}["${cleanLabel}"]\n`;
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
          fontFamily:   'Outfit, Inter, Segoe UI, Arial, sans-serif',
          fontSize:      16,
          flowchart:    { curve: 'basis', padding: 15, nodeSpacing: 35, rankSpacing: 45, useMaxWidth: true },
          sequence:     { actorMargin: 50, messageMargin: 20, useMaxWidth: true }
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

/**
 * Converts a Mermaid flowchart string into structured Whiteboard Board data.
 * Supports:
 * - Rectangles: id["label"] or id[label]
 * - Rounded boxes: id("label") or id(label)
 * - Stadiums: id(["label"]) or id([label])
 * - Rhombuses / Decision diamonds: id{"label"} or id{label}
 * - Connectors / Edges: A --> B, A -->|label| B, A -- label --> B
 * - Orientations: TD, TB (vertical), LR (horizontal)
 *
 * @param {string} mermaidCode 
 * @param {string} [defaultHeading]
 * @param {Object} [options] - Whiteboard styling options (drawingStyle, roughness, bowing, seed, etc.)
 * @returns {Object|null} Board data object
 */
function mermaidToBoard(mermaidCode, defaultHeading, options) {
  if (!mermaidCode || typeof mermaidCode !== 'string') return null;
  options = options || {};

  // Determine layout orientation
  let layout = 'vertical';
  const orientationMatch = mermaidCode.match(/^\s*(?:graph|flowchart)\s+([A-Za-z]{2})/i);
  if (orientationMatch) {
    const ori = orientationMatch[1].toUpperCase();
    if (ori === 'LR' || ori === 'RL') {
      layout = 'horizontal';
    } else {
      layout = 'vertical';
    }
  }

  const nodes = [];
  const nodeMap = new Map();
  const edges = [];

  const lines = mermaidCode.split('\n');
  const validNodePattern = /([a-zA-Z0-9_\-]+)\s*(?:\[\[(.*?)\]\]|\(\[(.*?)\]\)|\{\{\s*(.*?)\s*\}\}|\{\s*(.*?)\s*\}|\(\s*(.*?)\s*\)|\[\s*(.*?)\s*\])/g;

  for (let rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('graph') || line.startsWith('flowchart') || line.startsWith('%%') || line.startsWith('subgraph') || line.startsWith('end')) {
      continue;
    }

    // 1. Extract node definitions
    let match;
    while ((match = validNodePattern.exec(line)) !== null) {
      const id = match[1];
      // match[2] = [[...]], match[3] = ([...]), match[4] = {{...}}, match[5] = {...}, match[6] = (...), match[7] = [...]
      let rawLabel = match[3] || match[5] || match[6] || match[7] || match[2] || id;
      let shape = 'rect';
      if (match[3]) shape = 'round'; // stadium / rounded
      else if (match[5]) shape = 'rhombus'; // decision branch
      else if (match[6]) shape = 'round'; // rounded
      else if (match[7]) shape = 'rect'; // rectangular box

      // Clean label
      const cleanLabel = rawLabel.replace(/^["']|["']$/g, '').replace(/\\n/g, '\n').trim();

      if (!nodeMap.has(id)) {
        const nodeObj = {
          id: id,
          label: cleanLabel || id,
          shape: shape,
          color: shape === 'rhombus' ? '#ea580c' : '#2563eb'
        };
        nodeMap.set(id, nodeObj);
        nodes.push(nodeObj);
      }
    }
    validNodePattern.lastIndex = 0;

    // 2. Extract edge connectors:
    // Strip bracketed node labels from the line so node identifiers are clean before and after connectors
    let lineForEdges = line.replace(/\[\[.*?\]\]|\(\[.*?\]\)|\{\{.*?\}\}|\{.*?\}|\(.*?\)|\[.*?\]/g, '');

    // Pattern: A --> B, A -->|label| B, A -.-> B
    const edgeRegex = /([a-zA-Z0-9_\-]+)\s*(?:-->|---\.?->?|-\.->)\s*(?:\|([^|]+)\|)?\s*([a-zA-Z0-9_\-]+)/g;
    let edgeMatch;
    while ((edgeMatch = edgeRegex.exec(lineForEdges)) !== null) {
      const from = edgeMatch[1];
      const edgeLabel = (edgeMatch[2] || '').trim();
      const to = edgeMatch[3];

      // Ensure nodes exist even if declared inline without bracket definition
      if (!nodeMap.has(from)) {
        const nObj = { id: from, label: from, shape: 'rect', color: '#2563eb' };
        nodeMap.set(from, nObj);
        nodes.push(nObj);
      }
      if (!nodeMap.has(to)) {
        const nObj = { id: to, label: to, shape: 'rect', color: '#2563eb' };
        nodeMap.set(to, nObj);
        nodes.push(nObj);
      }

      edges.push({
        from: from,
        to: to,
        label: edgeLabel || undefined,
        arrow: true,
        color: '#64748b'
      });
    }

    // Pattern: A -- label --> B
    const labeledEdgeRegex = /([a-zA-Z0-9_\-]+)\s*--\s*([^-]+?)\s*-->\s*([a-zA-Z0-9_\-]+)/g;
    let lblMatch;
    while ((lblMatch = labeledEdgeRegex.exec(lineForEdges)) !== null) {
      const from = lblMatch[1];
      const edgeLabel = lblMatch[2].trim();
      const to = lblMatch[3];

      if (!nodeMap.has(from)) {
        const nObj = { id: from, label: from, shape: 'rect', color: '#2563eb' };
        nodeMap.set(from, nObj);
        nodes.push(nObj);
      }
      if (!nodeMap.has(to)) {
        const nObj = { id: to, label: to, shape: 'rect', color: '#2563eb' };
        nodeMap.set(to, nObj);
        nodes.push(nObj);
      }

      edges.push({
        from: from,
        to: to,
        label: edgeLabel,
        arrow: true,
        color: '#64748b'
      });
    }
  }

  if (nodes.length === 0) {
    return null;
  }

  // If node count is large (>= 6) and orientation is vertical, layout should be 'flowchart' or 'vertical'
  if (nodes.length >= 6 && layout === 'vertical') {
    layout = 'flowchart';
  }

  const resBoard = {
    heading: defaultHeading ? defaultHeading.split(/\s+/).slice(0, 4).join(' ') : 'Diagram Flow',
    layout: layout,
    nodes: nodes,
    edges: edges,
    showCursor: true
  };

  if (options.drawingStyle) resBoard.drawingStyle = options.drawingStyle;
  if (typeof options.roughness === 'number') resBoard.roughness = options.roughness;
  if (typeof options.bowing === 'number') resBoard.bowing = options.bowing;
  if (typeof options.strokeWidthVariation === 'number') resBoard.strokeWidthVariation = options.strokeWidthVariation;
  if (typeof options.doubleStroke === 'boolean') resBoard.doubleStroke = options.doubleStroke;
  if (typeof options.seed === 'number' || typeof options.seed === 'string') resBoard.seed = options.seed;

  return resBoard;
}

/**
 * Converts Gemini structured visual ({ nodes, connections, type, title }) into Whiteboard Board data.
 *
 * @param {Object} visual
 * @param {string} [defaultHeading]
 * @param {Object} [options] - Whiteboard styling options (drawingStyle, roughness, bowing, seed, etc.)
 * @returns {Object|null}
 */
function visualToBoard(visual, defaultHeading, options) {
  if (!visual || !Array.isArray(visual.nodes) || visual.nodes.length === 0) {
    return null;
  }
  options = options || {};

  let layout = 'horizontal';
  const vType = (visual.type || '').toLowerCase();
  if (vType.includes('flow') || vType.includes('seq') || vType.includes('tree') || visual.nodes.length >= 5) {
    layout = visual.nodes.length >= 6 ? 'flowchart' : 'vertical';
  }

  const nodes = visual.nodes.map((n, idx) => {
    let shape = 'rect';
    const rawShape = (n.shape || '').toLowerCase();
    if (rawShape === 'circle' || rawShape === 'ellipse' || rawShape === 'round') {
      shape = 'round';
    } else if (rawShape === 'diamond' || rawShape === 'rhombus' || rawShape === 'decision') {
      shape = 'rhombus';
    }

    return {
      id: String(n.id || `node_${idx + 1}`),
      label: n.label || n.text || String(n.id || `Step ${idx + 1}`),
      shape: shape,
      color: shape === 'rhombus' ? '#ea580c' : (n.color || '#2563eb'),
      sentenceIndex: typeof n.sentenceIndex === 'number' ? n.sentenceIndex : undefined
    };
  });

  const edges = [];
  if (Array.isArray(visual.connections)) {
    for (const conn of visual.connections) {
      if (conn.from && conn.to) {
        edges.push({
          from: String(conn.from),
          to: String(conn.to),
          label: conn.label || undefined,
          arrow: conn.arrow !== false,
          color: '#64748b'
        });
      }
    }
  }

  const headingText = visual.title || defaultHeading || 'Visual Explanation';

  const resVisualBoard = {
    heading: headingText.split(/\s+/).slice(0, 4).join(' '),
    layout: layout,
    nodes: nodes,
    edges: edges,
    showCursor: true
  };

  const styleSource = Object.assign({}, visual, options);
  if (styleSource.drawingStyle) resVisualBoard.drawingStyle = styleSource.drawingStyle;
  if (typeof styleSource.roughness === 'number') resVisualBoard.roughness = styleSource.roughness;
  if (typeof styleSource.bowing === 'number') resVisualBoard.bowing = styleSource.bowing;
  if (typeof styleSource.strokeWidthVariation === 'number') resVisualBoard.strokeWidthVariation = styleSource.strokeWidthVariation;
  if (typeof styleSource.doubleStroke === 'boolean') resVisualBoard.doubleStroke = styleSource.doubleStroke;
  if (typeof styleSource.seed === 'number' || typeof styleSource.seed === 'string') resVisualBoard.seed = styleSource.seed;

  return resVisualBoard;
}

module.exports = {
  renderMermaidInPage,
  reset,
  sanitizeMermaid,
  mermaidToBoard,
  visualToBoard
};
