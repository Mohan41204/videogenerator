/**
 * sessionManager.js
 *
 * Manages a persistent Chrome browser profile for AWS Console sessions.
 * Reuses cookies and authentication state across video generations so
 * the user doesn't need to log in for every video.
 *
 * Supports IAM Identity Center (SSO) login flow.
 */

const path = require('path');
const fs = require('fs');
const awsConfig = require('../../config/aws.config');

let _browser = null;

/**
 * Launch (or reuse) a Chromium browser with a persistent user data directory.
 * The profile directory stores cookies, localStorage, and session tokens.
 *
 * @returns {Promise<import('puppeteer').Browser>}
 */
async function launchBrowser() {
  const puppeteer = require('puppeteer');

  // Ensure the profile directory exists
  const profileDir = awsConfig.chrome.profilePath;
  if (!fs.existsSync(profileDir)) {
    fs.mkdirSync(profileDir, { recursive: true });
  }

  // If we already have a living browser, reuse it
  if (_browser && _browser.connected) {
    console.log('[SessionManager] Reusing existing browser instance.');
    return _browser;
  }

  console.log('[SessionManager] Launching Chromium with persistent profile...');
  console.log(`[SessionManager] Profile path: ${profileDir}`);

  _browser = await puppeteer.launch({
    headless: awsConfig.chrome.headless,
    userDataDir: profileDir,
    args: awsConfig.chrome.launchArgs,
    defaultViewport: awsConfig.viewport,
    protocolTimeout: 60000,  // 60s timeout for CDP protocol calls (prevents screenshot timeout when window is in background)
  });

  // Handle browser disconnect
  _browser.on('disconnected', () => {
    console.log('[SessionManager] Browser disconnected.');
    _browser = null;
  });

  return _browser;
}

/**
 * Check if the current page is on the AWS Console (not a login page).
 * @param {import('puppeteer').Page} page
 * @returns {Promise<boolean>}
 */
async function isSessionValid(page) {
  try {
    const url = page.url();

    // If we're on the console and NOT on a login/sign-in page, session is valid
    const isConsole = url.includes('console.aws.amazon.com') ||
                      url.includes('s3.console.aws.amazon.com');
    const isLogin = url.includes('signin.aws.amazon.com') ||
                    url.includes('login') ||
                    url.includes('sso') ||
                    url.includes('auth');

    if (isConsole && !isLogin) {
      // Double-check by looking for the account menu in the nav bar
      const hasNav = await page.evaluate(() => {
        return !!(
          document.querySelector('[data-testid="awsc-nav-account-menu-button"]') ||
          document.querySelector('#nav-usernameMenu') ||
          document.querySelector('[data-testid="account-menu-button"]') ||
          document.querySelector('#awsc-navigation')
        );
      });
      return hasNav;
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Navigate to AWS Console and ensure we have a valid session.
 * If the session has expired, it navigates to the IAM Identity Center
 * SSO start URL and waits for the user to complete login manually.
 *
 * @param {import('puppeteer').Page} page
 * @returns {Promise<void>}
 */
async function ensureAuthenticated(page) {
  console.log('[SessionManager] Checking AWS Console session...');

  // Navigate to the console home page
  await page.goto(awsConfig.consoleBaseUrl, {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  });

  // Give the page a moment to settle (redirects can happen)
  await new Promise((r) => setTimeout(r, 3000));

  // Check if we're already authenticated
  if (await isSessionValid(page)) {
    console.log('[SessionManager] ✓ Existing session is valid.');
    return;
  }

  // Session expired or first-time — navigate to SSO login
  console.log('[SessionManager] Session expired or not found. Starting login flow...');

  const ssoUrl = awsConfig.ssoStartUrl;
  if (ssoUrl) {
    console.log(`[SessionManager] Navigating to IAM Identity Center SSO: ${ssoUrl}`);
    await page.goto(ssoUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  } else {
    console.log('[SessionManager] Navigating to AWS Sign-In page...');
    await page.goto('https://signin.aws.amazon.com/console', {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
  }

  // ── Wait for manual login ────────────────────────────────────────────
  console.log('');
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║  AWS LOGIN REQUIRED                                    ║');
  console.log('║                                                        ║');
  console.log('║  A browser window has opened.                          ║');
  console.log('║  Please log in to your AWS account.                    ║');
  console.log('║                                                        ║');
  console.log('║  The automation will resume automatically once          ║');
  console.log('║  you reach the AWS Console dashboard.                   ║');
  console.log('╚════════════════════════════════════════════════════════╝');
  console.log('');

  // Poll every 3 seconds until the console loads
  const maxWaitMs = 5 * 60 * 1000; // 5 minutes
  const pollInterval = 3000;
  let elapsed = 0;

  while (elapsed < maxWaitMs) {
    await new Promise((r) => setTimeout(r, pollInterval));
    elapsed += pollInterval;

    if (await isSessionValid(page)) {
      console.log('[SessionManager] ✓ Login successful! Session is now valid.');
      return;
    }

    // Log a dot every 15 seconds so the user knows we're waiting
    if (elapsed % 15000 === 0) {
      process.stdout.write('[SessionManager] Still waiting for login...\n');
    }
  }

  throw new Error(
    'AWS login timed out after 5 minutes. Please restart and try again.'
  );
}

/**
 * Get a fully authenticated page ready for AWS Console actions.
 * Launches the browser if needed and ensures the session is valid.
 *
 * @returns {Promise<{ browser: import('puppeteer').Browser, page: import('puppeteer').Page }>}
 */
async function getAuthenticatedPage() {
  const browser = await launchBrowser();
  const pages = await browser.pages();
  const page = pages[0] || await browser.newPage();

  await page.setViewport(awsConfig.viewport);

  // Stealth: override navigator.webdriver to avoid detection and auto-inject custom cursor
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });

    const injectCursor = () => {
      if (document.getElementById('__vg_cursor')) return;
      const cursor = document.createElement('div');
      cursor.id = '__vg_cursor';
      cursor.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M5 3L19 12L12 13L9 20L5 3Z" fill="white" stroke="black" stroke-width="1.5" stroke-linejoin="round"/>
      </svg>`;
      cursor.style.cssText = `
        position: fixed;
        left: 960px;
        top: 540px;
        width: 24px;
        height: 24px;
        pointer-events: none;
        z-index: 2147483647;
        transform: translate(-2px, -2px);
        filter: drop-shadow(1px 2px 2px rgba(0,0,0,0.4));
        transition: left 400ms ease-out, top 400ms ease-out;
      `;
      document.body.appendChild(cursor);
      
      document.addEventListener('mousemove', (e) => {
        cursor.style.left = e.clientX + 'px';
        cursor.style.top = e.clientY + 'px';
      }, true);
    };

    if (document.body) {
      injectCursor();
    } else {
      document.addEventListener('DOMContentLoaded', injectCursor);
    }
  });

  await ensureAuthenticated(page);

  // ── Expand the AWS Console side navigation bar if collapsed ────────
  // AWS defaults to a collapsed sidebar ("hamburger menu") on fresh profiles.
  // Try to click the menu button to expand it for a better tutorial appearance.
  try {
    const sideNavToggle = await page.$('[data-testid="awsc-nav-header-regionmenu"], button[aria-label*="navigation"], #nav-menubar button, [data-testid="side-navigation-toggle"]');
    if (sideNavToggle) {
      // Check if sidebar is currently collapsed
      const isCollapsed = await page.evaluate(() => {
        const nav = document.querySelector('[data-testid="side-navigation"], nav[aria-label*="navigation"], #awsui-side-navigation');
        if (!nav) return true;
        const rect = nav.getBoundingClientRect();
        return rect.width < 50;
      });
      if (isCollapsed) {
        await sideNavToggle.click();
        await new Promise((r) => setTimeout(r, 1000));
        console.log('[SessionManager] Expanded side navigation bar.');
      }
    }
  } catch { /* sidebar expansion is best-effort */ }

  // ── Inject overlay scrollbar & dynamic scale CSS ──────────────────
  // Use overlay scrollbars so they appear visually in the video but
  // do NOT consume layout space (which would shrink the content area
  // and cause AWS to collapse the sidebar). Also ensure html/body scale neatly.
  await page.evaluateOnNewDocument(() => {
    const style = document.createElement('style');
    style.textContent = `
      ::-webkit-scrollbar { width: 8px; height: 8px; }
      ::-webkit-scrollbar-track { background: transparent; }
      ::-webkit-scrollbar-thumb { background: rgba(128, 128, 128, 0.5); border-radius: 4px; }
      ::-webkit-scrollbar-thumb:hover { background: rgba(128, 128, 128, 0.7); }
      * { scrollbar-width: thin; scrollbar-color: rgba(128,128,128,0.5) transparent; }
      html { overflow: overlay !important; }
      
      /* Cloudscape layout adjustments for compact 700px height */
      .awsui-app-layout__content, main, [role="main"] {
        max-width: 100% !important;
      }
    `;
    if (document.head) document.head.appendChild(style);
    else document.addEventListener('DOMContentLoaded', () => document.head.appendChild(style));
  });

  return { browser, page };
}

/**
 * Close the browser entirely (for cleanup after all videos).
 */
async function closeBrowser() {
  if (_browser && _browser.connected) {
    console.log('[SessionManager] Closing browser...');
    await _browser.close();
    _browser = null;
  }
}

module.exports = {
  launchBrowser,
  isSessionValid,
  ensureAuthenticated,
  getAuthenticatedPage,
  closeBrowser,
};
