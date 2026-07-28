/**
 * actionExecutor.js
 *
 * Central dispatcher that receives action objects from the Gemini-generated
 * JSON and routes them to the correct handler module.
 *
 * Provides retry logic, error handling, and structured logging for every
 * action executed during an AWS tutorial recording.
 */

const awsConfig = require('../../config/aws.config');

// Import all action handler modules
const navigationActions  = require('./actions/navigation.actions');
const interactionActions = require('./actions/interaction.actions');
const keyboardActions    = require('./actions/keyboard.actions');
const scrollActions      = require('./actions/scroll.actions');
const visualActions      = require('./actions/visual.actions');
const timingActions      = require('./actions/timing.actions');

// ── Action Registry ─────────────────────────────────────────────────────
// Maps action names (from Gemini JSON) to their handler functions.
// Each handler has the signature: (page, params, browser?) => Promise<{success, message}>
const ACTION_MAP = {
  // Navigation
  goto:             navigationActions.goto,
  search:           navigationActions.search,
  openNewTab:       navigationActions.openNewTab,
  closeTab:         navigationActions.closeTab,
  switchTab:        navigationActions.switchTab,

  // Interactions
  click:            interactionActions.click,
  doubleClick:      interactionActions.doubleClick,
  type:             interactionActions.type,
  select:           interactionActions.select,
  check:            interactionActions.check,
  uncheck:          interactionActions.uncheck,
  hover:            interactionActions.hover,
  moveMouse:        interactionActions.moveMouse,

  // Keyboard
  pressEnter:       keyboardActions.pressEnter,
  pressTab:         keyboardActions.pressTab,
  pressEscape:      keyboardActions.pressEscape,
  keyboardShortcut: keyboardActions.keyboardShortcut,

  // Scroll & Drag
  scroll:           scrollActions.scroll,
  drag:             scrollActions.drag,

  // Visual
  highlight:        visualActions.highlight,
  showTooltip:      visualActions.showTooltip,
  takeScreenshot:   visualActions.takeScreenshot,

  // Timing
  wait:                 timingActions.wait,
  waitForNetworkIdle:   timingActions.waitForNetworkIdle,
  waitForSelector:      timingActions.waitForSelector,
  waitForElementStable: timingActions.waitForElementStable,
};

/**
 * Execute a single action with retry logic.
 *
 * @param {import('puppeteer').Page} page - The active browser page
 * @param {object} action - Action object from Gemini JSON: { action, selector?, text?, value?, ... }
 * @param {import('puppeteer').Browser} browser - Browser instance (for tab operations)
 * @param {object} [options] - { maxAttempts?, retryDelay? }
 * @returns {Promise<{ success: boolean, message: string, newPage?: Page }>}
 */
async function executeAction(page, action, browser, options = {}) {
  const actionName = action.action;
  const handler = ACTION_MAP[actionName];

  if (!handler) {
    const msg = `Unknown action: "${actionName}". Skipping.`;
    console.warn(`  [ActionExecutor] ⚠ ${msg}`);
    return { success: false, message: msg };
  }

  const maxAttempts = options.maxAttempts || awsConfig.retry.maxAttempts;
  const baseDelay = options.retryDelay || awsConfig.retry.baseDelayMs;

  let lastError = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await handler(page, action, browser);

      if (result.success) {
        return result;
      }

      // Handler returned failure (not an exception)
      console.warn(`  [ActionExecutor] Action "${actionName}" failed: ${result.message} (attempt ${attempt}/${maxAttempts})`);
      lastError = new Error(result.message);
    } catch (err) {
      lastError = err;
      console.warn(`  [ActionExecutor] Action "${actionName}" threw error: ${err.message} (attempt ${attempt}/${maxAttempts})`);
    }

    // Wait before retrying (exponential backoff)
    if (attempt < maxAttempts) {
      const delay = baseDelay * Math.pow(2, attempt - 1);
      console.log(`  [ActionExecutor] Retrying in ${delay}ms...`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  // All attempts exhausted
  const failMsg = `Action "${actionName}" failed after ${maxAttempts} attempts: ${lastError?.message}`;
  console.error(`  [ActionExecutor] ✖ ${failMsg}`);
  return { success: false, message: failMsg };
}

/**
 * Execute an array of action steps sequentially.
 *
 * @param {import('puppeteer').Page} page - The active browser page
 * @param {Array} steps - Array of action objects
 * @param {import('puppeteer').Browser} browser - Browser instance
 * @param {object} [options] - Execution options
 * @param {boolean} [options.stopOnFailure=false] - Stop execution on first failure
 * @param {function} [options.onStepComplete] - Callback after each step: (stepIndex, result) => void
 * @returns {Promise<Array<{ action: string, success: boolean, message: string }>>}
 */
async function executeSteps(page, steps, browser, options = {}) {
  const results = [];
  let activePage = page;

  console.log(`[ActionExecutor] Executing ${steps.length} steps...`);

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    console.log(`\n[ActionExecutor] Step ${i + 1}/${steps.length}: ${step.action}`);

    const result = await executeAction(activePage, step, browser);
    results.push({
      step: i + 1,
      action: step.action,
      success: result.success,
      message: result.message,
    });

    // Handle tab-switching actions that return a new active page
    if (result.newPage) {
      activePage = result.newPage;
    }
    if (result.activePage) {
      activePage = result.activePage;
    }

    // Notify callback
    if (options.onStepComplete) {
      options.onStepComplete(i, result);
    }

    // Stop on failure if configured
    if (!result.success && options.stopOnFailure) {
      console.error(`[ActionExecutor] Stopping execution due to failure at step ${i + 1}.`);
      break;
    }
  }

  // Log summary
  const succeeded = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;
  console.log(`\n[ActionExecutor] Execution complete: ${succeeded} succeeded, ${failed} failed out of ${steps.length} steps.`);

  return { results, activePage };
}

/**
 * Get all registered action names.
 * @returns {string[]}
 */
function getAvailableActions() {
  return Object.keys(ACTION_MAP);
}

module.exports = {
  executeAction,
  executeSteps,
  getAvailableActions,
  ACTION_MAP,
};
