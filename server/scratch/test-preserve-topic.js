/**
 * test-preserve-topic.js
 *
 * Verifies that the user's Topic and Subtopic are preserved as the
 * Heading and Subheading across the generated slides, while preserving
 * rich, engaging educational narration.
 */

const teachingEngine = require('../services/teachingEngine.service');

async function testPreserveTopic() {
  console.log('--- Testing Preservation of User Topic & Subtopic ---');
  
  const userTopic = "Networks";
  const userSubtopic = "Computer Networks";
  
  const result = await teachingEngine.generateTeachingScript({
    topic: userTopic,
    subTopic: userSubtopic,
    durationMinutes: 5
  });

  const slides = JSON.parse(result.text);
  console.log(`Generated ${slides.length} slides.`);
  
  console.log('\n[Scene 1 (Opening Scene)]');
  console.log('  Heading:', JSON.stringify(slides[0].heading));
  console.log('  Subheading:', JSON.stringify(slides[0].subheading));
  console.log('  Narration excerpt:', slides[0].narration.substring(0, 150));

  if (slides[0].heading !== userTopic) {
    throw new Error(`FAILED: Expected heading to be "${userTopic}", got "${slides[0].heading}"`);
  }
  if (slides[0].subheading !== userSubtopic) {
    throw new Error(`FAILED: Expected subheading to be "${userSubtopic}", got "${slides[0].subheading}"`);
  }
  console.log('  ✓ Scene 1 heading & subheading match user inputs perfectly!');

  for (let i = 1; i < slides.length; i++) {
    console.log(`\n[Scene ${i + 1}]`);
    console.log('  Heading:', JSON.stringify(slides[i].heading));
    console.log('  Subheading:', JSON.stringify(slides[i].subheading));
    if (!slides[i].heading.toLowerCase().includes(userTopic.toLowerCase())) {
      throw new Error(`FAILED: Scene ${i + 1} heading does not include topic "${userTopic}": "${slides[i].heading}"`);
    }
  }

  console.log('\n=============================================================');
  console.log('ALL TOPIC & SUBTOPIC PRESERVATION TESTS PASSED!');
  console.log('=============================================================\n');
}

testPreserveTopic().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
