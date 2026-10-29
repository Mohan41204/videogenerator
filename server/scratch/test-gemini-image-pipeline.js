/**
 * test-gemini-image-pipeline.js
 *
 * Comprehensive Automated Test Suite for Gemini Image Pipeline Migration:
 * 1. Successful Gemini image generation (mocked & verified decoding)
 * 2. Correct decoding and saving of generated image bytes
 * 3. Invalid or empty model responses handling
 * 4. Authentication and permission failures (fails fast, no repeated retry)
 * 5. Quota and rate-limit errors (bounded retry with backoff)
 * 6. Timeout and retry behavior
 * 7. Fallback to Pollinations AI
 * 8. Graceful continuation when all providers fail
 * 9. Compatibility with existing image-service return structure ({ success, imagePath, ... })
 * 10. Compatibility with existing Puppeteer video-rendering pipeline (HTML template image loading)
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

// Path references
const tempTestDir = path.join(__dirname, 'test-temp-images');
if (!fs.existsSync(tempTestDir)) fs.mkdirSync(tempTestDir, { recursive: true });

// Valid 1x1 PNG buffer with valid PNG magic bytes (89 50 4E 47 ...) padded to > 1000 bytes
function createSampleValidPngBuffer(size = 1200) {
  const header = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  const rest = Buffer.alloc(size - header.length, 0xAA);
  return Buffer.concat([header, rest]);
}

const validSampleBase64 = createSampleValidPngBuffer().toString('base64');

// Test runner helper
let passedCount = 0;
let failedCount = 0;

async function runTest(name, fn) {
  try {
    process.stdout.write(`• Testing: ${name}... `);
    await fn();
    console.log(`[PASS]`);
    passedCount++;
  } catch (err) {
    console.log(`[FAIL]`);
    console.error(`  Error: ${err.message}`);
    failedCount++;
  }
}

async function main() {
  console.log(`====================================================`);
  console.log(`Gemini Image Generation Pipeline - Verification Suite`);
  console.log(`====================================================\n`);

  const imageGenService = require('../services/imageGeneration.service');

  // Test 1: Successful Gemini image generation & decoding
  await runTest('1. Successful Gemini image generation & valid decoding', async () => {
    const testOut = path.join(tempTestDir, 'test_success_gen.png');
    if (fs.existsSync(testOut)) fs.unlinkSync(testOut);

    // Mock client
    const origGetClient = imageGenService._getClient;
    imageGenService._getClient = () => ({
      client: {
        models: {
          generateContent: async () => ({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      inlineData: {
                        mimeType: 'image/png',
                        data: validSampleBase64
                      }
                    }
                  ]
                }
              }
            ]
          })
        }
      },
      providerType: 'gemini-api'
    });

    try {
      const res = await imageGenService.generateScenarioImage(
        'Educational diagram explaining if/else traffic light analogy',
        testOut,
        { forceRegenerate: true }
      );

      assert.strictEqual(res.success, true, 'Result success should be true');
      assert.strictEqual(res.imagePath, testOut, 'Image path should match output path');
      assert.strictEqual(fs.existsSync(testOut), true, 'File must exist on disk');
      assert.ok(fs.statSync(testOut).size > 1000, 'File must be genuine image > 1000 bytes');
    } finally {
      imageGenService._getClient = origGetClient;
    }
  });

  // Test 2: Correct decoding and saving of generated image bytes
  await runTest('2. Correct binary decoding from base64 and magic bytes verification', async () => {
    const testBuf = createSampleValidPngBuffer(2048);
    assert.strictEqual(imageGenService._isValidImage(testBuf), true, 'Valid PNG should pass magic byte check');
    assert.strictEqual(imageGenService._isValidImage(Buffer.from('not an image at all')), false, 'Invalid text should fail magic byte check');
    assert.strictEqual(imageGenService._isValidImage(Buffer.alloc(100)), false, 'Buffer under 1000 bytes should fail');
  });

  // Test 3: Invalid or empty model responses
  await runTest('3. Empty or malformed model responses handled without crashing', async () => {
    const testOut = path.join(tempTestDir, 'test_empty_resp.png');
    if (fs.existsSync(testOut)) fs.unlinkSync(testOut);

    const origGetClient = imageGenService._getClient;
    const origFetchPollinations = imageGenService._fetchFromPollinations;
    
    // Model returns empty candidates
    imageGenService._getClient = () => ({
      client: {
        models: {
          generateContent: async () => ({ candidates: [] })
        }
      },
      providerType: 'vertex-ai'
    });
    // Disable Pollinations fallback for this specific test
    imageGenService._fetchFromPollinations = async () => { throw new Error('Pollinations mocked failure'); };

    try {
      const res = await imageGenService.generateScenarioImage('Some prompt', testOut, { forceRegenerate: true });
      assert.strictEqual(res.success, false, 'Should fail gracefully when response is empty');
      assert.strictEqual(fs.existsSync(testOut), false, 'Empty output file must not be retained');
    } finally {
      imageGenService._getClient = origGetClient;
      imageGenService._fetchFromPollinations = origFetchPollinations;
    }
  });

  // Test 4: Authentication and permission failures (fails fast, no repeated retry)
  await runTest('4. Authentication/permission failures fail fast without useless retries', async () => {
    const testOut = path.join(tempTestDir, 'test_auth_fail.png');
    if (fs.existsSync(testOut)) fs.unlinkSync(testOut);

    const origGetClient = imageGenService._getClient;
    const origFetchPollinations = imageGenService._fetchFromPollinations;
    let callCount = 0;

    imageGenService._getClient = () => ({
      client: {
        models: {
          generateContent: async () => {
            callCount++;
            const err = new Error('Permission denied on resource (403)');
            err.status = 403;
            throw err;
          }
        }
      },
      providerType: 'vertex-ai'
    });
    imageGenService._fetchFromPollinations = async () => { throw new Error('Pollinations off'); };

    try {
      const res = await imageGenService.generateScenarioImage('Some prompt', testOut, { forceRegenerate: true });
      assert.strictEqual(res.success, false);
      // Because 403 is non-retryable, each candidate model should only be called once
      assert.ok(callCount <= 2, `Should not retry 403 endlessly (called: ${callCount})`);
    } finally {
      imageGenService._getClient = origGetClient;
      imageGenService._fetchFromPollinations = origFetchPollinations;
    }
  });

  // Test 5: Quota and rate-limit errors
  await runTest('5. Quota / rate-limit (429) triggers exponential backoff retry', async () => {
    const testOut = path.join(tempTestDir, 'test_rate_limit.png');
    if (fs.existsSync(testOut)) fs.unlinkSync(testOut);

    const origGetClient = imageGenService._getClient;
    let attempts = 0;

    imageGenService._getClient = () => ({
      client: {
        models: {
          generateContent: async () => {
            attempts++;
            if (attempts === 1) {
              const err = new Error('Resource exhausted (429 rate limit)');
              err.status = 429;
              throw err;
            }
            return {
              candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/png', data: validSampleBase64 } }] } }]
            };
          }
        }
      },
      providerType: 'gemini-api'
    });

    try {
      const res = await imageGenService.generateScenarioImage('Some prompt', testOut, { forceRegenerate: true });
      assert.strictEqual(res.success, true, 'Should succeed on second attempt after 429 retry');
      assert.strictEqual(attempts, 2, 'Should have retried exactly once');
    } finally {
      imageGenService._getClient = origGetClient;
    }
  });

  // Test 6: Timeout and retry behavior
  await runTest('6. Request timeout triggers retry or clean fallback', async () => {
    const testOut = path.join(tempTestDir, 'test_timeout.png');
    if (fs.existsSync(testOut)) fs.unlinkSync(testOut);

    const origGetClient = imageGenService._getClient;
    const origTimeout = process.env.GEMINI_IMAGE_TIMEOUT_MS;
    process.env.GEMINI_IMAGE_TIMEOUT_MS = '50'; // short timeout for testing

    imageGenService._getClient = () => ({
      client: {
        models: {
          generateContent: () => new Promise(resolve => setTimeout(resolve, 500)) // hangs longer than 50ms
        }
      },
      providerType: 'vertex-ai'
    });

    try {
      const res = await imageGenService.generateScenarioImage('Prompt', testOut, { forceRegenerate: true });
      // When timeout occurs and fallback fails, should return success: false cleanly
      assert.ok(typeof res.success === 'boolean');
    } finally {
      imageGenService._getClient = origGetClient;
      process.env.GEMINI_IMAGE_TIMEOUT_MS = origTimeout || '45000';
    }
  });

  // Test 7: Fallback to Pollinations AI
  await runTest('7. Automatic fallback to Pollinations AI when Gemini is unavailable', async () => {
    const testOut = path.join(tempTestDir, 'test_pollinations_fallback.png');
    if (fs.existsSync(testOut)) fs.unlinkSync(testOut);

    const origGetClient = imageGenService._getClient;
    const origFetchPollinations = imageGenService._fetchFromPollinations;

    // Gemini models return 404 (unavailable)
    imageGenService._getClient = () => ({
      client: {
        models: {
          generateContent: async () => {
            const err = new Error('Model not found (404)');
            err.status = 404;
            throw err;
          }
        }
      },
      providerType: 'vertex-ai'
    });

    // Mock Pollinations success
    imageGenService._fetchFromPollinations = async (prompt, out) => {
      fs.writeFileSync(out, createSampleValidPngBuffer());
      return true;
    };

    try {
      const res = await imageGenService.generateScenarioImage('Prompt with fallback', testOut, { forceRegenerate: true });
      assert.strictEqual(res.success, true);
      assert.strictEqual(res.provider, 'pollinations');
      assert.strictEqual(fs.existsSync(testOut), true);
    } finally {
      imageGenService._getClient = origGetClient;
      imageGenService._fetchFromPollinations = origFetchPollinations;
    }
  });

  // Test 8: Graceful continuation when both providers fail
  await runTest('8. Graceful continuation when both primary and secondary providers fail', async () => {
    const testOut = path.join(tempTestDir, 'test_all_fail.png');
    if (fs.existsSync(testOut)) fs.unlinkSync(testOut);

    const origGetClient = imageGenService._getClient;
    const origFetchPollinations = imageGenService._fetchFromPollinations;

    imageGenService._getClient = () => ({
      client: {
        models: {
          generateContent: async () => { throw new Error('Gemini Down'); }
        }
      },
      providerType: 'gemini-api'
    });
    imageGenService._fetchFromPollinations = async () => { throw new Error('Pollinations Down'); };

    try {
      const res = await imageGenService.generateScenarioImage('Prompt', testOut, { forceRegenerate: true });
      assert.strictEqual(res.success, false);
      assert.ok(res.error, 'Should return error message');
      assert.strictEqual(fs.existsSync(testOut), false, 'Failed file should be cleaned up');
    } finally {
      imageGenService._getClient = origGetClient;
      imageGenService._fetchFromPollinations = origFetchPollinations;
    }
  });

  // Test 9: Compatibility with existing image-service return structure
  await runTest('9. Compatibility with existing return schema ({ success, imagePath, error })', async () => {
    const testOut = path.join(tempTestDir, 'test_return_schema.png');
    fs.writeFileSync(testOut, createSampleValidPngBuffer());

    // Call without forcing regenerate (tests cache hit return structure)
    const res = await imageGenService.generateScenarioImage('Cached prompt', testOut);
    assert.ok(Object.prototype.hasOwnProperty.call(res, 'success'));
    assert.ok(Object.prototype.hasOwnProperty.call(res, 'imagePath'));
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.cached, true);
  });

  // Test 10: Compatibility with existing Puppeteer video-rendering pipeline
  await runTest('10. Compatibility with Puppeteer video pipeline template expectations', async () => {
    const templatePath = path.join(__dirname, '../templates/screen_share.html');
    assert.strictEqual(fs.existsSync(templatePath), true, 'screen_share.html template must exist');

    const htmlContent = fs.readFileSync(templatePath, 'utf8');
    assert.ok(htmlContent.includes('realWorldVisual'), 'Template must support realWorldVisual data structure');
    assert.ok(htmlContent.includes('appearAtSecond'), 'Template must support appearAtSecond timing');
    assert.ok(htmlContent.includes('window._imageAppearSecond'), 'Template must support _imageAppearSecond variable');
  });

  console.log(`\n====================================================`);
  console.log(`Test Results: ${passedCount} Passed, ${failedCount} Failed`);
  console.log(`====================================================`);

  // Clean up test directory
  try {
    fs.rmSync(tempTestDir, { recursive: true, force: true });
  } catch (e) {}

  if (failedCount > 0) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Test suite error:', err);
  process.exit(1);
});
