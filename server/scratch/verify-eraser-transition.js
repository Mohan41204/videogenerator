const path = require('path');
const fs = require('fs');
const os = require('os');
const puppeteer = require('puppeteer');

(async () => {
  const tmpUserDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chrome-eraser-'));
  const templatePath = path.resolve(__dirname, '../templates/screen_share.html');
  const artifactDir = 'C:/Users/Admin B/.gemini/antigravity/brain/735c8f55-d79a-480c-8494-47c6915ec83a';

  console.log('Launching browser with user data dir:', tmpUserDataDir);

  const browser = await puppeteer.launch({
    headless: 'new',
    userDataDir: tmpUserDataDir,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-web-security',
      '--allow-file-access-from-files',
      '--disable-dev-shm-usage',
      '--window-size=1280,720'
    ]
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 });
    await page.goto('file:///' + templatePath.replace(/\\/g, '/'), { waitUntil: 'load' });

    console.log('Template loaded.');

    const slide1 = {
      heading: 'Data Analytics Essentials',
      subheading: 'Dealing with Different Types of Data',
      bullets: [
        'Structured vs unstructured data models',
        'Quantitative metrics & statistical distributions',
        'Data cleaning & normalization techniques'
      ],
      isCode: false,
      narration: 'Understanding different data types is crucial.'
    };

    const slide2 = {
      heading: 'Exploratory Data Analysis',
      subheading: 'Visual Patterns & Outliers',
      bullets: [
        'Box plots for detecting anomalous outliers',
        'Correlation heatmaps for feature relations',
        'Distribution plots for normality testing'
      ],
      isCode: false,
      narration: 'Now we explore data visual patterns.'
    };

    // 1. Render Slide 1 to 100% complete so all text is visible on the board
    console.log('Rendering Slide 1 completely...');
    await page.evaluate((s) => {
      window._prevIsCode = null;
      window.loadSlide(s);
      window.renderFrame(5.0, 5.0);
    }, slide1);

    // 2. Load Slide 2 (Notepad to Notepad switch!)
    console.log('Loading Slide 2 (Notepad to Notepad)...');
    await page.evaluate((s) => {
      window._prevIsCode = false; // previous was whiteboard!
      window.loadSlide(s);
      // Frame at 0.2s: Eraser tool active, cursor sweeping top
      window.renderFrame(0.2, 8.0);
    }, slide2);

    const snap1 = path.join(__dirname, 'eraser_step1_wiping_top.png');
    await page.screenshot({ path: snap1 });
    console.log('Captured eraser step 1 (0.2s):', snap1);

    // Frame at 0.6s: Eraser sweeping lower, upper text erased
    await page.evaluate((s) => {
      window.renderFrame(0.6, 8.0);
    }, slide2);

    const snap2 = path.join(__dirname, 'eraser_step2_wiping_middle.png');
    await page.screenshot({ path: snap2 });
    console.log('Captured eraser step 2 (0.6s):', snap2);

    // Frame at 2.5s: Erasing complete, canvas clean, new slide typing
    await page.evaluate((s) => {
      window.renderFrame(2.5, 8.0);
    }, slide2);

    const snap3 = path.join(__dirname, 'eraser_step3_new_slide_typing.png');
    await page.screenshot({ path: snap3 });
    console.log('Captured eraser step 3 (2.5s):', snap3);

    // Copy to artifact directory
    if (fs.existsSync(artifactDir)) {
      fs.copyFileSync(snap1, path.join(artifactDir, 'eraser-step1-wiping-top.png'));
      fs.copyFileSync(snap2, path.join(artifactDir, 'eraser-step2-wiping-middle.png'));
      fs.copyFileSync(snap3, path.join(artifactDir, 'eraser-step3-new-slide-typing.png'));
      console.log('Copied all eraser screenshots to artifacts directory.');
    }
  } finally {
    await browser.close();
    try {
      fs.rmSync(tmpUserDataDir, { recursive: true, force: true });
    } catch (e) {}
  }
})();

