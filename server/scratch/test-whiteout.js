const puppeteer = require('./server/node_modules/puppeteer');
const path = require('path');
const os = require('os');
const fs = require('fs');

(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'chrome-whiteout-'));
  const browser = await puppeteer.launch({ headless: 'new', userDataDir: tmp, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });
  await page.goto('file:///' + path.resolve('server/templates/screen_share.html').replace(/\\/g, '/'), { waitUntil: 'load' });

  // 1. Load Slide 1
  await page.evaluate(() => {
    window._prevIsCode = null;
    window.loadSlide({
      heading: 'Introduction to Data Analytics',
      subheading: 'Core Concepts & Overview',
      bullets: [
        'Data-driven decision making in modern industry',
        'Data mining, data profiling and data wrangling',
        'Sampling techniques and modern analytics framework'
      ],
      isCode: false
    });
    window.renderFrame(5.0, 5.0);
  });

  // 2. Load Slide 2 with whiteout wipe test
  await page.evaluate(() => {
    window._prevIsCode = false;
    window.loadSlide({
      heading: 'Dealing with Different Types of Data',
      subheading: 'Structured vs Unstructured Data',
      bullets: [
        'Quantitative numerical metrics',
        'Qualitative categorical attributes'
      ],
      isCode: false
    });
  });

  // Check at 0.5s (halfway through erase)
  await page.evaluate(() => {
    window.renderFrame(0.5, 6.0);
  });

  const snap = await page.screenshot({ type: 'png' });
  fs.writeFileSync('server/scratch/test_whiteout_05s.png', snap);
  console.log('Saved test_whiteout_05s.png');

  await browser.close();
  fs.rmSync(tmp, { recursive: true, force: true });
})();

