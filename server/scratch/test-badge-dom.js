const fs = require('fs');
const path = require('path');
const assert = require('assert');

// Simulate DOM loading screen_share.html
const htmlContent = fs.readFileSync('server/templates/screen_share.html', 'utf8');

// Check that badge CSS is present
assert(htmlContent.includes('.wb-connection-badge'), 'Expected .wb-connection-badge CSS class in screen_share.html');
assert(htmlContent.includes('#0369a1'), 'Expected badge styling colors');
assert(htmlContent.includes('slide.realWorldConnection && slide.realWorldConnection.hasConnection'), 'Expected slide.realWorldConnection handling in loadSlide/buildSlide');
assert(htmlContent.includes('Case Study:'), 'Expected Case Study prefix');
assert(htmlContent.includes('Pioneer:'), 'Expected Pioneer prefix');
assert(htmlContent.includes('Concept Analogy:'), 'Expected Concept Analogy prefix');

assert(htmlContent.includes('.wb-has-realworld'), 'Expected .wb-has-realworld CSS class');
assert(htmlContent.includes("canvas.classList.add('wb-has-realworld')"), 'Expected classList.add wb-has-realworld');

console.log('[PASS] screen_share.html contains all necessary realWorldConnection rendering elements, CSS, and split side-by-side layout!');

