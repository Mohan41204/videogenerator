/**
 * keyboard.actions.js
 *
 * Action handlers for keyboard operations:
 *   pressEnter, pressTab, pressEscape, keyboardShortcut
 */

const human = require('../humanBehavior');

/**
 * Press the Enter key.
 * @param {import('puppeteer').Page} page
 */
async function pressEnter(page) {
  console.log('  [action:pressEnter] Pressing Enter.');
  await human.randomPause(100, 250);
  await page.keyboard.press('Enter');
  await human.actionPause();
  return { success: true, message: 'Pressed Enter.' };
}

/**
 * Press the Tab key.
 * @param {import('puppeteer').Page} page
 */
async function pressTab(page) {
  console.log('  [action:pressTab] Pressing Tab.');
  await human.randomPause(100, 200);
  await page.keyboard.press('Tab');
  await human.randomPause(200, 400);
  return { success: true, message: 'Pressed Tab.' };
}

/**
 * Press the Escape key.
 * @param {import('puppeteer').Page} page
 */
async function pressEscape(page) {
  console.log('  [action:pressEscape] Pressing Escape.');
  await human.randomPause(80, 180);
  await page.keyboard.press('Escape');
  await human.randomPause(200, 400);
  return { success: true, message: 'Pressed Escape.' };
}

/**
 * Execute a keyboard shortcut (e.g., Ctrl+C, Alt+F4).
 * @param {import('puppeteer').Page} page
 * @param {object} params - { keys: string } e.g. "Control+c", "Alt+F4"
 */
async function keyboardShortcut(page, params) {
  const keys = params.keys || params.value || '';
  console.log(`  [action:keyboardShortcut] Pressing ${keys}`);

  const parts = keys.split('+').map((k) => k.trim());
  const modifiers = [];
  let mainKey = '';

  for (const part of parts) {
    const lower = part.toLowerCase();
    if (['control', 'ctrl', 'meta', 'alt', 'shift'].includes(lower)) {
      const mod = lower === 'ctrl' ? 'Control' : lower.charAt(0).toUpperCase() + lower.slice(1);
      modifiers.push(mod);
    } else {
      mainKey = part;
    }
  }

  await human.randomPause(100, 250);

  // Hold all modifiers
  for (const mod of modifiers) {
    await page.keyboard.down(mod);
  }

  // Press main key
  if (mainKey) {
    await page.keyboard.press(mainKey);
  }

  // Release modifiers in reverse order
  for (const mod of modifiers.reverse()) {
    await page.keyboard.up(mod);
  }

  await human.actionPause();
  return { success: true, message: `Pressed shortcut ${keys}` };
}

module.exports = { pressEnter, pressTab, pressEscape, keyboardShortcut };
