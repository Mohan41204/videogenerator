/**
 * test-annotated-visual-render.js
 *
 * Verifies Puppeteer rendering of Dynamic Annotated Real-World Teaching Visuals:
 * 1. Base clean scenario image display
 * 2. SVG overlay (directional arrows, boxes, pins)
 * 3. HTML callout badges (concept + label)
 * 4. Progressive timed reveal:
 *    - 2.0s: Image and annotations hidden
 *    - 6.5s: Base image + Annotation 0 (Blueprint) revealed
 *    - 10.0s: Arrow + Annotation 1 & 2 revealed
 *    - 15.0s: All annotations fully revealed
 * 5. Saves artifact snapshots
 */

const path = require('path');
const puppeteer = require('puppeteer');

async function testAnnotatedRender() {
  console.log('--- Launching Puppeteer to test Annotated Real-World Visuals ---');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1500,700']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1500, height: 700 });

  const templatePath = path.join(__dirname, '../templates/screen_share.html');
  await page.goto('file:///' + templatePath.replace(/\\/g, '/'), { waitUntil: 'networkidle0' });

  const sampleImagePath = path.join(__dirname, '../output/images/test_service_car.jpg');
  const totalDuration = 25.0;

  const sampleSlide = {
    heading: 'Object-Oriented Programming',
    subheading: 'Classes and Objects',
    isCode: false,
    isDiagram: false,
    estimatedDurationSeconds: 25,
    imagePath: sampleImagePath,
    realWorldVisual: {
      enabled: true,
      scenario: 'A car design blueprint and manufactured cars',
      purpose: 'Demonstrate how a class acts as a template to create objects',
      visualType: 'analogy',
      imagePrompt: 'A car design blueprint next to finished manufactured cars on clean white background',
      conceptMapping: [
        { realWorldElement: 'Design Blueprint', concept: 'Class Definition' },
        { realWorldElement: 'Red Car', concept: 'car1 = new Car()' },
        { realWorldElement: 'Blue Car', concept: 'car2 = new Car()' }
      ],
      annotations: [
        {
          type: 'callout',
          target: 'Car Blueprint',
          label: 'Blueprint Template',
          concept: 'Class Definition',
          x: 0.28,
          y: 0.35,
          appearAtSecond: 6.0,
          triggerPhrase: 'Think of the class as a factory blueprint.'
        },
        {
          type: 'arrow',
          target: 'Arrow to Car',
          label: 'Instantiates',
          concept: 'new Car()',
          x: 0.35,
          y: 0.40,
          toX: 0.65,
          toY: 0.40,
          appearAtSecond: 9.0,
          triggerPhrase: 'From this blueprint, we instantiate actual physical objects.'
        },
        {
          type: 'callout',
          target: 'Manufactured Car',
          label: 'Finished Machine',
          concept: 'Object Instance',
          x: 0.72,
          y: 0.40,
          appearAtSecond: 9.0,
          triggerPhrase: 'Each car on the road is a separate object instance.'
        },
        {
          type: 'callout',
          target: 'Second Car',
          label: 'Second Instance',
          concept: 'Independent State',
          x: 0.72,
          y: 0.75,
          appearAtSecond: 13.0,
          triggerPhrase: 'Each object has its own unique color and properties.'
        }
      ]
    },
    realWorldVisualTiming: {
      enabled: true,
      appearAtSecond: 5.0,
      triggerPhrase: 'Let us understand this with a real-world example.'
    },
    bullets: [],
    narration: "Before writing code, let us understand this with a real-world example. Think of the class as a factory blueprint. From this blueprint, we instantiate actual physical objects. Each car on the road is a separate object instance. Each object has its own unique color and properties."
  };

  // 1. Load slide
  await page.evaluate((slide) => {
    window.loadSlide(slide);
  }, sampleSlide);

  // ── PHASE 1: 2.0s (Before Base Image Reveal) ──
  await page.evaluate((elapsed, total) => {
    window.renderFrame(elapsed, total);
  }, 2.0, totalDuration);

  const phase1 = await page.evaluate(() => {
    const card = document.getElementById('wb-image-card');
    const ann0 = document.getElementById('wb-ann-html-0');
    return {
      cardVisible: card ? card.classList.contains('visible') : false,
      ann0Visible: ann0 ? ann0.classList.contains('visible') : false
    };
  });

  console.log('\n[Phase 1 @ 2.0s - Before Reveal]');
  console.log('  Image Card Visible:', phase1.cardVisible);
  console.log('  Annotation 0 Visible:', phase1.ann0Visible);
  if (phase1.cardVisible || phase1.ann0Visible) {
    throw new Error('FAILED: Card and annotations must be hidden before reveal time!');
  }
  console.log('  ✓ PASSED: Image card and annotations are hidden.');

  // ── PHASE 2: 7.0s (Base Image + Annotation 0 Revealed) ──
  await page.evaluate((elapsed, total) => {
    window.renderFrame(elapsed, total);
  }, 7.0, totalDuration);

  const phase2 = await page.evaluate(() => {
    const card = document.getElementById('wb-image-card');
    const ann0 = document.getElementById('wb-ann-html-0');
    const ann1 = document.getElementById('wb-ann-svg-1');
    const ann2 = document.getElementById('wb-ann-html-2');
    return {
      cardVisible: card ? card.classList.contains('visible') : false,
      ann0Visible: ann0 ? ann0.classList.contains('visible') : false,
      ann1Visible: ann1 ? ann1.classList.contains('visible') : false,
      ann2Visible: ann2 ? ann2.classList.contains('visible') : false
    };
  });

  console.log('\n[Phase 2 @ 7.0s - Partial Reveal]');
  console.log('  Image Card Visible:', phase2.cardVisible);
  console.log('  Ann 0 (Blueprint Callout) Visible:', phase2.ann0Visible);
  console.log('  Ann 1 (Arrow) Visible:', phase2.ann1Visible);
  console.log('  Ann 2 (Object Callout) Visible:', phase2.ann2Visible);

  if (!phase2.cardVisible || !phase2.ann0Visible || phase2.ann1Visible || phase2.ann2Visible) {
    throw new Error('FAILED: Image and Ann 0 should be visible, but Ann 1 and 2 must still be hidden!');
  }
  console.log('  ✓ PASSED: Base image and first annotation revealed; subsequent annotations still hidden.');

  const snapPartial = path.join(__dirname, 'annotated_visual_partial_reveal.jpg');
  await page.screenshot({ path: snapPartial, type: 'jpeg', quality: 90, clip: { x: 0, y: 0, width: 1500, height: 700 } });
  console.log('  Saved partial reveal snapshot:', snapPartial);

  // ── PHASE 3: 15.0s (All Annotations Fully Revealed) ──
  await page.evaluate((elapsed, total) => {
    window.renderFrame(elapsed, total);
  }, 15.0, totalDuration);

  const phase3 = await page.evaluate(() => {
    const card = document.getElementById('wb-image-card');
    const annCount = document.querySelectorAll('.wb-ann-item').length;
    const visibleCount = document.querySelectorAll('.wb-ann-item.visible').length;
    const arrow = document.querySelector('.wb-ann-arrow');
    const callouts = Array.from(document.querySelectorAll('.wb-annotation-callout')).map(c => c.textContent.trim());
    return {
      cardVisible: card ? card.classList.contains('visible') : false,
      annCount,
      visibleCount,
      hasArrow: !!arrow,
      callouts
    };
  });

  console.log('\n[Phase 3 @ 15.0s - Full Annotation Reveal]');
  console.log('  Image Card Visible:', phase3.cardVisible);
  console.log('  Total Annotation Items:', phase3.annCount);
  console.log('  Visible Annotation Items:', phase3.visibleCount);
  console.log('  Has SVG Arrow:', phase3.hasArrow);
  console.log('  Rendered Callouts:', phase3.callouts);

  if (!phase3.cardVisible || phase3.visibleCount < 4 || !phase3.hasArrow) {
    throw new Error('FAILED: All annotations and arrows must be visible at 15.0s!');
  }
  console.log('  ✓ PASSED: All annotations, arrows, and callouts rendered smoothly!');

  const snapFull = path.join(__dirname, 'annotated_visual_full_reveal.jpg');
  await page.screenshot({ path: snapFull, type: 'jpeg', quality: 90, clip: { x: 0, y: 0, width: 1500, height: 700 } });
  console.log('  Saved full reveal snapshot:', snapFull);

  await browser.close();
  console.log('\n================================================================');
  console.log('ALL ANNOTATED REAL-WORLD VISUAL RENDER TESTS PASSED!');
  console.log('================================================================\n');
}

testAnnotatedRender().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
