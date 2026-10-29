#!/usr/bin/env node
/**
 * board-preview.js
 *
 * Standalone CLI tool that reads a board JSON file (or uses a built-in demo)
 * and renders progressive stroke-animation PNGs to disk.
 *
 * Usage:
 *   node scratch/board-preview.js                          # built-in demo, 10s
 *   node scratch/board-preview.js  path/to/board.json      # custom board, 10s
 *   node scratch/board-preview.js  path/to/board.json 15   # custom board, 15s
 *
 * Output:  server/output/board-preview/frame_00000.png … frame_NNNNN.png
 *
 * Environment variables (optional):
 *   VIDEO_RENDER_FPS_BOARD  – frames per second (default 8)
 */

const path = require('path');
const fs   = require('fs');

// Load .env so FPS env var is picked up
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { renderBoardFrames, validateBoard } = require('../services/board.service');

// ─── Built-in demo board ─────────────────────────────────────────────────────

const DEMO_BOARD = {
  heading: 'Binary Search',
  width:  1280,
  height: 720,
  strokes: [
    // Sorted array boxes
    { type: 'rect', id: 'box0', x: 100, y: 200, w: 80, h: 60, color: '#3b82f6', width: 2.5 },
    { type: 'text', id: 'lbl0', x: 140, y: 232, text: '2',   color: '#1e293b', fontSize: 26, fontWeight: '600' },

    { type: 'rect', id: 'box1', x: 200, y: 200, w: 80, h: 60, color: '#3b82f6', width: 2.5 },
    { type: 'text', id: 'lbl1', x: 240, y: 232, text: '5',   color: '#1e293b', fontSize: 26, fontWeight: '600' },

    { type: 'rect', id: 'box2', x: 300, y: 200, w: 80, h: 60, color: '#3b82f6', width: 2.5 },
    { type: 'text', id: 'lbl2', x: 340, y: 232, text: '8',   color: '#1e293b', fontSize: 26, fontWeight: '600' },

    { type: 'rect', id: 'box3', x: 400, y: 200, w: 80, h: 60, color: '#ef4444', width: 3, fill: 'rgba(239,68,68,0.08)' },
    { type: 'text', id: 'lbl3', x: 440, y: 232, text: '12',  color: '#ef4444', fontSize: 26, fontWeight: '700' },

    { type: 'rect', id: 'box4', x: 500, y: 200, w: 80, h: 60, color: '#3b82f6', width: 2.5 },
    { type: 'text', id: 'lbl4', x: 540, y: 232, text: '17',  color: '#1e293b', fontSize: 26, fontWeight: '600' },

    { type: 'rect', id: 'box5', x: 600, y: 200, w: 80, h: 60, color: '#3b82f6', width: 2.5 },
    { type: 'text', id: 'lbl5', x: 640, y: 232, text: '23',  color: '#1e293b', fontSize: 26, fontWeight: '600' },

    { type: 'rect', id: 'box6', x: 700, y: 200, w: 80, h: 60, color: '#3b82f6', width: 2.5 },
    { type: 'text', id: 'lbl6', x: 740, y: 232, text: '31',  color: '#1e293b', fontSize: 26, fontWeight: '600' },

    // Low / Mid / High pointer arrows
    { type: 'arrow', id: 'low',  x1: 140, y1: 290, x2: 140, y2: 268, color: '#22c55e', width: 2.5 },
    { type: 'text',  id: 'lowL', x: 140, y: 310, text: 'low', color: '#22c55e', fontSize: 18, fontWeight: '600' },

    { type: 'arrow', id: 'mid',  x1: 440, y1: 290, x2: 440, y2: 268, color: '#ef4444', width: 2.5 },
    { type: 'text',  id: 'midL', x: 440, y: 310, text: 'mid', color: '#ef4444', fontSize: 18, fontWeight: '700' },

    { type: 'arrow', id: 'high', x1: 740, y1: 290, x2: 740, y2: 268, color: '#f59e0b', width: 2.5 },
    { type: 'text',  id: 'highL', x: 740, y: 310, text: 'high', color: '#f59e0b', fontSize: 18, fontWeight: '600' },

    // Explanatory text
    { type: 'text', id: 'explain1', x: 640, y: 420, text: 'Target = 12  →  arr[mid] == 12  ✓  Found!', color: '#0f172a', fontSize: 24, fontWeight: '600' },

    // Free-hand underline under "Found!"
    {
      type: 'path', id: 'underline', color: '#ef4444', width: 3,
      points: [
        { x: 820, y: 435 }, { x: 840, y: 437 }, { x: 870, y: 436 },
        { x: 900, y: 438 }, { x: 930, y: 435 }, { x: 950, y: 437 },
      ]
    },

    // Big-O notation at bottom
    { type: 'text', id: 'bigO', x: 640, y: 500, text: 'Time: O(log n)',  color: '#6366f1', fontSize: 30, fontWeight: '700' },
    { type: 'text', id: 'space', x: 640, y: 545, text: 'Space: O(1)',    color: '#6366f1', fontSize: 24, fontWeight: '500' },

    // Decorative brace around the array (simple ellipse)
    { type: 'ellipse', id: 'brace', cx: 440, cy: 230, rx: 370, ry: 55, color: '#94a3b8', width: 1.5 },
  ],
};

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);

  let board;
  let durationSecs = 10;

  if (args[0] && !args[0].startsWith('-')) {
    // Read board from JSON file
    const jsonPath = path.resolve(args[0]);
    if (!fs.existsSync(jsonPath)) {
      console.error(`File not found: ${jsonPath}`);
      process.exit(1);
    }
    try {
      const raw = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
      // Support both { board: { ... } } wrapper and direct board object
      board = raw.board || raw;
    } catch (e) {
      console.error(`Failed to parse JSON: ${e.message}`);
      process.exit(1);
    }
    console.log(`[board-preview] Loaded board from ${jsonPath}`);
  } else {
    board = DEMO_BOARD;
    console.log('[board-preview] Using built-in demo board (Binary Search)');
  }

  if (args[1]) {
    durationSecs = parseFloat(args[1]) || 10;
  }

  // Validate
  let validated;
  try {
    validated = validateBoard(board);
    console.log(`[board-preview] Board validated: ${validated.strokes.length} strokes, canvas ${validated.width}×${validated.height}${validated.heading ? `, heading="${validated.heading}"` : ''}`);
  } catch (e) {
    console.error(`[board-preview] Validation failed: ${e.message}`);
    process.exit(1);
  }

  const outDir = path.join(__dirname, '../output/board-preview');
  // Clean previous output
  if (fs.existsSync(outDir)) {
    const old = fs.readdirSync(outDir).filter(f => f.endsWith('.png'));
    for (const f of old) fs.unlinkSync(path.join(outDir, f));
  }

  console.log(`[board-preview] Output directory: ${outDir}`);
  console.log(`[board-preview] Duration: ${durationSecs}s`);

  const result = await renderBoardFrames(board, durationSecs, outDir);

  console.log('\n===================================');
  console.log(`  Board Preview Complete`);
  console.log(`  Frames: ${result.frames.length}`);
  console.log(`  FPS:    ${result.fps}`);
  console.log(`  Output: ${outDir}`);
  console.log('===================================');
  console.log(`\nFirst frame: ${result.frames[0]}`);
  console.log(`Last frame:  ${result.frames[result.frames.length - 1]}`);
}

main().catch(err => {
  console.error('[board-preview] Fatal error:', err);
  process.exit(1);
});
