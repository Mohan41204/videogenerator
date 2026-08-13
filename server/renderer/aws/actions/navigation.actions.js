/**
 * navigation.actions.js
 *
 * Action handlers for page navigation within the AWS Console:
 *   goto, search, openNewTab, closeTab, switchTab
 */

const human = require('../humanBehavior');
const awsConfig = require('../../../config/aws.config');

/**
 * Navigate to a URL.
 * @param {import('puppeteer').Page} page
 * @param {object} params - { url: string }
 */
async function goto(page, params) {
  const url = params.url || awsConfig.consoleBaseUrl;
  console.log(`  [action:goto] Navigating to ${url}`);
  await page.goto(url, {
    waitUntil: 'domcontentloaded',
    timeout: awsConfig.timing.pageLoadWait * 5,
  });
  
  // AWS Console pages are React SPAs that continue rendering after DOMContentLoaded.
  // Wait for network to mostly settle, then give React time to hydrate.
  try {
    await page.waitForNetworkIdle({ idleTime: 500, timeout: 5000 });
  } catch { /* AWS never fully idles — proceed */ }
  
  // Extra stabilization: wait for the main content area to appear
  try {
    await page.waitForSelector('div[id], main, [role="main"], #app, #root', { timeout: 5000, visible: true });
  } catch { /* proceed anyway */ }
  
  // Re-inject custom mouse cursor
  await human.ensureCursorInjected(page);
  
  await human.randomPause(2000, 3500);
  return { success: true, message: `Navigated to ${url}` };
}

/**
 * Use the AWS Console unified search bar to find a service.
 * Only types the query and waits for the dropdown to appear.
 * Does NOT click any result — the subsequent highlight/click steps
 * in the Gemini-generated script handle that for cinematic effect.
 *
 * @param {import('puppeteer').Page} page
 * @param {object} params - { text: string }
 */
async function search(page, params) {
  const query = params.text || params.value || '';
  console.log(`  [action:search] Searching for "${query}"`);

  // AWS Console search bar selectors (multiple variants for resilience)
  const searchSelectors = [
    '#awsc-navigation__more-menu--trigger',       // Unified search button
    '[data-testid="awsc-nav-more-menu-button"]',
    'input[placeholder*="Search"]',
    'input[type="search"]',
    '#search-box-input',
  ];

  // Try to find and click the search input
  let searchInput = null;
  for (const sel of searchSelectors) {
    try {
      searchInput = await page.waitForSelector(sel, { timeout: 3000 });
      if (searchInput) break;
    } catch { /* try next */ }
  }

  if (!searchInput) {
    // Fallback: try the keyboard shortcut Alt+S to open search
    console.log('  [action:search] No search bar found, trying Alt+S shortcut...');
    await page.keyboard.down('Alt');
    await page.keyboard.press('s');
    await page.keyboard.up('Alt');
    await human.randomPause(500, 800);

    // Look for the search input again
    try {
      searchInput = await page.waitForSelector(
        'input[type="search"], input[placeholder*="Search"], #search-box-input',
        { timeout: 3000 }
      );
    } catch {
      return { success: false, message: 'Could not find AWS search bar.' };
    }
  }

  // Click the search input
  if (searchInput) {
    const box = await searchInput.boundingBox();
    if (box) {
      await human.moveMouseNaturally(page, box.x + box.width / 2, box.y + box.height / 2);
      await human.randomPause(100, 200);
    }
    await searchInput.click();
    await human.randomPause(300, 500);
  }

  // Clear any existing text and type the search query
  await page.keyboard.down('Control');
  await page.keyboard.press('a');
  await page.keyboard.up('Control');
  await human.randomPause(100, 200);

  await human.typeNaturally(page, query);

  // Wait for search dropdown results to appear (don't click — let highlight/click steps do that)
  console.log('  [action:search] Waiting for search results dropdown...');
  const resultSelectors = [
    '[data-testid="search-result"]',
    '.awsc-search__result-item',
    '[role="option"]',
    '[role="listbox"]',
    '.search-result',
  ];

  let dropdownAppeared = false;
  for (const sel of resultSelectors) {
    try {
      await page.waitForSelector(sel, { timeout: 3000 });
      dropdownAppeared = true;
      break;
    } catch { /* try next */ }
  }

  if (dropdownAppeared) {
    // Give the dropdown a moment to fully render
    await human.randomPause(500, 800);
    console.log('  [action:search] Search dropdown visible.');
  } else {
    // Dropdown didn't appear — still proceed (the next steps may handle it)
    console.log('  [action:search] No dropdown detected, proceeding...');
    await human.randomPause(800, 1500);
  }

  return { success: true, message: `Typed "${query}" in search bar` };
}

/**
 * Open a new browser tab.
 * @param {import('puppeteer').Page} page
 * @param {object} params - { url?: string }
 * @param {import('puppeteer').Browser} browser
 */
async function openNewTab(page, params, browser) {
  const url = params.url || 'about:blank';
  console.log(`  [action:openNewTab] Opening new tab: ${url}`);
  const newPage = await browser.newPage();
  await newPage.setViewport(awsConfig.viewport);
  if (url !== 'about:blank') {
    await newPage.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
  }
  await human.randomPause(500, 1000);
  return { success: true, message: `Opened new tab: ${url}`, newPage };
}

/**
 * Close the current tab.
 * @param {import('puppeteer').Page} page
 */
async function closeTab(page) {
  console.log('  [action:closeTab] Closing current tab.');
  await page.close();
  await human.randomPause(300, 600);
  return { success: true, message: 'Closed current tab.' };
}

/**
 * Switch to a tab by index (0-based).
 * @param {import('puppeteer').Page} page
 * @param {object} params - { index: number }
 * @param {import('puppeteer').Browser} browser
 */
async function switchTab(page, params, browser) {
  const index = params.index || 0;
  const pages = await browser.pages();
  console.log(`  [action:switchTab] Switching to tab ${index} (${pages.length} open).`);
  if (index >= 0 && index < pages.length) {
    await pages[index].bringToFront();
    await human.randomPause(300, 500);
    return { success: true, message: `Switched to tab ${index}.`, activePage: pages[index] };
  }
  return { success: false, message: `Tab index ${index} out of range.` };
}

module.exports = { goto, search, openNewTab, closeTab, switchTab };
