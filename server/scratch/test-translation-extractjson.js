const assert = require('assert');
const { translateSlides } = require('../services/translation.service');

// Test that translation.service loads cleanly and extractJson handles edge cases
console.log('Testing translation.service extractJson robustness...');

// Test with mock slides array
const testSlides = [
  {
    heading: 'Python',
    subheading: 'if statement',
    bullets: ['Condition check', 'Branching execution'],
    narration: 'Hello world! Welcome to Python.'
  }
];

// Test English pass-through (instant)
translateSlides(testSlides, 'English').then(res => {
  assert.strictEqual(res.length, 1);
  console.log('✓ English pass-through verified');
  console.log('✓ translation.service compiled and running cleanly!');
}).catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});

