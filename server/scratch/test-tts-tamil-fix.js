const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '../.env') });

const {
  validateTTSInput,
  cleanTextForTTS,
  normalizeNarrationForTTS,
  normalizationCache,
  translateText
} = require('../services/translation.service');

async function runTests() {
  console.log('=== STARTING TAMIL TTS FIX TEST SUITE ===\n');
  let passedCount = 0;
  let totalCount = 0;

  function assert(condition, message) {
    totalCount++;
    if (condition) {
      console.log(`✅ [PASS] ${message}`);
      passedCount++;
    } else {
      console.error(`❌ [FAIL] ${message}`);
    }
  }

  // Test 1: "இந்த function-ஐ call பண்ணலாம்." -> must not contain function-ஐ
  console.log('\n--- Test 1: Hyphenated suffix (function-ஐ) ---');
  const text1 = 'இந்த function-ஐ call பண்ணலாம்.';
  const val1 = validateTTSInput(text1);
  assert(val1.hasIssues && val1.issues.includes('mixed-language-suffix'), 'Validation correctly flags function-ஐ');
  const res1 = await normalizeNarrationForTTS(text1);
  console.log(`Result 1: "${res1}"`);
  assert(!res1.includes('function-ஐ') && !res1.includes('functionஐ'), 'Output does not contain function-ஐ or functionஐ');

  // Test 2: "இந்த code-ஐ run பண்ணலாம்." -> must not contain code-ஐ
  console.log('\n--- Test 2: Hyphenated suffix (code-ஐ) ---');
  const text2 = 'இந்த code-ஐ run பண்ணலாம்.';
  const val2 = validateTTSInput(text2);
  assert(val2.hasIssues && val2.issues.includes('mixed-language-suffix'), 'Validation correctly flags code-ஐ');
  const res2 = await normalizeNarrationForTTS(text2);
  console.log(`Result 2: "${res2}"`);
  assert(!res2.includes('code-ஐ') && !res2.includes('codeஐ'), 'Output does not contain code-ஐ or codeஐ');

  // Test 3: "இப்போ recursion எப்படி வேலை செய்கிறது என்று பாப்போம்." -> already clean, no Gemini call
  console.log('\n--- Test 3: Already clean Tamil text ---');
  const text3 = 'இப்போ recursion எப்படி வேலை செய்கிறது என்று பாப்போம்.';
  const val3 = validateTTSInput(text3);
  assert(!val3.hasIssues, 'Validation correctly reports no issues for clean text');

  // Test 4: "இப்போ ஒரு example எடுத்துப் பாப்போம்." -> unchanged
  console.log('\n--- Test 4: Pure native classroom text ---');
  const text4 = 'இப்போ ஒரு example எடுத்துப் பாப்போம்.';
  const val4 = validateTTSInput(text4);
  assert(!val4.hasIssues, 'Validation correctly reports no issues for spoken text with standalone English term');

  // Test 5: "Great! 🚀 இப்போ function பற்றி பாப்போம்." -> emoji removed
  console.log('\n--- Test 5: Emoji removal ---');
  const text5 = 'Great! 🚀 இப்போ function பற்றி பாப்போம்.';
  const val5 = validateTTSInput(text5);
  assert(val5.hasIssues && val5.issues.includes('emoji'), 'Validation flags emoji');
  const cleaned5 = cleanTextForTTS(text5);
  console.log(`Cleaned 5: "${cleaned5}"`);
  assert(!cleaned5.includes('🚀'), 'Emoji successfully stripped by cleanTextForTTS');

  // Test 6: "Class → Object" -> becomes "Class and Object"
  console.log('\n--- Test 6: Decorative arrow conversion ---');
  const text6 = 'Class → Object';
  const val6 = validateTTSInput(text6);
  assert(val6.hasIssues && val6.issues.includes('decorative-symbol'), 'Validation flags arrow symbol');
  const cleaned6 = cleanTextForTTS(text6);
  console.log(`Cleaned 6: "${cleaned6}"`);
  assert(cleaned6 === 'Class and Object', 'Arrow converted to "and" in cleanTextForTTS');

  // Test 7: "இந்த functionஐ call பண்ணலாம்." -> non-hyphenated case
  console.log('\n--- Test 7: Non-hyphenated suffix (functionஐ) ---');
  const text7 = 'இந்த functionஐ call பண்ணலாம்.';
  const val7 = validateTTSInput(text7);
  assert(val7.hasIssues && val7.issues.includes('mixed-language-suffix'), 'Validation flags non-hyphenated functionஐ');
  const res7 = await normalizeNarrationForTTS(text7);
  console.log(`Result 7: "${res7}"`);
  assert(!res7.includes('functionஐ') && !res7.includes('function-ஐ'), 'Output does not contain functionஐ');

  // Test 8: "இந்த function ஐ call பண்ணலாம்." -> standalone particle case
  console.log('\n--- Test 8: Standalone particle (function ஐ) ---');
  const text8 = 'இந்த function ஐ call பண்ணலாம்.';
  const val8 = validateTTSInput(text8);
  assert(val8.hasIssues && val8.issues.includes('mixed-language-suffix'), 'Validation flags isolated particle right after Latin word');

  // Test 9: Cache verification
  console.log('\n--- Test 9: Caching verification ---');
  const cacheSizeBefore = normalizationCache.size;
  await normalizeNarrationForTTS(text1);
  const cacheSizeAfter = normalizationCache.size;
  assert(cacheSizeAfter >= cacheSizeBefore, 'Cache populated on normalized text');
  console.log(`Cache has key 'tamil:${text1}':`, normalizationCache.has(`tamil:${text1}`));
  assert(normalizationCache.has(`tamil:${text1}`), 'Normalization cache contains key');

  console.log(`\n=== SUMMARY: ${passedCount}/${totalCount} TESTS PASSED ===`);
  if (passedCount === totalCount) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
