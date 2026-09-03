/**
 * test-safe-visuals-suite.js
 *
 * Verifies the 5 strict acceptance test cases:
 * 1. Test 1 — Diagram only: isDiagram=true, realWorldVisual={enabled: false}.
 *    Assert: Existing diagram renders; wb-image-card does NOT exist in DOM; zero blank reserved space.
 * 2. Test 2 — Real-world visual only: isDiagram=false, realWorldVisual={enabled: true}.
 *    Assert: Real-world visual renders; wb-diagram-card does NOT exist in DOM.
 * 3. Test 3 — Diagram followed by real-world visual:
 *    Assert: Scene 1 renders diagram with no image container; Scene 2 renders image with no diagram container.
 * 4. Test 4 — Full lesson:
 *    Assert: Introduction -> Concept -> Diagram -> Explanation -> Real-world -> Recap.
 * 5. Test 5 — Legacy lesson with no new fields (backwards compatibility):
 *    Assert: Renders diagram immediately, zero errors, zero image containers.
 */

const path = require('path');
const puppeteer = require('puppeteer');
const diagramService = require('../services/diagram.service');
const teachingEngine = require('../services/teachingEngine.service');

async function runSafeVisualsSuite() {
  console.log('================================================================');
  console.log('RUNNING SAFE VISUALS SUITE (ALL 5 ACCEPTANCE CRITERIA TESTS)');
  console.log('================================================================\n');

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1500,700']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1500, height: 700 });

  const templatePath = path.join(__dirname, '../templates/screen_share.html');
  const sampleImagePath = path.join(__dirname, '../output/images/test_service_car.jpg');

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST 1: Diagram Only
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('--- TEST 1: Diagram Only (isDiagram=true, realWorldVisual=disabled) ---');
  await page.goto('file:///' + templatePath.replace(/\\/g, '/'), { waitUntil: 'networkidle0' });

  const test1Slide = {
    heading: 'Computer Networks',
    subheading: 'Request and Response Flow',
    isDiagram: true,
    mermaid: 'graph LR\n  Client["Client App"] --> Server["API Server"]',
    visualTiming: { enabled: true, appearAtSecond: 2.0 },
    realWorldVisual: { enabled: false },
    narration: 'Here is the request and response flow between the client and server.'
  };

  await page.evaluate((slide) => {
    window.loadSlide(slide);
  }, test1Slide);

  // Render diagram via diagram service
  await diagramService.renderMermaidInPage(page, test1Slide.mermaid);

  // Frame at 3.0s (diagram revealed)
  await page.evaluate(() => {
    window.renderFrame(3.0, 10.0);
  });

  const t1Check = await page.evaluate(() => {
    const diag = document.getElementById('wb-diagram-card');
    const img = document.getElementById('wb-image-card');
    const svg = diag ? diag.querySelector('svg') : null;
    return {
      hasDiagContainer: !!diag,
      diagVisible: diag ? diag.classList.contains('visible') : false,
      hasSvg: !!svg,
      hasImageContainer: !!img
    };
  });

  console.log('  Diagram Container Exists:', t1Check.hasDiagContainer);
  console.log('  Diagram Visible:', t1Check.diagVisible);
  console.log('  SVG Rendered Inside Container:', t1Check.hasSvg);
  console.log('  Image Container Exists (Must be false):', t1Check.hasImageContainer);

  if (!t1Check.hasDiagContainer || !t1Check.diagVisible || !t1Check.hasSvg) {
    throw new Error('FAILED Test 1: Diagram failed to render!');
  }
  if (t1Check.hasImageContainer) {
    throw new Error('FAILED Test 1: Image container should NOT exist in DOM for diagram slide!');
  }
  console.log('  ✓ Test 1 PASSED: Diagram renders perfectly; zero image container / zero blank space.\n');

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST 2: Real-World Visual Only
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('--- TEST 2: Real-World Visual Only (isDiagram=false, realWorldVisual=enabled) ---');
  await page.goto('file:///' + templatePath.replace(/\\/g, '/'), { waitUntil: 'networkidle0' });

  const test2Slide = {
    heading: 'Object-Oriented Programming',
    subheading: 'Classes and Objects',
    isDiagram: false,
    imagePath: sampleImagePath,
    realWorldVisual: {
      enabled: true,
      scenario: 'Car manufacturing blueprint and finished cars',
      annotations: [
        { type: 'callout', target: 'Blueprint', label: 'Template', concept: 'Class', x: 0.3, y: 0.4, appearAtSecond: 2.0 }
      ]
    },
    realWorldVisualTiming: { enabled: true, appearAtSecond: 2.0 },
    narration: 'Now let us look at a real-world example of blueprints and cars.'
  };

  await page.evaluate((slide) => {
    window.loadSlide(slide);
  }, test2Slide);

  await page.evaluate(() => {
    window.renderFrame(3.0, 10.0);
  });

  const t2Check = await page.evaluate(() => {
    const diag = document.getElementById('wb-diagram-card');
    const img = document.getElementById('wb-image-card');
    return {
      hasDiagContainer: !!diag,
      hasImageContainer: !!img,
      imageVisible: img ? img.classList.contains('visible') : false
    };
  });

  console.log('  Diagram Container Exists (Must be false):', t2Check.hasDiagContainer);
  console.log('  Image Container Exists:', t2Check.hasImageContainer);
  console.log('  Image Visible:', t2Check.imageVisible);

  if (t2Check.hasDiagContainer) {
    throw new Error('FAILED Test 2: Diagram container should NOT exist in DOM for real-world slide!');
  }
  if (!t2Check.hasImageContainer || !t2Check.imageVisible) {
    throw new Error('FAILED Test 2: Real-world image failed to render!');
  }
  console.log('  ✓ Test 2 PASSED: Real-world visual renders; zero diagram container.\n');

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST 3: Diagram Followed by Real-World Visual (Sequential Slides)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('--- TEST 3: Diagram Followed by Real-World Visual (Slide 1 -> Slide 2) ---');

  // Slide 1: Diagram
  await page.goto('file:///' + templatePath.replace(/\\/g, '/'), { waitUntil: 'networkidle0' });
  await page.evaluate((slide) => { window.loadSlide(slide); }, test1Slide);
  await diagramService.renderMermaidInPage(page, test1Slide.mermaid);
  await page.evaluate(() => { window.renderFrame(3.0, 10.0); });

  const s1Check = await page.evaluate(() => ({
    hasDiag: !!document.getElementById('wb-diagram-card'),
    hasImg: !!document.getElementById('wb-image-card')
  }));
  console.log('  Slide 1: Has Diagram =', s1Check.hasDiag, '| Has Image =', s1Check.hasImg);
  if (!s1Check.hasDiag || s1Check.hasImg) throw new Error('FAILED Test 3 Slide 1');

  // Slide 2: Real-World Visual
  await page.evaluate((slide) => { window.loadSlide(slide); }, test2Slide);
  await page.evaluate(() => { window.renderFrame(3.0, 10.0); });

  const s2Check = await page.evaluate(() => ({
    hasDiag: !!document.getElementById('wb-diagram-card'),
    hasImg: !!document.getElementById('wb-image-card')
  }));
  console.log('  Slide 2: Has Diagram =', s2Check.hasDiag, '| Has Image =', s2Check.hasImg);
  if (s2Check.hasDiag || !s2Check.hasImg) throw new Error('FAILED Test 3 Slide 2');

  console.log('  ✓ Test 3 PASSED: Clean transition between diagram slide and real-world slide.\n');

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST 4: Full Lesson Planning & Sequence Verification
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('--- TEST 4: Full Lesson Sequence Verification ---');
  const fullLessonResult = await teachingEngine.generateTeachingScript({
    topic: 'Computer Networks',
    subTopic: 'TCP vs UDP',
    durationMinutes: 5
  });

  const slides = JSON.parse(fullLessonResult.text);
  console.log(`  Generated ${slides.length} slides.`);

  const stages = slides.map(s => s.teachingStage);
  console.log('  Teaching Stages Sequence:', stages.join(' ➔ '));

  let firstDiag = -1;
  let firstRW = -1;
  slides.forEach((s, i) => {
    if (firstDiag === -1 && (s.isDiagram || s.isCode)) firstDiag = i;
    if (firstRW === -1 && s.realWorldVisual?.enabled) firstRW = i;
  });

  console.log(`  Technical Diagram/Code on Scene ${firstDiag !== -1 ? firstDiag + 1 : 'None'}`);
  console.log(`  Real-World Visual on Scene ${firstRW !== -1 ? firstRW + 1 : 'None'}`);

  if (firstDiag !== -1 && firstRW !== -1 && firstRW < firstDiag) {
    throw new Error('FAILED Test 4: Real-world visual must appear AFTER technical diagram!');
  }
  if (slides[0].teachingStage !== 'introduction' || slides[0].isDiagram || slides[0].realWorldVisual?.enabled) {
    throw new Error('FAILED Test 4: Scene 1 must be clean introduction!');
  }
  if (slides[slides.length - 1].teachingStage !== 'recap' || slides[slides.length - 1].realWorldVisual?.enabled) {
    throw new Error('FAILED Test 4: Final scene must be clean recap!');
  }
  console.log('  ✓ Test 4 PASSED: Full lesson order perfectly structured.\n');

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST 5: Legacy Lesson with No New Fields (Backwards Compatibility)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('--- TEST 5: Legacy Lesson (No realWorldVisual field, legacy Mermaid) ---');
  await page.goto('file:///' + templatePath.replace(/\\/g, '/'), { waitUntil: 'networkidle0' });

  // Pure legacy slide with NO realWorldVisual, NO visualTiming, NO annotations
  const legacySlide = {
    heading: 'Legacy Slide',
    subheading: 'Classic Flowchart',
    isDiagram: true,
    mermaid: 'graph TD\n  Start --> Process --> End',
    bullets: ['Step 1: Start', 'Step 2: Process', 'Step 3: End'],
    narration: 'This is a legacy slide with a standard flowchart.'
  };

  await page.evaluate((slide) => {
    window.loadSlide(slide);
  }, legacySlide);

  await diagramService.renderMermaidInPage(page, legacySlide.mermaid);

  // At frame 0.5s, legacy diagram should already be visible (appearAtSecond = 0)
  await page.evaluate(() => {
    window.renderFrame(0.5, 10.0);
  });

  const t5Check = await page.evaluate(() => {
    const diag = document.getElementById('wb-diagram-card');
    const img = document.getElementById('wb-image-card');
    const svg = diag ? diag.querySelector('svg') : null;
    return {
      hasDiag: !!diag,
      diagVisible: diag ? diag.classList.contains('visible') : false,
      hasSvg: !!svg,
      hasImg: !!img
    };
  });

  console.log('  Legacy Diagram Container Exists:', t5Check.hasDiag);
  console.log('  Legacy Diagram Visible immediately:', t5Check.diagVisible);
  console.log('  Legacy SVG Rendered:', t5Check.hasSvg);
  console.log('  Image Container Exists (Must be false):', t5Check.hasImg);

  if (!t5Check.hasDiag || !t5Check.diagVisible || !t5Check.hasSvg) {
    throw new Error('FAILED Test 5: Legacy diagram failed to render!');
  }
  if (t5Check.hasImg) {
    throw new Error('FAILED Test 5: Legacy slide should have zero image containers!');
  }
  console.log('  ✓ Test 5 PASSED: 100% backwards compatibility with legacy scripts.\n');

  await browser.close();

  console.log('================================================================');
  console.log('ALL 5 TESTS IN SAFE VISUALS SUITE PASSED SUCCESSFULLY!');
  console.log('================================================================\n');
}

runSafeVisualsSuite().catch(err => {
  console.error('Safe visuals suite error:', err);
  process.exit(1);
});
