const te = require('../services/teachingEngine.service');

async function main() {
  console.log('Generating teaching script for Python Recursion...');
  const res = await te.generateTeachingScript({
    topic: 'Python',
    subTopic: 'Recursion',
    durationMinutes: 5
  });

  const slides = JSON.parse(res.text);
  console.log('\nTotal scenes generated:', slides.length);

  slides.forEach((s, i) => {
    console.log(`\n--- Scene ${i + 1}: "${s.heading}" ---`);
    console.log(`SceneType: ${s.sceneType} | VisualType: ${s.visualType} | isDiagram: ${s.isDiagram}`);
    if (s.visualTiming) {
      console.log('visualTiming:', JSON.stringify(s.visualTiming, null, 2));
    }
    if (s.isDiagram) {
      console.log(`Narration: "${s.narration.substring(0, 100)}..."`);
      console.log(`Appear at: ${s.visualTiming?.appearAtSecond}s (estimated total: ${s.estimatedDurationSeconds}s)`);
    }
  });
}

main().catch(console.error);
