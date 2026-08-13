/**
 * visual.actions.js
 *
 * Action handlers for visual feedback during recording:
 *   highlight, showTooltip, takeScreenshot
 */

const path = require('path');
const human = require('../humanBehavior');
const { resolveElement } = require('./interaction.actions');

/**
 * Highlight an element with a colored ring to draw attention.
 * @param {import('puppeteer').Page} page
 * @param {object} params - { selector?, text? }
 */
async function highlight(page, params) {
  const target = params.selector || params.text || params.target?.label || '';
  console.log(`  [action:highlight] Highlighting "${target}"`);

  params.action = params.action || 'highlight';
  const element = await resolveElement(page, params);
  if (!element) {
    return { success: false, message: `Could not find element to highlight: ${target}` };
  }

  // Scroll element into view if it's off-screen
  try {
    await element.evaluate(el => el.scrollIntoView({ behavior: 'smooth', block: 'center' }));
    await human.randomPause(300, 500);
  } catch { /* proceed */ }

  const box = await element.boundingBox();
  if (!box) {
    // Element still has no bounding box — might be hidden. Return success to not block execution.
    console.log(`  [action:highlight] Element "${target}" has no bounding box, skipping highlight.`);
    return { success: true, message: `Element "${target}" found but not visible for highlight.` };
  }

  // Inject highlight overlay
  await page.evaluate((rect) => {
    // Remove any previous highlight
    const existing = document.getElementById('__vg_highlight');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = '__vg_highlight';
    overlay.style.cssText = `
      position: fixed;
      left: ${rect.x - 6}px;
      top: ${rect.y - 6}px;
      width: ${rect.width + 12}px;
      height: ${rect.height + 12}px;
      border: 3px solid #ff6b35;
      border-radius: 8px;
      box-shadow: 0 0 20px rgba(255, 107, 53, 0.6), inset 0 0 8px rgba(255, 107, 53, 0.15);
      pointer-events: none;
      z-index: 999999;
      animation: vg-pulse 1.2s ease-in-out 2;
    `;

    // Add pulse animation
    if (!document.getElementById('__vg_highlight_style')) {
      const style = document.createElement('style');
      style.id = '__vg_highlight_style';
      style.textContent = `
        @keyframes vg-pulse {
          0%, 100% { box-shadow: 0 0 12px rgba(255, 107, 53, 0.4); }
          50% { box-shadow: 0 0 24px rgba(255, 107, 53, 0.8); }
        }
      `;
      document.head.appendChild(style);
    }

    document.body.appendChild(overlay);
    setTimeout(() => {
      overlay.style.opacity = '0';
      overlay.style.transition = 'opacity 0.4s ease';
      setTimeout(() => overlay.remove(), 400);
    }, 2500);
  }, { x: box.x, y: box.y, width: box.width, height: box.height });

  // Move mouse to the element for emphasis
  await human.moveMouseNaturally(page, box.x + box.width / 2, box.y + box.height / 2);
  await human.randomPause(1500, 2500);
  return { success: true, message: `Highlighted "${target}"` };
}

/**
 * Show a tooltip overlay near an element or position.
 * @param {import('puppeteer').Page} page
 * @param {object} params - { text: string, selector?: string, x?: number, y?: number }
 */
async function showTooltip(page, params) {
  const text = params.value || params.text || 'Note';
  console.log(`  [action:showTooltip] Showing tooltip: "${text}"`);

  let position = { x: 960, y: 540 }; // Default to center

  if (params.selector) {
    const element = await resolveElement(page, { selector: params.selector });
    if (element) {
      const box = await element.boundingBox();
      if (box) {
        position = { x: box.x + box.width / 2, y: box.y };
      }
    }
  } else if (params.x && params.y) {
    position = { x: params.x, y: params.y };
  }

  await human.showTooltipOverlay(page, text, position);
  await human.randomPause(2000, 3000);
  return { success: true, message: `Showed tooltip: "${text}"` };
}

/**
 * Take a PNG screenshot and save it to disk.
 * @param {import('puppeteer').Page} page
 * @param {object} params - { filename?: string, outputDir?: string }
 */
async function takeScreenshot(page, params) {
  const outputDir = params.outputDir || path.join(__dirname, '../../../output');
  const filename = params.filename || `screenshot_${Date.now()}.png`;
  const filePath = path.join(outputDir, filename);

  console.log(`  [action:takeScreenshot] Saving screenshot: ${filename}`);
  await page.screenshot({ path: filePath, fullPage: false });
  await human.randomPause(300, 500);
  return { success: true, message: `Screenshot saved: ${filePath}` };
}

module.exports = { highlight, showTooltip, takeScreenshot };
