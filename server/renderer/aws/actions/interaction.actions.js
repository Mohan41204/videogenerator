/**
 * interaction.actions.js
 *
 * Action handlers for element interactions:
 *   click, doubleClick, type, select, check, uncheck, hover
 */

const human = require('../humanBehavior');
const awsConfig = require('../../../config/aws.config');

/**
 * Resolve an element from various selector strategies.
 * Supports CSS selectors, text-based search, name attributes, and IDs.
 * Pierces Shadow DOM (using >>> and ::-p-text) and searches across all iframes.
 *
 * Uses a scoring system to pick the BEST match:
 *  - Exact text match scores higher than substring match
 *  - Interactive elements (button, a, input) score higher
 *  - Elements inside <nav> or sidebar containers score higher
 *  - Smaller/more specific elements score higher
 *
 * @param {import('puppeteer').Page} page
 * @param {object} params - { selector?, text?, name?, id? }
 * @returns {Promise<import('puppeteer').ElementHandle|null>}
 */
async function resolveElement(page, params) {
  const { ElementResolver } = require('../automation/ElementResolver');
  
  // Set default timeout logic as before
  const timeoutMs = awsConfig.retry.selectorTimeoutMs || 15000;
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeoutMs) {
    try {
      // Use the new strict resolver with a threshold of 70
      const element = await ElementResolver.resolve(page, params, 70);

      // Scroll the element into view if it's below/above the visible viewport.
      // This is critical for long AWS forms (Create VPC, Launch EC2, etc.)
      // where the submit button sits far below the fold.
      if (element) {
        try {
          await element.evaluate(el => {
            el.scrollIntoView({ behavior: 'instant', block: 'center', inline: 'nearest' });
          });
          // Brief pause so the page settles after scroll before we interact
          await new Promise(r => setTimeout(r, 150));
        } catch { /* element might be inside shadow DOM or already visible — ok */ }
      }

      return element;
    } catch (err) {
      if (err.name === 'LowConfidenceMatchError') {
        // If it's a low confidence match, log and throw immediately so we don't blindly click
        console.warn(`  [resolveElement] ⚠ ${err.message}`);
        throw err;
      }
      
      // If no candidates found, wait and retry
      await new Promise(r => setTimeout(r, 300));
    }
  }

  return null;
}


/**
 * Click an element by selector or text.
 * Uses coordinate-based click first, then falls back to element.click()
 * if no navigation was detected.
 *
 * If the resolved element is non-interactive (e.g. <h4>, <span>, <div>),
 * tries to find a clickable ancestor (<a>, <button>, [role="button"]) first.
 *
 * @param {import('puppeteer').Page} page
 * @param {object} params - { selector?, text? }
 */
async function click(page, params) {
  const target = params.selector || params.text || params.target?.label || '';
  console.log(`  [action:click] Clicking "${target}"`);

  params.action = params.action || 'click';
  let element = await resolveElement(page, params);
  if (!element) {
    return { success: false, message: `Could not find element: ${target}` };
  }

  // If the resolved element is non-interactive (e.g. <h4>, <span>),
  // try to find a clickable parent so Puppeteer's click doesn't fail.
  try {
    const tagName = await element.evaluate(el => el.tagName.toLowerCase());
    const interactiveTags = ['button', 'a', 'input', 'select', 'textarea'];
    if (!interactiveTags.includes(tagName)) {
      const parentHandle = await element.evaluateHandle(el => {
        let check = el.parentElement;
        for (let i = 0; i < 6 && check; i++) {
          const tag = check.tagName.toLowerCase();
          const role = check.getAttribute('role') || '';
          if (tag === 'a' || tag === 'button' ||
              role === 'button' || role === 'link' || role === 'menuitem' || role === 'option') {
            return check;
          }
          check = check.parentElement;
        }
        return null;
      });
      const parentEl = parentHandle.asElement();
      if (parentEl) {
        console.log(`  [action:click] Resolved <${tagName}> is non-interactive, using clickable parent.`);
        element = parentEl;
      }
    }
  } catch { /* proceed with original element */ }

  // Capture URL before click to detect page navigation
  const urlBefore = page.url();

  // Try coordinate-based click with highlight (most natural for recording)
  let clickSucceeded = false;
  try {
    await human.clickWithHighlight(page, element);
    clickSucceeded = true;
  } catch (err) {
    console.warn(`  [action:click] clickWithHighlight failed: ${err.message}`);
  }

  // Give the page a moment for any React re-render or SPA navigation to start
  await human.randomPause(400, 600);
  
  // Check if the URL changed (SPA navigation)
  let urlAfter = page.url();
  const didNavigateFromCoordClick = urlAfter !== urlBefore;
  
  // If coordinate-based click didn't navigate, try fallback clicks
  if (!didNavigateFromCoordClick && !clickSucceeded) {
    try {
      // First try Puppeteer's element.click()
      await element.click();
      await human.randomPause(300, 500);
      urlAfter = page.url();
    } catch {
      // If that also fails, dispatch a click event via JavaScript
      try {
        await page.evaluate(el => {
          if (el && typeof el.click === 'function') {
            el.click();
          } else if (el) {
            el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
          }
        }, element);
        await human.randomPause(300, 500);
        urlAfter = page.url();
      } catch { /* element might be stale or detached */ }
    }
  } else if (!didNavigateFromCoordClick) {
    // Coordinate click succeeded but no navigation — try element.click() as fallback
    try {
      await element.click();
      await human.randomPause(300, 500);
      urlAfter = page.url();
    } catch {
      try {
        await page.evaluate(el => {
          if (el && typeof el.click === 'function') {
            el.click();
          } else if (el) {
            el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
          }
        }, element);
        await human.randomPause(300, 500);
        urlAfter = page.url();
      } catch { /* element might be stale or detached */ }
    }
  }
  
  const didNavigate = urlAfter !== urlBefore;
  
  if (didNavigate) {
    console.log(`  [action:click] Page navigated to ${urlAfter}. Waiting for content to load...`);
    try {
      await page.waitForNetworkIdle({ idleTime: 500, timeout: 5000 });
    } catch { /* proceed */ }
    await human.randomPause(2000, 3000);
  } else {
    // Even without URL change, the click may trigger React re-render
    // Wait for any loading indicators to disappear
    try {
      await page.waitForFunction(() => {
        const spinners = document.querySelectorAll(
          '[class*="loading"], [class*="spinner"], [class*="Loading"], [role="progressbar"]'
        );
        return spinners.length === 0;
      }, { timeout: 5000 });
    } catch { /* proceed */ }
    await human.randomPause(800, 1200);
  }
  
  return { success: true, message: `Clicked "${target}"` };
}

/**
 * Double-click an element.
 * @param {import('puppeteer').Page} page
 * @param {object} params - { selector?, text? }
 */
async function doubleClick(page, params) {
  const target = params.selector || params.text || params.target?.label || '';
  console.log(`  [action:doubleClick] Double-clicking "${target}"`);

  params.action = params.action || 'doubleClick';
  const element = await resolveElement(page, params);
  if (!element) {
    return { success: false, message: `Could not find element: ${target}` };
  }

  const box = await element.boundingBox();
  if (box) {
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    await human.moveMouseNaturally(page, cx, cy);
    await human.randomPause(80, 150);
    await page.mouse.click(cx, cy, { clickCount: 2 });
  } else {
    await element.click({ clickCount: 2 });
  }

  await human.actionPause();
  return { success: true, message: `Double-clicked "${target}"` };
}

/**
 * Type text into an input field.
 * Locks page scroll during typing to prevent screen shaking from
 * real-time validation (e.g., AWS bucket name DNS checks).
 *
 * @param {import('puppeteer').Page} page
 * @param {object} params - { selector?, text?, value: string }
 */
async function type(page, params) {
  const target = params.selector || params.text || params.target?.label || '';
  const value = params.value || '';
  console.log(`  [action:type] Typing "${value}" into "${target}"`);

  params.action = params.action || 'type';
  const element = await resolveElement(page, params);
  if (!element) {
    return { success: false, message: `Could not find input: ${target}` };
  }

  // Scroll the input into view at a stable position (center of viewport)
  try {
    await element.evaluate(el => el.scrollIntoView({ behavior: 'instant', block: 'center' }));
    await human.randomPause(200, 400);
  } catch { /* proceed */ }

  // Click the input first
  const box = await element.boundingBox();
  if (box) {
    await human.moveMouseNaturally(page, box.x + box.width / 2, box.y + box.height / 2);
    await human.randomPause(100, 200);
  }
  await element.click();
  await human.randomPause(150, 300);

  // Clear existing value
  await page.keyboard.down('Control');
  await page.keyboard.press('a');
  await page.keyboard.up('Control');
  await human.randomPause(80, 150);

  // Lock page scroll to prevent shaking from real-time validation
  // (AWS bucket name input triggers DNS checks on every keystroke,
  //  causing error/success messages to appear and shift the layout)
  await page.evaluate(() => {
    const scrollContainer = document.scrollingElement || document.documentElement;
    window.__vg_scrollLock = {
      scrollTop: scrollContainer.scrollTop,
      scrollLeft: scrollContainer.scrollLeft,
      overflow: document.body.style.overflow,
    };
    // Freeze scroll position — block any layout-triggered scrolling
    document.body.style.overflow = 'hidden';
    scrollContainer.scrollTop = window.__vg_scrollLock.scrollTop;
  });

  // Type naturally
  await human.typeNaturally(page, value);

  // Wait briefly for any validation animations to settle
  await human.randomPause(300, 600);

  // Unlock page scroll
  await page.evaluate(() => {
    if (window.__vg_scrollLock) {
      document.body.style.overflow = window.__vg_scrollLock.overflow || '';
      const scrollContainer = document.scrollingElement || document.documentElement;
      scrollContainer.scrollTop = window.__vg_scrollLock.scrollTop;
      scrollContainer.scrollLeft = window.__vg_scrollLock.scrollLeft;
      delete window.__vg_scrollLock;
    }
  });

  await human.actionPause();
  return { success: true, message: `Typed "${value}" into "${target}"` };
}

/**
 * Select a dropdown option by visible text or value.
 * Handles both native <select> and custom AWS dropdown menus.
 *
 * @param {import('puppeteer').Page} page
 * @param {object} params - { selector?, text?, value: string }
 */
async function select(page, params) {
  const target = params.selector || params.text || params.target?.label || '';
  const value = params.value || '';
  console.log(`  [action:select] Selecting "${value}" in "${target}"`);

  params.action = params.action || 'select';
  const element = await resolveElement(page, params);
  if (!element) {
    return { success: false, message: `Could not find dropdown: ${target}` };
  }

  // Check if it's a native <select>
  const tagName = await element.evaluate((el) => el.tagName.toLowerCase());

  if (tagName === 'select') {
    // Native select — use Puppeteer's select method
    await page.select(params.selector || `[name="${params.selector}"]`, value);
    await human.actionPause();
    return { success: true, message: `Selected "${value}" in native dropdown.` };
  }

  // Custom dropdown — click to open, then click the option
  await human.clickWithHighlight(page, element);
  await human.randomPause(400, 800);

  // Find and click the option by text
  const option = await resolveElement(page, { text: value });
  if (option) {
    await human.clickWithHighlight(page, option);
    await human.actionPause();
    return { success: true, message: `Selected "${value}" in custom dropdown.` };
  }

  return { success: false, message: `Could not find option "${value}" in dropdown.` };
}

/**
 * Check a checkbox.
 * Handles AWS Console checkboxes where the text label and the checkbox input
 * are siblings inside a table row or Cloudscape component.
 * @param {import('puppeteer').Page} page
 * @param {object} params - { selector?, text? }
 */
async function check(page, params) {
  const target = params.selector || params.text || params.target?.label || '';
  console.log(`  [action:check] Checking checkbox "${target}"`);
  params.action = params.action || 'check';

  // Strategy 1: If a selector is provided, try to find a direct checkbox
  if (params.selector) {
    const element = await resolveElement(page, params);
    if (element) {
      const isChecked = await element.evaluate((el) => el.checked === true).catch(() => false);
      if (!isChecked) {
        await human.clickWithHighlight(page, element);
      }
      await human.actionPause();
      return { success: true, message: `Checked "${target}"` };
    }
  }

  // Strategy 2: Find the text label, then find the checkbox in the same row/container
  if (params.text) {
    const textElement = await resolveElement(page, { text: params.text });
    if (textElement) {
      // Try to find a checkbox in the same table row or parent container
      const checkbox = await page.evaluateHandle((el) => {
        // Walk up to find a row-like container (tr, [role="row"], or a few levels up)
        let container = el;
        for (let i = 0; i < 8 && container; i++) {
          const tag = container.tagName?.toLowerCase() || '';
          const role = container.getAttribute?.('role') || '';
          if (tag === 'tr' || role === 'row' || tag === 'label' ||
              /row|item|option|list-item/i.test(role) ||
              /row|item|option/i.test(container.className || '')) {
            break;
          }
          container = container.parentElement;
        }
        
        if (container) {
          // Look for a checkbox within this container
          const cb = container.querySelector('input[type="checkbox"]') ||
                     container.querySelector('[role="checkbox"]') ||
                     container.querySelector('awsui-checkbox input') ||
                     container.querySelector('.awsui-checkbox input');
          if (cb) return cb;
        }
        
        // Fallback: just click the text element itself (some UIs toggle on label click)
        return el;
      }, textElement);
      
      const checkboxEl = checkbox.asElement();
      if (checkboxEl) {
        const isChecked = await checkboxEl.evaluate((el) => 
          el.checked === true || el.getAttribute('aria-checked') === 'true'
        ).catch(() => false);
        
        if (!isChecked) {
          await human.clickWithHighlight(page, checkboxEl);
        }
        await human.actionPause();
        return { success: true, message: `Checked "${target}"` };
      }
    }
  }

  return { success: false, message: `Could not find checkbox: ${target}` };
}

/**
 * Uncheck a checkbox.
 * @param {import('puppeteer').Page} page
 * @param {object} params - { selector?, text? }
 */
async function uncheck(page, params) {
  const target = params.selector || params.text || params.target?.label || '';
  console.log(`  [action:uncheck] Unchecking checkbox "${target}"`);
  params.action = params.action || 'check';

  const element = await resolveElement(page, params);
  if (!element) {
    return { success: false, message: `Could not find checkbox: ${target}` };
  }

  const isChecked = await element.evaluate((el) => el.checked);
  if (isChecked) {
    await human.clickWithHighlight(page, element);
  }
  await human.actionPause();
  return { success: true, message: `Unchecked "${target}"` };
}

/**
 * Hover over an element (move mouse, pause, no click).
 * @param {import('puppeteer').Page} page
 * @param {object} params - { selector?, text? }
 */
async function hover(page, params) {
  const target = params.selector || params.text || params.target?.label || '';
  console.log(`  [action:hover] Hovering over "${target}"`);

  params.action = params.action || 'hover';
  const element = await resolveElement(page, params);
  if (!element) {
    return { success: false, message: `Could not find element: ${target}` };
  }

  const box = await element.boundingBox();
  if (box) {
    await human.moveMouseNaturally(page, box.x + box.width / 2, box.y + box.height / 2);
  } else {
    await element.hover();
  }
  await human.randomPause(600, 1200);
  return { success: true, message: `Hovered over "${target}"` };
}

/**
 * Move the mouse to an element without clicking or pausing extensively.
 * @param {import('puppeteer').Page} page
 * @param {object} params - { selector?, text? }
 */
async function moveMouse(page, params) {
  const target = params.selector || params.text || params.target?.label || '';
  console.log(`  [action:moveMouse] Moving mouse to "${target}"`);

  const element = await resolveElement(page, params);
  if (!element) {
    return { success: false, message: `Could not find element to move mouse to: ${target}` };
  }

  const box = await element.boundingBox();
  if (box) {
    await human.moveMouseNaturally(page, box.x + box.width / 2, box.y + box.height / 2);
  }
  
  return { success: true, message: `Moved mouse to "${target}"` };
}

module.exports = {
  resolveElement,
  click,
  doubleClick,
  type,
  select,
  check,
  uncheck,
  hover,
  moveMouse,
};
