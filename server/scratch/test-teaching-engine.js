const teachingEngine = require('../services/teachingEngine.service');

async function testGeneration() {
  console.log('--- TEST 1: python / oops ---');
  try {
    const res = await teachingEngine.generateTeachingScript({
      topic: 'python',
      subTopic: 'oops',
      durationMinutes: 5
    });

    console.log('Success:', res.success);
    console.log('Slide Count:', res.slideCount);
    console.log('Domain:', res.domain);
    const slides = JSON.parse(res.text);
    console.log('Scenes length:', slides.length);
    console.log('First scene heading:', slides[0].heading);
  } catch (err) {
    console.error('Test 1 failed:', err.message);
  }
}

testGeneration().catch(console.error);
