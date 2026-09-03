/**
 * test-realworld-render.js
 *
 * Verifies Puppeteer rendering of AI-Generated Real-World Visual Scenarios:
 * 1. Image loading and display in #wb-image-card
 * 2. Concept mapping badges / pills
 * 3. Timed reveal:
 *    - 2.0s: Image is hidden (visible === false)
 *    - 8.0s: Image is visible (visible === true)
 *    - 20.0s: Image remains visible (visible === true)
 * 4. Captures snapshot artifacts
 */

const path = require('path');
const puppeteer = require('puppeteer');

async function testRealWorldRender() {
  console.log('--- Launching Puppeteer to test Real-World Scenario Render & Timing ---');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1500,700']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1500, height: 700 });

  const templatePath = path.join(__dirname, '../templates/screen_share.html');
  await page.goto('file:///' + templatePath.replace(/\\/g, '/'), { waitUntil: 'networkidle0' });

  // Use the verified generated car test image
  const sampleImagePath = path.join(__dirname, '../output/images/test_service_car.jpg');
  const totalDuration = 25.0;
  const appearAtSecond = 7.0;

  const sampleSlide = {
    heading: 'Classes & Objects in Python',
    subheading: 'The Blueprint and the Machine',
    isCode: false,
    isDiagram: false,
    estimatedDurationSeconds: 25,
    imagePath: sampleImagePath,
    realWorldVisual: {
      enabled: true,
      scenario: 'A car design blueprint showing different cars created from the same design',
      imagePrompt: 'A clean educational illustration showing a car design blueprint next to finished cars',
      purpose: 'Explain the relationship between a class (blueprint) and objects (instances)',
      conceptMapping: [
        { realWorldElement: 'Car Blueprint', concept: 'Class Definition' },
        { realWorldElement: 'Finished Red Car', concept: 'car1 = Car()' },
        { realWorldElement: 'Finished Blue Car', concept: 'car2 = Car()' }
      ]
    },
    realWorldVisualTiming: {
      enabled: true,
      appearAtSecond: appearAtSecond,
      triggerPhrase: "Let's use a real-world example."
    },
    bullets: [],
    narration: "Before we write a single line of Python, let's build the intuition. Think of a class not as an actual object, but as a factory blueprint. Let's use a real-world example to see how this works."
  };

  // 1. Load slide
  await page.evaluate((slide) => {
    window.loadSlide(slide);
  }, sampleSlide);

  // ── PHASE 1: Introduction (elapsed = 2.0s < appearAtSecond = 7.0s) ──
  await page.evaluate((elapsed, total) => {
    window.renderFrame(elapsed, total);
  }, 2.0, totalDuration);

  const phase1 = await page.evaluate(() => {
    const card = document.getElementById('wb-image-card');
    return {
      cardExists: !!card,
      isVisible: card ? card.classList.contains('visible') : false
    };
  });

  console.log('\n[Phase 1: Introduction at 2.0s]');
  console.log('  Card exists:', phase1.cardExists);
  console.log('  Card isVisible:', phase1.isVisible);
  if (phase1.isVisible !== false) {
    throw new Error('FAILED: Scenario image should be hidden during introduction (2.0s < 7.0s)!');
  }
  console.log('  ✓ SUCCESS: Real-world image is hidden during initial introduction!');

  const snapshotBefore = path.join(__dirname, 'scenario_timing_before_reveal.jpg');
  await page.screenshot({ path: snapshotBefore, type: 'jpeg', quality: 90, clip: { x: 0, y: 0, width: 1500, height: 700 } });
  console.log('  Saved "before reveal" snapshot:', snapshotBefore);

  // ── PHASE 2: Reveal Point (elapsed = 8.0s >= appearAtSecond = 7.0s) ──
  await page.evaluate((elapsed, total) => {
    window.renderFrame(elapsed, total);
  }, 8.0, totalDuration);

  const phase2 = await page.evaluate(() => {
    const card = document.getElementById('wb-image-card');
    const img = document.getElementById('wb-scenario-image');
    const pills = document.querySelectorAll('.wb-concept-pill');
    return {
      cardExists: !!card,
      isVisible: card ? card.classList.contains('visible') : false,
      imgExists: !!img,
      imgSrc: img ? img.src : '',
      pillCount: pills.length,
      pillLabels: Array.from(pills).map(p => p.textContent.trim())
    };
  });

  console.log('\n[Phase 2: Reveal Point at 8.0s]');
  console.log('  Card isVisible:', phase2.isVisible);
  console.log('  Image exists:', phase2.imgExists);
  console.log('  Pill count:', phase2.pillCount);
  console.log('  Concept mappings:', phase2.pillLabels);

  if (phase2.isVisible !== true) {
    throw new Error('FAILED: Scenario image should be visible at reveal time (8.0s >= 7.0s)!');
  }
  if (!phase2.imgExists) {
    throw new Error('FAILED: Scenario img element not found in DOM!');
  }
  if (phase2.pillCount !== 3) {
    throw new Error(`FAILED: Expected 3 concept pills, got ${phase2.pillCount}!`);
  }
  console.log('  ✓ SUCCESS: Real-world scenario image & concept mapping badges revealed smoothly!');

  const snapshotAfter = path.join(__dirname, 'scenario_timing_after_reveal.jpg');
  await page.screenshot({ path: snapshotAfter, type: 'jpeg', quality: 90, clip: { x: 0, y: 0, width: 1500, height: 700 } });
  console.log('  Saved "after reveal" snapshot:', snapshotAfter);

  // ── PHASE 3: Late Explanation (elapsed = 22.0s) ──
  await page.evaluate((elapsed, total) => {
    window.renderFrame(elapsed, total);
  }, 22.0, totalDuration);

  const phase3 = await page.evaluate(() => {
    const card = document.getElementById('wb-image-card');
    return {
      isVisible: card ? card.classList.contains('visible') : false
    };
  });

  console.log('\n[Phase 3: Continued Explanation at 22.0s]');
  console.log('  Card isVisible:', phase3.isVisible);
  if (phase3.isVisible !== true) {
    throw new Error('FAILED: Scenario image should REMAIN visible for the rest of the scene (22.0s)!');
  }
  console.log('  ✓ SUCCESS: Real-world scenario image remains visible for remainder of explanation!');

  await browser.close();
  console.log('\n=============================================================');
  console.log('ALL REAL-WORLD SCENARIO VISUAL TESTS PASSED SUCCESSFULLY!');
  console.log('=============================================================\n');
}

testRealWorldRender().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
