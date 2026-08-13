/**
 * timing.actions.js
 *
 * Action handler for explicit wait/pause operations:
 *   wait
 */

const human = require('../humanBehavior');

/**
 * Wait for a specified duration or for a selector to appear.
 *
 * @param {import('puppeteer').Page} page
 * @param {object} params - { duration?: number (ms), selector?: string }
 */
async function wait(page, params) {
  // Wait for a fixed duration (with slight randomness for realism)
  const duration = params.duration || params.value || 1000;
  const actualDuration = Math.max(100, duration + human.randInt(-100, 100));
  console.log(`  [action:wait] Waiting ${actualDuration}ms`);

  // Add some subtle mouse jitter during the wait
  const jitterInterval = setInterval(async () => {
    try { await human.naturalMouseJitter(page); } catch { /* page might be navigating */ }
  }, 1500);

  await new Promise((r) => setTimeout(r, actualDuration));
  clearInterval(jitterInterval);

  return { success: true, message: `Waited ${actualDuration}ms` };
}

async function waitForNetworkIdle(page, params) {
  // AWS Console is never truly "network idle" due to telemetry and long-polling.
  // We use a short timeout and always return success. But we also add a minimum
  // stabilization period to let React finish rendering after navigation.
  const timeout = params.timeout || params.duration || 5000;
  console.log(`  [action:waitForNetworkIdle] Waiting for network to settle (max: ${timeout}ms)`);
  try {
    await page.waitForNetworkIdle({ idleTime: 500, timeout });
    console.log(`  [action:waitForNetworkIdle] Network is idle.`);
  } catch (e) {
    console.log(`  [action:waitForNetworkIdle] Network never fully idled (expected on AWS). Proceeding.`);
  }
  
  // ── Detect AWS resource-creation progress page ─────────────────────
  // After clicking "Create VPC", "Create bucket", "Launch instance" etc.,
  // AWS shows a progress page where each resource is created one-by-one.
  // The "View ..." action button ONLY appears after ALL resources are done.
  // We poll for up to 90 seconds to detect this completion state.
  try {
    const isCreationInProgress = await page.evaluate(() => {
      // AWS creation-progress pages have a status list with pending/in-progress items
      const progressItems = document.querySelectorAll(
        '[class*="progress"], [class*="creating"], [class*="in-progress"], ' +
        '[class*="status-loading"], [aria-label*="creating"], [aria-label*="in progress"]'
      );
      const hasProgressBar = document.querySelector('[role="progressbar"]');
      // Also check for the VPC-specific creation status list
      const hasCreationList = document.querySelector(
        '[class*="vpc-creation"], [class*="create-flow"], [class*="resource-status"]'
      );
      return progressItems.length > 0 || !!hasProgressBar || !!hasCreationList;
    });

    if (isCreationInProgress) {
      console.log(`  [action:waitForNetworkIdle] Detected AWS resource creation in progress. Waiting up to 90s...`);
      // Poll every 2 seconds until progress indicators are gone OR an action button appears
      const maxWait = 90000;
      const pollInterval = 2000;
      const start = Date.now();

      while (Date.now() - start < maxWait) {
        await new Promise(r => setTimeout(r, pollInterval));

        const done = await page.evaluate(() => {
          // Check if all progress indicators are gone
          const progressItems = document.querySelectorAll(
            '[class*="progress"][class*="loading"], [class*="creating"], ' +
            '[aria-label*="creating"], [aria-label*="in progress"]'
          );
          // Check if a "View" action button appeared (View VPC, View bucket, etc.)
          const viewBtn = Array.from(document.querySelectorAll('button, a')).find(
            el => /^View\s/i.test((el.textContent || '').trim())
          );
          return progressItems.length === 0 || !!viewBtn;
        });

        if (done) {
          console.log(`  [action:waitForNetworkIdle] Resource creation complete.`);
          break;
        }
      }
    }
  } catch { /* creation-progress detection is best-effort */ }
  
  // Always wait for loading spinners to disappear
  try {
    await page.waitForFunction(() => {
      const spinners = document.querySelectorAll(
        '[class*="loading"], [class*="spinner"], [class*="Loading"], [role="progressbar"], .awsui-spinner'
      );
      return spinners.length === 0;
    }, { timeout: 3000 });
  } catch { /* proceed */ }
  
  // Minimum stabilization wait for React rendering
  await human.randomPause(800, 1500);
  
  return { success: true, message: `Page stabilized.` };
}

async function waitForSelector(page, params) {
  const timeout = params.timeout || params.duration || 10000;
  const { resolveElement } = require('./interaction.actions');
  console.log(`  [action:waitForSelector] Waiting for "${params.selector || params.text}" (timeout: ${timeout}ms)`);
  
  try {
    // We can reuse resolveElement which loops and pierces shadow DOM
    const el = await resolveElement(page, params);
    if (el) {
      return { success: true, message: `Element appeared.` };
    } else {
      return { success: false, message: `Timeout waiting for element.` };
    }
  } catch (e) {
    return { success: false, message: `Error waiting for selector: ${e.message}` };
  }
}

async function waitForElementStable(page, params) {
  const timeout = params.timeout || params.duration || 10000;
  const { resolveElement } = require('./interaction.actions');
  console.log(`  [action:waitForElementStable] Waiting for "${params.selector || params.text}" to be stable (timeout: ${timeout}ms)`);
  
  try {
    const el = await resolveElement(page, params);
    if (!el) {
      return { success: false, message: `Element not found to check stability.` };
    }
    
    // Check bounding box over a short period to ensure it's not moving
    let isStable = false;
    let lastBox = await el.boundingBox();
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      await new Promise(r => setTimeout(r, 250));
      const newBox = await el.boundingBox();
      
      if (lastBox && newBox && 
          Math.abs(lastBox.x - newBox.x) < 2 && 
          Math.abs(lastBox.y - newBox.y) < 2 &&
          Math.abs(lastBox.width - newBox.width) < 2 &&
          Math.abs(lastBox.height - newBox.height) < 2) {
        isStable = true;
        break;
      }
      lastBox = newBox;
    }
    
    if (isStable) {
      return { success: true, message: `Element is stable.` };
    } else {
      return { success: false, message: `Element never stabilized within timeout.` };
    }
  } catch (e) {
    return { success: false, message: `Error waiting for element stability: ${e.message}` };
  }
}

module.exports = { wait, waitForNetworkIdle, waitForSelector, waitForElementStable };
