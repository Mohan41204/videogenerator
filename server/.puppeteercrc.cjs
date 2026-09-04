const { join } = require('path');

/**
 * @type {import("puppeteer").Configuration}
 */
module.exports = {
  // Store Puppeteer Chrome binary inside the project directory so Render retains it at runtime
  cacheDirectory: join(__dirname, '.cache', 'puppeteer'),
};
