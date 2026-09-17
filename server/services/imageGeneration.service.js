/**
 * imageGeneration.service.js
 *
 * Dedicated image generation service for Real-World Visual Scenarios.
 * Provides multi-tiered resilient generation:
 * 1. Google Gemini / Imagen (if active and quota available)
 * 2. Pollinations AI generator (free, zero-quota-limit, fast educational illustration)
 * 3. Graceful fallback (never throws or interrupts video pipeline)
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

class ImageGenerationService {
  /**
   * Generates or retrieves an educational scenario image based on the prompt.
   *
   * @param {string} prompt - Detailed educational image prompt from Gemini
   * @param {string} outputPath - Destination file path (.jpg or .png)
   * @returns {Promise<{ success: boolean, imagePath?: string, error?: string }>}
   */
  async generateScenarioImage(prompt, outputPath) {
    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      return { success: false, error: 'Empty prompt provided' };
    }

    // Ensure output directory exists
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    console.log(`[ImageGen] Generating real-world scenario image...`);
    console.log(`[ImageGen] Prompt: "${prompt.substring(0, 100)}..."`);

    // Clean and optimize prompt for educational whiteboard visuals
    const cleanPrompt = this._optimizePrompt(prompt);

    // Tier 1: Try Gemini Imagen API if configured
    try {
      const geminiResult = await this._tryGeminiImageGen(cleanPrompt, outputPath);
      if (geminiResult && fs.existsSync(outputPath) && fs.statSync(outputPath).size > 1000) {
        console.log(`[ImageGen] ✓ Successfully generated via Gemini image model`);
        return { success: true, imagePath: outputPath };
      }
    } catch (e) {
      console.warn(`[ImageGen] Gemini image generation unavailable: ${e.message}. Trying Pollinations AI tier...`);
    }

    // Tier 2: High-availability Pollinations AI generator
    try {
      const pollResult = await this._fetchFromPollinations(cleanPrompt, outputPath);
      if (pollResult && fs.existsSync(outputPath) && fs.statSync(outputPath).size > 1000) {
        console.log(`[ImageGen] ✓ Successfully generated via Pollinations AI (${fs.statSync(outputPath).size} bytes)`);
        return { success: true, imagePath: outputPath };
      }
    } catch (e) {
      console.warn(`[ImageGen] Pollinations AI generation failed: ${e.message}`);
    }

    // Tier 3: Return graceful failure so video generation continues without interruption
    console.warn(`[ImageGen] Could not generate real-world image. Gracefully continuing without image.`);
    return { success: false, error: 'All image generation providers exhausted' };
  }

  /**
   * Builds the final image prompt using the user-defined educational infographic template.
   * The [TOPIC] placeholder is replaced with the actual concept prompt from the script engine.
   * This prompt focuses on VISUAL EXPLANATION — real-world analogy, minimal text, flexible layout.
   */
  _optimizePrompt(prompt) {
    const topic = prompt.trim();

    return `Create an educational programming concept infographic for [${topic}].

The main goal is to EXPLAIN and VISUALIZE the programming concept, not simply display text or code.

Think of a simple real-world analogy that a beginner can immediately understand.

Show the relationship, process, or behavior of the programming concept using:
- Real-world objects or situations
- Simple visual illustrations
- Arrows, connections, flow, grouping, or comparisons where appropriate
- Very short labels
- Minimal text
- A small amount of relevant code only when it helps explain the concept

The image should make the concept understandable even before reading the labels.

Do NOT force the image into a fixed layout.
Do NOT copy a particular infographic design.
Choose the visual structure that best represents the concept.

Use a clean, modern educational illustration style:
- White or very light background
- Professional vector illustrations
- Soft colors
- Clear labels
- Simple shapes
- Good spacing
- Beginner-friendly
- 16:9 presentation format

Focus primarily on VISUAL EXPLANATION rather than decoration.`;
  }

  /**
   * Attempts generation using Google Gemini / Imagen.
   */
  async _tryGeminiImageGen(prompt, outputPath) {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!apiKey || !apiKey.trim()) return null;

    try {
      const { GoogleGenAI } = require('@google/genai');
      const clientConfig = { apiKey: apiKey.trim() };

      if (process.env.GOOGLE_CLOUD_PROJECT) {
        clientConfig.vertexai = true;
        clientConfig.project = process.env.GOOGLE_CLOUD_PROJECT;
        clientConfig.location = process.env.GOOGLE_CLOUD_LOCATION || 'asia-south1';
      }

      const ai = new GoogleGenAI(clientConfig);

      const response = await ai.models.generateImages({
        model: 'imagen-3.0-generate-002',
        prompt: prompt,
        config: {
          numberOfImages: 1,
          outputMimeType: 'image/jpeg',
          aspectRatio: '16:9',
        },
      });

      const base64Data = response.generatedImages?.[0]?.image?.imageBytes;
      if (base64Data) {
        const buffer = Buffer.from(base64Data, 'base64');
        fs.writeFileSync(outputPath, buffer);
        return true;
      }
    } catch (err) {
      console.warn(`[ImageGen] Gemini Imagen 3 error: ${err.message}`);
      throw err;
    }
    return null;
  }

  /**
   * Fetches an AI-generated image from Pollinations.ai with streaming buffer handling.
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

  _saveResponseToPath(res, outputPath, resolve, reject) {
    const chunks = [];
    res.on('data', (chunk) => chunks.push(chunk));
    res.on('end', () => {
      const buffer = Buffer.concat(chunks);
      if (buffer.length < 500) {
        return reject(new Error('Downloaded image buffer too small (<500 bytes)'));
      }
      fs.writeFileSync(outputPath, buffer);
      resolve(true);
    });
    res.on('error', reject);
  }
}

module.exports = new ImageGenerationService();
