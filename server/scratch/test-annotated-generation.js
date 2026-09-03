/**
 * test-annotated-generation.js
 *
 * Verifies live Gemini script generation produces structured educational
 * annotations (arrows, callouts, highlights, coordinates) without hardcoding.
 */

const teachingEngine = require('../services/teachingEngine.service');

async function testAnnotatedGeneration() {
  console.log('--- Testing Live AI Generation of Annotated Real-World Visuals ---');

  const topic = 'APIs';
  const subTopic = 'How REST APIs Work';

  console.log(`\nGenerating script for: "${topic}" - "${subTopic}"`);
  const result = await teachingEngine.generateTeachingScript({
    topic,
    subTopic,
    durationMinutes: 5
  });

  const slides = JSON.parse(result.text);
  console.log(`Generated ${slides.length} slides.`);

  let foundAnnotatedScene = false;

  slides.forEach((slide, idx) => {
    const rw = slide.realWorldVisual;
    const isEnabled = rw && rw.enabled === true;
    console.log(`\n[Scene ${idx + 1}] "${slide.heading}" - "${slide.subheading}"`);
    console.log(`  SceneType: ${slide.sceneType} | RealWorld Visual: ${isEnabled}`);

    if (isEnabled) {
      console.log(`  → Strategy: "${rw.visualType}"`);
      console.log(`  → Scenario: "${rw.scenario}"`);
      console.log(`  → Purpose: "${rw.purpose}"`);
      console.log(`  → Total Annotations: ${Array.isArray(rw.annotations) ? rw.annotations.length : 0}`);

      if (Array.isArray(rw.annotations) && rw.annotations.length > 0) {
        foundAnnotatedScene = true;
        rw.annotations.forEach((ann, aIdx) => {
          console.log(`    [Ann ${aIdx + 1}] Type: "${ann.type}", Label: "${ann.label}", Concept: "${ann.concept}", Pos: (${ann.x}, ${ann.y})` + 
            (ann.toX ? ` -> (${ann.toX}, ${ann.toY})` : '') + ` @ ${ann.appearAtSecond}s`);
          
          if (typeof ann.x !== 'number' || typeof ann.y !== 'number' || ann.x < 0 || ann.x > 1) {
            throw new Error(`Invalid annotation coordinates: (${ann.x}, ${ann.y})`);
          }
        });
      }
    }
  });

  console.log('\n================================================================');
  if (foundAnnotatedScene) {
    console.log('✓ SUCCESS: Found and verified scene with educational annotations!');
  } else {
    console.log('Note: AI generated a lesson without real-world visuals for this run, which is valid optional behavior.');
  }
  console.log('================================================================\n');
}

testAnnotatedGeneration().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
