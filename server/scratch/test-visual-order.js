/**
 * test-visual-order.js
 *
 * Verifies that generated lessons adhere to the Structured Visual Teaching Order:
 * 1. Topic Introduction (Scene 1) -> No early visuals
 * 2. Core Concept Explanation -> Build intuition
 * 3. Technical Diagram / Code -> Formal representation
 * 4. Technical Explanation -> How it operates
 * 5. Real-World Annotated Scenario -> Reinforcement (where do we see this?)
 * 6. Final Recap -> Clean takeaways (no visuals)
 */

const teachingEngine = require('../services/teachingEngine.service');

async function testVisualOrder() {
  console.log('--- STARTING STRUCTURED VISUAL TEACHING ORDER TESTS ---\n');

  const topic = 'Networks';
  const subTopic = 'Computer Networks';

  console.log(`Generating script for: Topic="${topic}", SubTopic="${subTopic}", Duration=5m`);
  const result = await teachingEngine.generateTeachingScript({
    topic,
    subTopic,
    durationMinutes: 5
  });

  const slides = JSON.parse(result.text);
  console.log(`\nGenerated ${slides.length} slides.`);

  // 1. Check Scene 1 (Must be Introduction, no visuals)
  const scene1 = slides[0];
  console.log(`\n[Scene 1 Check]`);
  console.log(`  Heading: "${scene1.heading}"`);
  console.log(`  Subheading: "${scene1.subheading}"`);
  console.log(`  Stage: "${scene1.teachingStage}"`);
  console.log(`  Diagram: ${scene1.isDiagram}`);
  console.log(`  RW Visual: ${scene1.realWorldVisual?.enabled}`);

  if (scene1.teachingStage !== 'introduction') {
    throw new Error(`FAILED: Scene 1 stage must be "introduction", got "${scene1.teachingStage}"`);
  }
  if (scene1.isDiagram || (scene1.realWorldVisual && scene1.realWorldVisual.enabled)) {
    throw new Error(`FAILED: Scene 1 must NOT contain diagrams or real-world visuals!`);
  }
  console.log('  ✓ Scene 1 introduction strictly clean (no premature visuals).');

  // 2. Check Final Scene (Must be Recap, no visuals)
  const lastScene = slides[slides.length - 1];
  console.log(`\n[Final Scene Check - Scene ${slides.length}]`);
  console.log(`  Heading: "${lastScene.heading}"`);
  console.log(`  Subheading: "${lastScene.subheading}"`);
  console.log(`  Stage: "${lastScene.teachingStage}"`);
  console.log(`  Diagram: ${lastScene.isDiagram}`);
  console.log(`  RW Visual: ${lastScene.realWorldVisual?.enabled}`);

  if (lastScene.teachingStage !== 'recap') {
    throw new Error(`FAILED: Final scene stage must be "recap", got "${lastScene.teachingStage}"`);
  }
  if (lastScene.isDiagram || (lastScene.realWorldVisual && lastScene.realWorldVisual.enabled)) {
    throw new Error(`FAILED: Final scene must NOT contain new diagrams or real-world visuals!`);
  }
  console.log('  ✓ Final scene recap strictly clean.');

  // 3. Check Sequence of Visuals
  let diagramIdx = -1;
  let realWorldIdx = -1;

  slides.forEach((s, idx) => {
    console.log(`\n[Scene ${idx + 1}] "${s.heading}" - "${s.subheading}"`);
    console.log(`  Stage: ${s.teachingStage} | SceneType: ${s.sceneType}`);
    console.log(`  Diagram: ${s.isDiagram} | RW Visual: ${s.realWorldVisual?.enabled}`);

    if (diagramIdx === -1 && (s.isDiagram || s.isCode || (s.visual && s.visual.enabled))) {
      diagramIdx = idx;
    }
    if (realWorldIdx === -1 && s.realWorldVisual && s.realWorldVisual.enabled) {
      realWorldIdx = idx;
    }
  });

  console.log(`\nVisual Ordering Analysis:`);
  console.log(`  First Technical Diagram / Code Scene: Scene ${diagramIdx !== -1 ? diagramIdx + 1 : 'None'}`);
  console.log(`  First Real-World Scenario Scene: Scene ${realWorldIdx !== -1 ? realWorldIdx + 1 : 'None'}`);

  if (diagramIdx !== -1 && realWorldIdx !== -1) {
    if (realWorldIdx <= diagramIdx) {
      throw new Error(`FAILED: Real-world visual (Scene ${realWorldIdx + 1}) must appear AFTER technical diagram (Scene ${diagramIdx + 1})!`);
    }
    console.log(`  ✓ PERFECT: Real-world visual appears as reinforcement AFTER technical diagram.`);
  }

  console.log('\n================================================================');
  console.log('STRUCTURED VISUAL TEACHING ORDER TEST PASSED!');
  console.log('================================================================\n');
}

testVisualOrder().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
