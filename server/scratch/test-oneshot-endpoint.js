const { generateTeachingScript } = require('../services/teachingEngine.service');
const { translateSlides } = require('../services/translation.service');
const audioService = require('../services/audio.service');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function testOneShotLogic() {
  console.log('--- Testing One-Shot Logic (Script Gen + Translation + Audio) ---');
  const topic = 'Python';
  const subTopic = 'Looping';
  
  console.log('1. Script Generation with gemini-3.7-flash...');
  const scriptResult = await generateTeachingScript({ topic, subTopic, durationMinutes: 2 });
  console.log('✓ Script generated successfully. Slide count:', scriptResult.slideCount);

  let slides = JSON.parse(scriptResult.text);

  console.log('2. Translating slides to Tamil using gemini-3.7-flash...');
  const translatedSlides = await translateSlides(slides, 'Tamil');
  console.log('✓ Translated slides count:', translatedSlides.length);
  console.log('Sample Tamil Heading:', translatedSlides[0].heading);

  console.log('3. Testing Audio Service with Google Cloud TTS...');
  const testAudioPath = path.join(__dirname, '../output/test_oneshot_audio.mp3');
  await audioService.generateAudio(translatedSlides[0].narration, testAudioPath, 'ta');
  console.log('✓ TTS audio generated at:', testAudioPath);

  if (fs.existsSync(testAudioPath) && fs.statSync(testAudioPath).size > 100) {
    console.log('\n===============================================================');
    console.log('ONE-SHOT PIPELINE VERIFICATION PASSED 100%!');
    console.log('===============================================================');
  } else {
    throw new Error('TTS Audio file generation failed');
  }
}

testOneShotLogic().catch(err => {
  console.error('One-shot verification failed:', err);
  process.exit(1);
});
