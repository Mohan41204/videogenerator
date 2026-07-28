/**
 * scroll.actions.js
 *
 * Action handlers for scrolling and drag operations:
 *   scroll, drag
 */

const human = require('../humanBehavior');

/**
 * Scroll the page or a specific element.
 * @param {import('puppeteer').Page} page
 * @param {object} params - { distance?: number, direction?: 'up'|'down', selector?: string, text?: string, target?: { label?: string } }
 */
async function scroll(page, params) {
  const target = (params.selector || params.text || params.target?.label || '').trim();
  
  // Only try to scroll-to-element if we have a real non-empty label
  if (target) {
    console.log(`  [action:scroll] Scrolling to "${target}"`);
    const { resolveElement } = require('./interaction.actions');
    try {
      const element = await resolveElement(page, params);
      if (element) {
        await element.evaluate((e) => {
          e.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
        await human.randomPause(300, 600);
        return { success: true, message: `Scrolled to "${target}"` };
      }
    } catch (err) {
      // resolveElement threw (low confidence / not found) — fall through to pixel scroll
      console.warn(`  [action:scroll] ⚠ Could not resolve "${target}", falling back to pixel scroll.`);
    }
  }

  // Fallback to pixel scrolling if no target or target not found
  const distance = params.distance || 300;
  const direction = (params.direction || 'down').toLowerCase();
  const actualDistance = direction === 'up' ? -Math.abs(distance) : Math.abs(distance);

  console.log(`  [action:scroll] Scrolling ${direction} by ${Math.abs(distance)}px`);

  if (params.selector) {
    // Scroll within a specific container
    const element = await page.$(params.selector);
    if (element) {
      await element.evaluate((el, dist) => {
        el.scrollBy({ top: dist, behavior: 'smooth' });
      }, actualDistance);
      await human.randomPause(300, 600);
      return { success: true, message: `Scrolled ${direction} in "${params.selector}"` };
    }
  }

  // Scroll the entire page smoothly
  await human.smoothScroll(page, actualDistance);
  await human.randomPause(200, 500);
  return { success: true, message: `Scrolled ${direction} by ${Math.abs(distance)}px` };
}

/**
 * Drag an element from one position to another.
 * @param {import('puppeteer').Page} page
 * @param {object} params - { from: {x,y} | selector, to: {x,y} | selector }
 */
async function drag(page, params) {
  console.log('  [action:drag] Performing drag operation.');

  let startX, startY, endX, endY;

  // Resolve start position
  if (params.fromSelector) {
    const el = await page.$(params.fromSelector);
    if (el) {
      const box = await el.boundingBox();
      startX = box.x + box.width / 2;
      startY = box.y + box.height / 2;
    }
  } else if (params.from) {
    startX = params.from.x;
    startY = params.from.y;
  }

  // Resolve end position
  if (params.toSelector) {
    const el = await page.$(params.toSelector);
    if (el) {
      const box = await el.boundingBox();
      endX = box.x + box.width / 2;
      endY = box.y + box.height / 2;
    }
  } else if (params.to) {
    endX = params.to.x;
    endY = params.to.y;
  }

  if (startX == null || endX == null) {
    return { success: false, message: 'Could not resolve drag start/end positions.' };
  }

  // Move to start, press, move to end, release
  await human.moveMouseNaturally(page, startX, startY);
  await human.randomPause(150, 300);
  await page.mouse.down();
  await human.randomPause(100, 200);
  await human.moveMouseNaturally(page, endX, endY);
  await human.randomPause(100, 200);
  await page.mouse.up();
  await human.actionPause();

  return { success: true, message: 'Drag operation completed.' };
}

module.exports = { scroll, drag };
