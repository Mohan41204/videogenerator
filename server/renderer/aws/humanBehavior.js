/**
 * humanBehavior.js
 *
 * Human-like interaction utilities for browser automation.
 * Every function adds natural imperfection — random delays, curved mouse paths,
 * gradual scrolling, and realistic typing cadence — so recordings look like
 * a real instructor demonstrating on screen.
 *
 * All functions are stateless helpers that operate on a Puppeteer Page instance.
 */

const awsConfig = require('../../config/aws.config');
const { timing } = awsConfig;

// ── Random Utilities ────────────────────────────────────────────────────

/**
 * Return a random integer between min and max (inclusive).
 */
function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Return a random float between min and max.
 */
function randFloat(min, max) {
  return Math.random() * (max - min) + min;
}

/**
 * Pause execution for a random duration within the given range.
 * @param {number} minMs
 * @param {number} maxMs
 */
async function randomPause(minMs, maxMs) {
  const ms = randInt(minMs, maxMs);
  await new Promise((r) => setTimeout(r, ms));
}

/**
 * Pause between distinct actions (uses config defaults).
 */
async function actionPause() {
  await randomPause(timing.actionPauseMin, timing.actionPauseMax);
}

/**
 * Short pause after a click.
 */
async function clickPause() {
  await randomPause(timing.clickPauseMin, timing.clickPauseMax);
}

// ── Mouse Movement ──────────────────────────────────────────────────────

/**
 * Generate Bezier curve control points for natural mouse movement.
 * Returns an array of {x, y} points along the curve.
 */
function bezierCurve(startX, startY, endX, endY, steps) {
  const points = [];

  // Two random control points for a cubic Bezier curve
  const cp1x = startX + (endX - startX) * randFloat(0.2, 0.4) + randInt(-40, 40);
  const cp1y = startY + (endY - startY) * randFloat(0.1, 0.3) + randInt(-30, 30);
  const cp2x = startX + (endX - startX) * randFloat(0.6, 0.8) + randInt(-40, 40);
  const cp2y = startY + (endY - startY) * randFloat(0.7, 0.9) + randInt(-30, 30);

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const u = 1 - t;
    const x = u * u * u * startX +
              3 * u * u * t * cp1x +
              3 * u * t * t * cp2x +
              t * t * t * endX;
    const y = u * u * u * startY +
              3 * u * u * t * cp1y +
              3 * u * t * t * cp2y +
              t * t * t * endY;
    points.push({ x: Math.round(x), y: Math.round(y) });
  }
  return points;
}

/**
 * Move the mouse from its current position to (targetX, targetY)
 * following a natural Bezier curve with slight jitter.
 *
 * @param {import('puppeteer').Page} page
 * @param {number} targetX
 * @param {number} targetY
 */
async function moveMouseNaturally(page, targetX, targetY) {
  // Get current mouse position (default to center of viewport)
  const currentPos = await page.evaluate(() => {
    return {
      x: window.__mouseX || 960,
      y: window.__mouseY || 540,
    };
  });

  const steps = randInt(15, 30);
  const points = bezierCurve(currentPos.x, currentPos.y, targetX, targetY, steps);
  const stepDelay = Math.floor(timing.mouseMoveDuration / steps);

  for (const point of points) {
    // Add small jitter (±2px) for realism
    const jitterX = point.x + randInt(-2, 2);
    const jitterY = point.y + randInt(-2, 2);
    await page.mouse.move(jitterX, jitterY);
    await new Promise((r) => setTimeout(r, stepDelay));
  }

  // Store final position for the next movement
  await page.evaluate((x, y) => {
    window.__mouseX = x;
    window.__mouseY = y;
  }, targetX, targetY);
}

/**
 * Small random mouse jitter to avoid perfectly still cursor.
 * @param {import('puppeteer').Page} page
 */
async function naturalMouseJitter(page) {
  const pos = await page.evaluate(() => ({
    x: window.__mouseX || 960,
    y: window.__mouseY || 540,
  }));
  const jX = pos.x + randInt(-8, 8);
  const jY = pos.y + randInt(-5, 5);
  await page.mouse.move(jX, jY);
  await new Promise((r) => setTimeout(r, randInt(50, 150)));
}

// ── Typing ──────────────────────────────────────────────────────────────

/**
 * Type text character-by-character with realistic random delays.
 * Mimics a human typist — faster on common letters, slower on numbers/specials.
 *
 * @param {import('puppeteer').Page} page
 * @param {string} text - Text to type
 * @param {string} [selector] - Optional: focus this selector before typing
 */
async function typeNaturally(page, text, selector) {
  if (selector) {
    await page.click(selector);
    await randomPause(100, 250);
  }

  for (const char of text) {
    // Numbers and special chars are typed more slowly
    const isSpecial = /[^a-zA-Z ]/.test(char);
    const delay = isSpecial
      ? randInt(timing.typingDelayMax, timing.typingDelayMax + 60)
      : randInt(timing.typingDelayMin, timing.typingDelayMax);

    await page.keyboard.type(char, { delay: 0 });
    await new Promise((r) => setTimeout(r, delay));
  }
}

// ── Scrolling ───────────────────────────────────────────────────────────

/**
 * Scroll the page smoothly by the given pixel distance.
 * Positive = scroll down, negative = scroll up.
 *
 * @param {import('puppeteer').Page} page
 * @param {number} distance - Pixels to scroll
 */
async function smoothScroll(page, distance) {
  const direction = distance > 0 ? 1 : -1;
  let remaining = Math.abs(distance);
  const step = timing.scrollStepPx;

  while (remaining > 0) {
    const delta = Math.min(step, remaining);
    await page.mouse.wheel({ deltaY: direction * delta });
    remaining -= delta;
    await new Promise((r) => setTimeout(r, timing.scrollStepDelay + randInt(0, 15)));
  }
}

// ── Click with Highlight ────────────────────────────────────────────────

/**
 * Click an element with a brief visual highlight ring around it.
 * The highlight is injected as an overlay div, shown for ~1.5s, then removed.
 *
 * @param {import('puppeteer').Page} page
 * @param {import('puppeteer').ElementHandle} element - Element to click
 */
async function clickWithHighlight(page, element) {
  // Get element bounding box
  const box = await element.boundingBox();
  if (!box) {
    // Element might not be visible — click anyway
    await element.click();
    return;
  }

  // Move mouse to element center naturally
  const centerX = box.x + box.width / 2;
  const centerY = box.y + box.height / 2;
  await moveMouseNaturally(page, centerX, centerY);

  // Inject highlight overlay
  await page.evaluate((rect, duration) => {
    const overlay = document.createElement('div');
    overlay.id = '__vg_highlight';
    overlay.style.cssText = `
      position: fixed;
      left: ${rect.x - 4}px;
      top: ${rect.y - 4}px;
      width: ${rect.width + 8}px;
      height: ${rect.height + 8}px;
      border: 3px solid #ff6b35;
      border-radius: 6px;
      box-shadow: 0 0 12px rgba(255, 107, 53, 0.5);
      pointer-events: none;
      z-index: 999999;
      transition: opacity 0.3s ease;
    `;
    document.body.appendChild(overlay);
    setTimeout(() => {
      overlay.style.opacity = '0';
      setTimeout(() => overlay.remove(), 300);
    }, duration);
  }, { x: box.x, y: box.y, width: box.width, height: box.height }, timing.highlightDuration);

  // Small pause then click
  await randomPause(80, 180);
  await page.mouse.click(centerX, centerY);
  await clickPause();
}

// ── Tooltip Overlay ─────────────────────────────────────────────────────

/**
 * Show a tooltip-style overlay near an element for instructional emphasis.
 *
 * @param {import('puppeteer').Page} page
 * @param {string} text - Tooltip text
 * @param {{ x: number, y: number }} position - Where to show the tooltip
 */
async function showTooltipOverlay(page, text, position) {
  await page.evaluate((txt, pos, duration) => {
    const tip = document.createElement('div');
    tip.id = '__vg_tooltip';
    tip.textContent = txt;
    tip.style.cssText = `
      position: fixed;
      left: ${pos.x}px;
      top: ${pos.y - 40}px;
      background: #1a1a2e;
      color: #e0e0e0;
      padding: 8px 16px;
      border-radius: 8px;
      font-size: 14px;
      font-family: 'Segoe UI', sans-serif;
      box-shadow: 0 4px 20px rgba(0,0,0,0.4);
      border: 1px solid rgba(255,255,255,0.1);
      z-index: 999999;
      pointer-events: none;
      opacity: 0;
      transform: translateY(8px);
      transition: opacity 0.3s ease, transform 0.3s ease;
    `;
    document.body.appendChild(tip);
    requestAnimationFrame(() => {
      tip.style.opacity = '1';
      tip.style.transform = 'translateY(0)';
    });
    setTimeout(() => {
      tip.style.opacity = '0';
      tip.style.transform = 'translateY(8px)';
      setTimeout(() => tip.remove(), 300);
    }, duration);
  }, text, position, timing.tooltipDuration);
}

module.exports = {
  randInt,
  randFloat,
  randomPause,
  actionPause,
  clickPause,
  moveMouseNaturally,
  naturalMouseJitter,
  typeNaturally,
  smoothScroll,
  clickWithHighlight,
  showTooltipOverlay,
  bezierCurve,
};
