const translationService = require('../services/translation.service');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function testTranslation() {
  console.log('--- Testing translateText (Tamil / Tanglish) ---');
  const text = "Recursion is a programming technique where a function calls itself to solve smaller instances of a problem.";
  const translatedText = await translationService.translateText(text, 'Tamil');
  console.log('Original:', text);
  console.log('Translated:', translatedText);

  console.log('\n--- Testing translateSlides (Hindi / Hinglish) ---');
  const sampleSlides = [
    {
      heading: 'Introduction to Functions',
      subheading: 'What is a Function?',
      bullets: ['A block of code that performs a specific task', 'Can accept parameters and return values'],
      narration: 'Hello students, today we are going to learn about functions in Python.',
      isCode: false,
      isDiagram: false
    }
  ];

  const translatedSlides = await translationService.translateSlides(sampleSlides, 'Hindi');
  console.log('Translated Slides JSON:', JSON.stringify(translatedSlides, null, 2));

  console.log('\nTRANSLATION TEST PASSED SUCCESSFULLY!');
}

testTranslation().catch(err => {
  console.error('Translation test failed:', err);
  process.exit(1);
});
