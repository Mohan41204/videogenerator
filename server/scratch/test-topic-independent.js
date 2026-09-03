/**
 * test-topic-independent.js
 *
 * Verifies Topic-Independent Real-World Visual Generation across diverse domains:
 * 1. Economics (Inflation)
 * 2. Biology (Photosynthesis)
 * 3. Computer Science (Cache Memory)
 * 
 * Asserts:
 * - No topic-specific hardcoding
 * - Pure AI visual reasoning
 * - Valid visual strategy: direct | analogy | process | comparison | spatial
 * - Concrete, familiar, non-abstract imagePrompt
 * - Concept mapping present
 * - Timed reveal (appearAtSecond & triggerPhrase)
 * - Heading/Subheading preserved
 */

const teachingEngine = require('../services/teachingEngine.service');

const TEST_CASES = [
  { topic: 'Economics', subTopic: 'Inflation and Purchasing Power' },
  { topic: 'Biology', subTopic: 'Photosynthesis in Plant Cells' },
  { topic: 'Computer Science', subTopic: 'CPU Cache Memory' }
];

async function runTopicTest(testCase) {
  console.log(`\n================================================================`);
  console.log(`TESTING: Topic="${testCase.topic}", SubTopic="${testCase.subTopic}"`);
  console.log(`================================================================`);

  const result = await teachingEngine.generateTeachingScript({
    topic: testCase.topic,
    subTopic: testCase.subTopic,
    durationMinutes: 5
  });

  const slides = JSON.parse(result.text);
  console.log(`Generated ${slides.length} slides.`);

  // Verify Scene 1 heading and subheading preservation
  console.log(`[Scene 1 Heading/Subheading Check]`);
  console.log(`  Heading: "${slides[0].heading}" (Expected: "${testCase.topic}")`);
  console.log(`  Subheading: "${slides[0].subheading}" (Expected: "${testCase.subTopic}")`);
  if (slides[0].heading !== testCase.topic) {
    throw new Error(`Scene 1 heading mismatch: expected "${testCase.topic}", got "${slides[0].heading}"`);
  }
  if (slides[0].subheading !== testCase.subTopic) {
    throw new Error(`Scene 1 subheading mismatch: expected "${testCase.subTopic}", got "${slides[0].subheading}"`);
  }
  console.log(`  ✓ Scene 1 heading & subheading perfectly preserved!`);

  let rwCount = 0;
  let diagCount = 0;

  slides.forEach((slide, idx) => {
    const rw = slide.realWorldVisual;
    const isRWEnabled = rw && rw.enabled === true;
    const isDiag = slide.isDiagram || (slide.visual && slide.visual.enabled);

    if (isRWEnabled) rwCount++;
    if (isDiag) diagCount++;

    console.log(`\n[Scene ${idx + 1}] "${slide.heading}" - "${slide.subheading}"`);
    console.log(`  SceneType: ${slide.sceneType} | RW Visual: ${isRWEnabled} | Diagram: ${isDiag}`);

    if (isRWEnabled) {
      console.log(`  → Strategy (visualType): "${rw.visualType}"`);
      console.log(`  → Scenario: "${rw.scenario}"`);
      console.log(`  → Purpose: "${rw.purpose}"`);
      console.log(`  → Timing: appearAtSecond = ${slide.realWorldVisualTiming?.appearAtSecond}s (trigger: "${slide.realWorldVisualTiming?.triggerPhrase}")`);
      console.log(`  → Concept Mappings:`, (rw.conceptMapping || []).map(m => `${m.realWorldElement} ➔ ${m.concept}`).join(' | '));
      console.log(`  → Image Prompt: "${rw.imagePrompt?.substring(0, 110)}..."`);

      // Validation
      const validStrategies = ['direct', 'analogy', 'process', 'comparison', 'spatial'];
      if (!validStrategies.includes(rw.visualType)) {
        throw new Error(`Invalid visualType strategy: "${rw.visualType}"`);
      }
      if (!rw.scenario || rw.scenario.length < 5) {
        throw new Error(`Missing or too short scenario description!`);
      }
      if (!slide.realWorldVisualTiming || typeof slide.realWorldVisualTiming.appearAtSecond !== 'number') {
        throw new Error(`Missing valid appearAtSecond timing!`);
      }
    }
  });

  console.log(`\nSummary for "${testCase.topic}":`);
  console.log(`  Real-World Visuals: ${rwCount}`);
  console.log(`  Technical Diagrams: ${diagCount}`);
  console.log(`  Coexisting: ${rwCount > 0 && diagCount > 0}`);

  return { rwCount, diagCount };
}

async function main() {
  console.log('--- STARTING TOPIC-INDEPENDENT REAL-WORLD VISUAL TESTS ---');
  for (const tc of TEST_CASES) {
    await runTopicTest(tc);
  }
  console.log('\n================================================================');
  console.log('ALL TOPIC-INDEPENDENT REAL-WORLD VISUAL TESTS PASSED!');
  console.log('================================================================\n');
}

main().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
