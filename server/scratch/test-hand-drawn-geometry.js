const assert = require('assert');
const boardEngine = require('../templates/board/board-engine');

const {
  DRAWING_PRESETS,
  resolveStyle,
  createRng,
  generateHandDrawnLine,
  generateHandDrawnRect,
  generateHandDrawnEllipse,
  generateHandDrawnRhombus,
  generateHandDrawnPath,
  drawPointPath
} = boardEngine;

async function runTestSuite() {
  console.log('=== TEST SUITE: Hand-Drawn Wobble Geometry Engine ===\n');

  // Test 1: Presets
  console.log('[Test 1] Presets configuration...');
  const cleanStyle = resolveStyle({ drawingStyle: 'clean' });
  assert.strictEqual(cleanStyle.roughness, 0);
  assert.strictEqual(cleanStyle.bowing, 0);

  const handStyle = resolveStyle({}); // default
  assert.strictEqual(handStyle.drawingStyle, 'hand_drawn');
  assert.strictEqual(handStyle.roughness, 2.5);
  assert.strictEqual(handStyle.bowing, 2.0);

  const sketchyStyle = resolveStyle({ drawingStyle: 'sketchy' });
  assert.strictEqual(sketchyStyle.roughness, 4.0);
  assert.strictEqual(sketchyStyle.doubleStroke, true);
  console.log('  ✓ Presets resolved correctly (clean, hand_drawn, sketchy).');

  // Test 2: Clean mode produces straight geometry
  console.log('\n[Test 2] Clean mode straight geometry...');
  const cleanLine = generateHandDrawnLine(100, 100, 300, 100, cleanStyle, createRng(1));
  assert.strictEqual(cleanLine.length, 2);
  assert.strictEqual(cleanLine[0].y, cleanLine[1].y);
  console.log('  ✓ Clean mode produces exact straight line with zero deviation.');

  // Test 3: Hand-drawn mode introduces controlled organic wobble
  console.log('\n[Test 3] Hand-drawn mode subtle organic wobble...');
  const rng1 = createRng(42);
  const handLine = generateHandDrawnLine(100, 100, 300, 100, handStyle, rng1);
  assert(handLine.length > 2, 'Hand-drawn line should be a smooth multi-point path');

  // Measure max deviation from straight baseline (y = 100)
  let maxDev = 0;
  for (const pt of handLine) {
    const dev = Math.abs(pt.y - 100);
    if (dev > maxDev) maxDev = dev;
  }
  console.log(`  → Hand-drawn line max deviation: ${maxDev.toFixed(2)}px`);
  assert(maxDev > 0.5, 'Line should have natural organic variation (> 0.5px)');
  assert(maxDev < 20.0, 'Line variation should be restrained and recognizable (< 20.0px)');
  console.log('  ✓ Hand-drawn line has organic, hand-drawn deviation.');

  // Test 4: Rectangle perimeter continuity and closure
  console.log('\n[Test 4] Hand-drawn rectangle perimeter...');
  const rectPts = generateHandDrawnRect(50, 50, 200, 100, handStyle, createRng(100));
  assert(rectPts.length >= 40, 'Rectangle should contain continuous points array');
  const startPt = rectPts[0];
  const endPt = rectPts[rectPts.length - 1];
  const gap = Math.sqrt(Math.pow(endPt.x - startPt.x, 2) + Math.pow(endPt.y - startPt.y, 2));
  console.log(`  → Rectangle perimeter points: ${rectPts.length}, closure gap: ${gap.toFixed(2)}px`);
  assert(gap < 8.0, 'Perimeter should close cleanly at the starting point');
  console.log('  ✓ Rectangle forms a closed, continuous organic perimeter.');

  // Test 5: Ellipse subtle asymmetry
  console.log('\n[Test 5] Hand-drawn ellipse asymmetry...');
  const ellipsePts = generateHandDrawnEllipse(200, 200, 80, 50, handStyle, createRng(200));
  assert.strictEqual(ellipsePts.length, 37);
  // Check bounds
  for (const pt of ellipsePts) {
    assert(pt.x >= 200 - 95 && pt.x <= 200 + 95, 'Ellipse x should remain within bounds');
    assert(pt.y >= 200 - 65 && pt.y <= 200 + 65, 'Ellipse y should remain within bounds');
  }
  console.log('  ✓ Ellipse preserves recognizable shape with organic curvature within bounds.');

  // Test 6: Decision Rhombus
  console.log('\n[Test 6] Hand-drawn rhombus / decision shape...');
  const rhombusPts = generateHandDrawnRhombus(100, 100, 160, 90, handStyle, createRng(300));
  assert(rhombusPts.length >= 40);
  const rStart = rhombusPts[0];
  const rEnd = rhombusPts[rhombusPts.length - 1];
  const rGap = Math.sqrt(Math.pow(rEnd.x - rStart.x, 2) + Math.pow(rEnd.y - rStart.y, 2));
  assert(rGap < 8.0, 'Rhombus should close cleanly');
  console.log('  ✓ Rhombus generates 4 organic decision edges closing cleanly.');

  // Test 7: Determinism (identical seed -> identical points)
  console.log('\n[Test 7] Determinism with stable seed...');
  const passA = generateHandDrawnRect(60, 60, 180, 80, handStyle, createRng(777));
  const passB = generateHandDrawnRect(60, 60, 180, 80, handStyle, createRng(777));
  assert.deepStrictEqual(passA, passB, 'Identical seed MUST produce identical geometry');

  const passC = generateHandDrawnRect(60, 60, 180, 80, handStyle, createRng(888));
  assert.notDeepStrictEqual(passA, passC, 'Different seeds should produce different organic variation');
  console.log('  ✓ Seed determinism verified: Pass A === Pass B, Pass A !== Pass C.');

  console.log('\n======================================================');
  console.log('✓ ALL HAND-DRAWN GEOMETRY ENGINE TESTS PASSED!');
  console.log('======================================================\n');
}

runTestSuite().catch(err => {
  console.error('\n❌ Test failed:', err);
  process.exit(1);
});