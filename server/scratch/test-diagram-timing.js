/**
 * test-diagram-timing.js
 *
 * Verifies diagram timing and reveal sequence:
 * 1. Introduction: Diagram is hidden (visible === false)
 * 2. At reveal time: Diagram fades in (visible === true)
 * 3. Remainder of explanation: Diagram stays visible (visible === true)
 */

const path = require('path');
const puppeteer = require('puppeteer');
const diagramService = require('../services/diagram.service');

async function testTiming() {
  console.log('--- Launching Puppeteer to test Diagram Timing & Reveal ---');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1500,700']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1500, height: 700 });

  const templatePath = path.join(__dirname, '../templates/screen_share.html');
  await page.goto('file:///' + templatePath.replace(/\\/g, '/'), { waitUntil: 'networkidle0' });

  const totalDuration = 25.0; // 25 seconds total slide duration
  const appearAtSecond = 8.0; // Diagram should appear at 8 seconds

  const sampleSlide = {
    heading: 'Understanding Recursion',
    subheading: 'The Call Stack Unwound',
    isCode: false,
    isDiagram: true,
    estimatedDurationSeconds: 25,
    visual: {
      enabled: true,
      type: 'flowchart',
      title: 'Call Stack Visualization',
      nodes: [
        { id: '1', label: 'factorial(3)' },
        { id: '2', label: '3 * factorial(2)' },
        { id: '3', label: '2 * factorial(1)' },
        { id: '4', label: 'Base Case: 1' }
      ],
      connections: [
        { from: '1', to: '2' },
        { from: '2', to: '3' },
        { from: '3', to: '4' }
      ]
    },
    visualTiming: {
      enabled: true,
      appearAtSecond: appearAtSecond,
      triggerPhrase: "Let's trace what happens in memory."
    },
    mermaid: `graph TD
  A["factorial(3)"] --> B["3 * factorial(2)"]
  B --> C["2 * factorial(1)"]
  C --> D["Base Case: 1"]`,
    bullets: [],
    narration: "Recursion is a programming technique where a function calls itself. Before we trace the numbers, remember that each call must wait for the next call to finish. Let's trace what happens in memory."
  };

  // 1. Load slide
  await page.evaluate((slide) => {
    window.loadSlide(slide);
  }, sampleSlide);

  // 2. Render Mermaid SVG into container
  await diagramService.renderMermaidInPage(page, sampleSlide.mermaid);

  // ── TEST PHASE 1: Introduction (elapsed = 2s, before appearAtSecond = 8s) ──
  await page.evaluate((elapsed, total) => {
    window.renderFrame(elapsed, total);
  }, 2.0, totalDuration);

  const phase1 = await page.evaluate(() => {
    const card = document.getElementById('wb-diagram-card');
    return {
      cardExists: !!card,
      isVisible: card ? card.classList.contains('visible') : false
    };
  });

  console.log('\n[Phase 1: Introduction at 2.0s]');
  console.log('  Card exists:', phase1.cardExists);
  console.log('  Card isVisible:', phase1.isVisible);
  if (phase1.isVisible !== false) {
    throw new Error('FAILED: Diagram should NOT be visible during introductory explanation (2.0s < 8.0s)!');
  }
  console.log('  ✓ SUCCESS: Diagram is hidden during introduction!');

  const snapshotBefore = path.join(__dirname, 'diagram_timing_before_reveal.jpg');
  await page.screenshot({ path: snapshotBefore, type: 'jpeg', quality: 90, clip: { x: 0, y: 0, width: 1500, height: 700 } });
  console.log('  Saved "before reveal" snapshot:', snapshotBefore);

  // ── TEST PHASE 2: Reveal Point (elapsed = 8.5s, right after appearAtSecond = 8s) ──
  await page.evaluate((elapsed, total) => {
    window.renderFrame(elapsed, total);
  }, 8.5, totalDuration);

  const phase2 = await page.evaluate(() => {
    const card = document.getElementById('wb-diagram-card');
    return {
      cardExists: !!card,
      isVisible: card ? card.classList.contains('visible') : false
    };
  });

  console.log('\n[Phase 2: Reveal Point at 8.5s]');
  console.log('  Card isVisible:', phase2.isVisible);
  if (phase2.isVisible !== true) {
    throw new Error('FAILED: Diagram should be visible at reveal time (8.5s >= 8.0s)!');
  }
  console.log('  ✓ SUCCESS: Diagram smoothly revealed at 8.5s!');

  const snapshotAfter = path.join(__dirname, 'diagram_timing_after_reveal.jpg');
  await page.screenshot({ path: snapshotAfter, type: 'jpeg', quality: 90, clip: { x: 0, y: 0, width: 1500, height: 700 } });
  console.log('  Saved "after reveal" snapshot:', snapshotAfter);

  // ── TEST PHASE 3: Late Explanation (elapsed = 22.0s, near end of slide) ──
  await page.evaluate((elapsed, total) => {
    window.renderFrame(elapsed, total);
  }, 22.0, totalDuration);

  const phase3 = await page.evaluate(() => {
    const card = document.getElementById('wb-diagram-card');
    return {
      cardExists: !!card,
      isVisible: card ? card.classList.contains('visible') : false
    };
  });

  console.log('\n[Phase 3: Continued Explanation at 22.0s]');
  console.log('  Card isVisible:', phase3.isVisible);
  if (phase3.isVisible !== true) {
    throw new Error('FAILED: Diagram should REMAIN visible for the rest of the slide (22.0s)!');
  }
  console.log('  ✓ SUCCESS: Diagram remains visible throughout teacher explanation!');

  await browser.close();
  console.log('\n========================================================');
  console.log('ALL DIAGRAM TIMING VERIFICATION TESTS PASSED!');
  console.log('========================================================\n');
}

testTiming().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
