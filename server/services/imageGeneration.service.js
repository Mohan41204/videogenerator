/**
 * imageGeneration.service.js
 *
 * Dedicated image generation service for Real-World Visual Scenarios.
 * Primary Provider: Gemini 3.1 Flash Image (via official @google/genai SDK)
 * Secondary Provider: Gemini 2.5 Flash Image (Vertex AI / Gemini API fallback)
 * Tertiary Provider: Pollinations AI (high-availability fallback)
 * Final Recovery: Graceful degradation (never breaks or halts the video generation pipeline)
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { GoogleGenAI } = require('@google/genai');

class ImageGenerationService {
  constructor() {
    this._client = null;
    this._clientKey = null;
  }

  /**
   * Initializes or returns a cached @google/genai client instance.
   * Reuses existing Google Cloud Vertex AI credentials or Gemini API keys.
   *
   * @private
   * @returns {{ client: GoogleGenAI, providerType: string, project?: string, location?: string }}
   */
  _getClient() {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    const useVertexAi = process.env.GOOGLE_GENAI_USE_VERTEXAI === 'true' || !apiKey;
    const project = process.env.GOOGLE_CLOUD_PROJECT || 'sky-meet-01';
    const location = process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';

    const currentKey = useVertexAi ? `vertex:${project}:${location}` : `apikey:${apiKey ? apiKey.substring(0, 6) : 'none'}`;

    if (this._client && this._clientKey === currentKey) {
      return { client: this._client, providerType: useVertexAi ? 'vertex-ai' : 'gemini-api', project, location };
    }

    const clientConfig = {};
    if (useVertexAi) {
      clientConfig.vertexai = true;
      clientConfig.project = project;
      clientConfig.location = location;
    } else if (apiKey) {
      clientConfig.apiKey = apiKey.trim();
    }

    this._client = new GoogleGenAI(clientConfig);
    this._clientKey = currentKey;

    return { client: this._client, providerType: useVertexAi ? 'vertex-ai' : 'gemini-api', project, location };
  }

  /**
   * Generates or retrieves an educational scenario image based on the prompt.
   *
   * @param {string} prompt - Detailed educational image prompt from Gemini teaching engine
   * @param {string} outputPath - Destination file path (.jpg or .png)
   * @param {object} [options={}] - Additional generation options
   * @param {boolean} [options.forceRegenerate=false] - If true, bypasses existing disk cache
   * @returns {Promise<{ success: boolean, imagePath?: string, provider?: string, cached?: boolean, error?: string }>}
   */
  async generateScenarioImage(prompt, outputPath, options = {}) {
    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      return { success: false, error: 'Empty prompt provided' };
    }

    if (!outputPath || typeof outputPath !== 'string') {
      return { success: false, error: 'Invalid output path provided' };
    }

    // Cost-control & Deduplication: If a valid image already exists on disk, reuse it
    if (!options.forceRegenerate && fs.existsSync(outputPath)) {
      try {
        const stats = fs.statSync(outputPath);
        if (stats.size > 1000) {
          console.log(`[ImageGen] Reusing existing valid image at ${path.basename(outputPath)} (${stats.size} bytes)`);
          return { success: true, imagePath: outputPath, cached: true };
        }
      } catch (statErr) {
        // Continue to generate if file cannot be stat'd
      }
    }

    // Ensure destination directory exists
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    console.log(`[ImageGen] Generating real-world scenario image...`);
    console.log(`[ImageGen] Prompt: "${prompt.substring(0, 100)}..."`);

    // Optimize prompt for pedagogical whiteboard graphics with ample whitespace
    const cleanPrompt = this._optimizePrompt(prompt);

    // ─────────────────────────────────────────────────────────────────────────
    // TIER 1: Gemini Image Generation (Primary: gemini-3.1-flash-image)
    // ─────────────────────────────────────────────────────────────────────────
    const primaryModel = process.env.GEMINI_IMAGE_MODEL || 'gemini-3.1-flash-image';
    const rawFallbacks = process.env.GEMINI_IMAGE_FALLBACK_MODELS 
      ? process.env.GEMINI_IMAGE_FALLBACK_MODELS.split(',').map(m => m.trim()).filter(Boolean)
      : ['gemini-2.5-flash-image'];

    const candidateModels = [...new Set([primaryModel, ...rawFallbacks])];

    for (const modelName of candidateModels) {
      try {
        const geminiResult = await this._tryGeminiImageGen(cleanPrompt, outputPath, modelName);
        if (geminiResult && geminiResult.success && fs.existsSync(outputPath)) {
          const fileSize = fs.statSync(outputPath).size;
          if (fileSize > 1000) {
            console.log(`[ImageGen] ✓ Successfully generated via ${modelName} (${fileSize} bytes)`);
            return { success: true, imagePath: outputPath, provider: modelName };
          }
        }
      } catch (e) {
        console.warn(`[ImageGen] Model ${modelName} unavailable or failed: ${e.message}`);
        // If not the last Gemini model, loop will try the next fallback model
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // TIER 2: Pollinations AI Fallback (if enabled)
    // ─────────────────────────────────────────────────────────────────────────
    const enableFallback = process.env.ENABLE_IMAGE_FALLBACK !== 'false';
    if (enableFallback) {
      console.log(`[ImageGen] Attempting secondary fallback via Pollinations AI...`);
      try {
        const pollResult = await this._fetchFromPollinations(cleanPrompt, outputPath);
        if (pollResult && fs.existsSync(outputPath)) {
          const fileSize = fs.statSync(outputPath).size;
          if (fileSize > 1000) {
            console.log(`[ImageGen] ✓ Successfully generated via Pollinations AI (${fileSize} bytes)`);
            return { success: true, imagePath: outputPath, provider: 'pollinations' };
          }
        }
      } catch (pollErr) {
        console.warn(`[ImageGen] Pollinations AI generation failed: ${pollErr.message}`);
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // TIER 3: Final Recovery - Clean up partial files & gracefully degrade
    // ─────────────────────────────────────────────────────────────────────────
    this._cleanUpFailedFile(outputPath);
    console.warn(`[ImageGen] All image generation providers exhausted. Continuing video pipeline without optional image.`);
    return { success: false, error: 'All image generation providers exhausted' };
  }

  /**
   * Generates image using the official Google GenAI SDK (generateContent with responseModalities: ['IMAGE']).
   * Handles bounded retries for rate-limiting (429) or temporary server errors (503).
   *
   * @private
   * @param {string} prompt - Optimized prompt
   * @param {string} outputPath - Output file path
   * @param {string} modelName - Verified model ID (e.g. 'gemini-3.1-flash-image')
   * @returns {Promise<{ success: boolean, buffer?: Buffer }>}
   */
  async _tryGeminiImageGen(prompt, outputPath, modelName) {
    const { client, providerType } = this._getClient();
    const maxRetries = parseInt(process.env.GEMINI_IMAGE_MAX_RETRIES, 10) || 2;
    const timeoutMs = parseInt(process.env.GEMINI_IMAGE_TIMEOUT_MS, 10) || 45000;

    let lastError = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[ImageGen] Requesting image via ${modelName} [provider: ${providerType}] (Attempt ${attempt}/${maxRetries})...`);

        // Execute API call with a bounded timeout
        const generatePromise = client.models.generateContent({
          model: modelName,
          contents: [
            {
              role: 'user',
              parts: [{ text: prompt }]
            }
          ],
          config: {
            responseModalities: ['IMAGE']
          }
        });

        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error(`Image generation timed out after ${timeoutMs}ms`)), timeoutMs);
        });

        const response = await Promise.race([generatePromise, timeoutPromise]);

        // Extract and validate inline image bytes
        const imageBuffer = this._extractImageBufferFromResponse(response);
        if (!imageBuffer) {
          throw new Error(`Model response did not contain valid inline image bytes`);
        }

        // Validate genuine image magic bytes (PNG, JPEG, WebP)
        if (!this._isValidImage(imageBuffer)) {
          throw new Error(`Extracted buffer failed image header signature validation`);
        }

        // Write safely to destination
        fs.writeFileSync(outputPath, imageBuffer);
        return { success: true, buffer: imageBuffer };

      } catch (err) {
        lastError = err;
        const status = err.status || (err.message && err.message.match(/"code":\s*(\d+)/)?.[1]);
        const isRateLimit = status === 429 || /RESOURCE_EXHAUSTED|rate limit|quota/i.test(err.message);
        const isServerError = status >= 500 && status < 600;
        const isTimeout = /timed out/i.test(err.message);

        // Fail fast without retrying permanent client / config errors (400, 401, 403, 404)
        if (status === 404 || /NOT_FOUND|not found/i.test(err.message)) {
          console.warn(`[ImageGen] Model "${modelName}" not found or unsupported in current region/project (${err.message.substring(0, 120)}...)`);
          throw err;
        }

        if (status === 401 || status === 403 || /PERMISSION_DENIED|unauthorized|forbidden/i.test(err.message)) {
          console.warn(`[ImageGen] Permission/Auth error with model "${modelName}": ${err.message.substring(0, 120)}`);
          throw err;
        }

        if (status === 400 || /INVALID_ARGUMENT|invalid/i.test(err.message)) {
          console.warn(`[ImageGen] Invalid argument or rejected prompt for model "${modelName}": ${err.message.substring(0, 120)}`);
          throw err;
        }

        // Bounded exponential backoff for retryable errors
        if ((isRateLimit || isServerError || isTimeout) && attempt < maxRetries) {
          const backoffMs = Math.min(1000 * Math.pow(2, attempt) + Math.random() * 500, 8000);
          console.warn(`[ImageGen] Transient error (${err.message.substring(0, 80)}). Retrying in ${Math.round(backoffMs)}ms...`);
          await new Promise((r) => setTimeout(r, backoffMs));
          continue;
        }

        throw err;
      }
    }

    throw lastError || new Error(`Failed to generate image with ${modelName}`);
  }

  /**
   * Safely inspects the response object and extracts the image buffer.
   *
   * @private
   * @param {object} response - @google/genai response object
   * @returns {Buffer|null}
   */
  _extractImageBufferFromResponse(response) {
    if (!response || !response.candidates || !Array.isArray(response.candidates)) {
      return null;
    }

    for (const candidate of response.candidates) {
      const parts = candidate.content?.parts;
      if (!Array.isArray(parts)) continue;

      for (const part of parts) {
        // Primary format: inlineData with base64 encoded data
        if (part.inlineData && part.inlineData.data) {
          try {
            return Buffer.from(part.inlineData.data, 'base64');
          } catch (e) {
            console.warn('[ImageGen] Error decoding inlineData base64 string:', e.message);
          }
        }
      }
    }

    return null;
  }

  /**
   * Validates that buffer starts with valid PNG, JPEG, or WebP magic bytes
   * and meets minimum size requirements.
   *
   * @private
   * @param {Buffer} buffer - Decoded image buffer
   * @returns {boolean}
   */
  _isValidImage(buffer) {
    if (!buffer || !Buffer.isBuffer(buffer) || buffer.length < 1000) {
      return false;
    }

    // PNG: 89 50 4E 47 (0x89 'P' 'N' 'G')
    const isPng = buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47;

    // JPEG: FF D8 FF
    const isJpg = buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF;

    // WebP: 'RIFF' .... 'WEBP'
    const isWebp = buffer.slice(0, 4).toString('ascii') === 'RIFF' && buffer.slice(8, 12).toString('ascii') === 'WEBP';

    return isPng || isJpg || isWebp;
  }

  /**
   * Wraps the raw prompt with strict educational diagram specifications.
   * Ensures 16:9 widescreen composition, pastel cards, arrows, and ample whitespace
   * for animated dynamic callouts rendered downstream by screen_share.html.
   *
   * @private
   * @param {string} prompt - Raw prompt from teaching engine
   * @returns {string}
   */
  _optimizePrompt(prompt) {
    const cleanUserPrompt = prompt.trim();

    const compositionStyle = [
      'Create a clear, pedagogical concept diagram and visual analogy for an educational lesson.',
      'Format & Composition: 16:9 widescreen horizontal aspect ratio with a clean, solid, bright white background.',
      'Style: Modern digital whiteboard and classroom infographic vector illustration with soft pastel colored shapes and crisp dark lines.',
      'Framing: Ensure the diagram and illustration elements fill the frame prominently with minimal empty margins so details, icons, and text labels are large, clear, and easy to read.'
    ].join(' ');

    const pedagogicalRules = [
      'Pedagogy: Visually explain the concept through simple, recognizable real-world analogies (e.g. traffic lights for conditional branches, conveyor belts for loops, factory machines for functions, indexed post office boxes for arrays).',
      'Use bold dark directional arrows to show relationships, flows, or state transitions.',
      'Minimal text: Include only short, clear, essential concept labels.'
    ].join(' ');

    const negativeConstraints = [
      'Avoid: Do NOT create photographic collages, dark backgrounds, realistic human photos, abstract art, or watermarks.',
      'Do NOT render outer border boxes, picture frames, pre-baked callout bubbles, speech bubbles, browser chrome, or simulated UI frames.'
    ].join(' ');

    return `${compositionStyle} ${cleanUserPrompt} ${pedagogicalRules} ${negativeConstraints}`;
  }

  /**
   * Fetches an AI-generated image from Pollinations.ai with streaming buffer handling.
   *
   * @private
   * @param {string} prompt - Cleaned prompt
   * @param {string} outputPath - Destination file path
   * @returns {Promise<boolean>}
   */
  _fetchFromPollinations(prompt, outputPath) {
    return new Promise((resolve, reject) => {
      const seed = Math.floor(Math.random() * 100000);
      const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=960&height=540&nologo=true&seed=${seed}`;

      const client = url.startsWith('https') ? https : http;

      const request = client.get(url, { timeout: 25000 }, (res) => {
        // Handle HTTP redirects (301, 302, 307)
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return client.get(res.headers.location, { timeout: 25000 }, (redirectRes) => {
            this._saveResponseToPath(redirectRes, outputPath, resolve, reject);
          }).on('error', reject);
        }

        if (res.statusCode !== 200) {
          return reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
        }

        this._saveResponseToPath(res, outputPath, resolve, reject);
      });

      request.on('timeout', () => {
        request.destroy();
        reject(new Error('Pollinations request timed out after 25s'));
      });

      request.on('error', reject);
    });
  }

  /**
   * Writes the incoming stream to outputPath and verifies buffer size.
   *
   * @private
   */
  _saveResponseToPath(res, outputPath, resolve, reject) {
    const chunks = [];
    res.on('data', (chunk) => chunks.push(chunk));
    res.on('end', () => {
      const buffer = Buffer.concat(chunks);
      if (!this._isValidImage(buffer)) {
        return reject(new Error('Downloaded fallback image failed magic byte or size validation'));
      }
      fs.writeFileSync(outputPath, buffer);
      resolve(true);
    });
    res.on('error', reject);
  }

  /**
   * Cleans up empty or corrupted files on failure.
   *
   * @private
   */
  _cleanUpFailedFile(filePath) {
    try {
      if (fs.existsSync(filePath)) {
        const stats = fs.statSync(filePath);
        if (stats.size < 1000) {
          fs.unlinkSync(filePath);
        }
      }
    } catch (e) {
      // Ignore cleanup error
    }
  }
}

module.exports = new ImageGenerationService();
