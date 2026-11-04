const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

async function run() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });

  const htmlPath = path.resolve('server/templates/screen_share.html');
  await page.goto(`file://${htmlPath.replace(/\\/g, '/')}`, { waitUntil: 'load' });

  // Slide 1: Notepad / Whiteboard (Introduction to Python)
  const slide1 = {
    isCode: false,
    heading: 'Introduction to Python',
    subheading: 'Core Programming Fundamentals',
    bullets: [
      'Python is an interpreted, high-level, general-purpose language.',
      'Designed for readability with clean and concise syntax.',
      'Widely used in Data Science, Machine Learning, and Web APIs.'
    ]
  };

  // Slide 2: Notepad / Whiteboard (Variables & Data Types - Consecutive Whiteboard slide)
  const slide2 = {
    isCode: false,
    heading: 'Variables & Data Types',
    subheading: 'Memory Allocation and Dynamic Typing',
    bullets: [
      'Variables store data values without explicit declaration.',
      'Integers, floats, strings, and booleans are standard primitives.',
      'Dynamic typing automatically assigns memory at runtime.'
    ]
  };

  // Slide 3: VS Code (Alt+Tab transition from Notepad to VS Code)
  const slide3 = {
    isCode: true,
    fileName: 'app.py',
    heading: 'Python Code Execution',
    code: 'name = "Antigravity"\nprint(f"Hello from {name}!")\n',
    terminalOutput: 'Hello from Antigravity!\nPS D:\\Desktop\\python> '
  };

  const outDir = path.resolve('server/scratch/test_frames');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  console.log('1. Loading Slide 1 (Whiteboard)...');
  await page.evaluate((s) => window.loadSlide(s), slide1);
  await page.evaluate(() => window.renderFrame(10.0, 10.0));
  await page.screenshot({ path: path.join(outDir, '01_slide1_completed.png') });
  console.log('Saved 01_slide1_completed.png');

  console.log('2. Loading Slide 2 (Whiteboard -> Whiteboard, triggering Eraser transition)...');
  await page.evaluate((s) => window.loadSlide(s), slide2);

  // Frame at 0.2s: Top erase
  await page.evaluate(() => window.renderFrame(0.2, 5.0));
  await page.screenshot({ path: path.join(outDir, '02_eraser_sweep_0.2s.png') });
  console.log('Saved 02_eraser_sweep_0.2s.png');

  // Frame at 0.6s: Middle erase
  await page.evaluate(() => window.renderFrame(0.6, 5.0));
  await page.screenshot({ path: path.join(outDir, '03_eraser_sweep_0.6s.png') });
  console.log('Saved 03_eraser_sweep_0.6s.png');

  // Frame at 0.9s: Near bottom erase
  await page.evaluate(() => window.renderFrame(0.9, 5.0));
  await page.screenshot({ path: path.join(outDir, '04_eraser_sweep_0.9s.png') });
  console.log('Saved 04_eraser_sweep_0.9s.png');

  // Frame at 1.8s: Eraser finished, new slide typing
  await page.evaluate(() => window.renderFrame(1.8, 5.0));
  await page.screenshot({ path: path.join(outDir, '05_slide2_typing_1.8s.png') });
  console.log('Saved 05_slide2_typing_1.8s.png');

  console.log('3. Loading Slide 3 (Whiteboard -> VS Code, triggering Alt+Tab transition)...');
  await page.evaluate((s) => window.loadSlide(s), slide3);
  await page.evaluate(() => window.renderFrame(0.5, 5.0));
  await page.screenshot({ path: path.join(outDir, '06_alttab_switch_0.5s.png') });
  console.log('Saved 06_alttab_switch_0.5s.png');

  // Slide 3 completed
  await page.evaluate(() => window.renderFrame(4.0, 5.0));
  await page.screenshot({ path: path.join(outDir, '07_vscode_completed.png') });
  console.log('Saved 07_vscode_completed.png');

  await browser.close();
  console.log('All tests completed successfully!');
}

run().catch((err) => {
  console.error('Error during test:', err);
  process.exit(1);
});

