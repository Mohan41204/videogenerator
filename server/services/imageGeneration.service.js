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
   * Wraps the prompt to ensure the image model generates a complete educational teaching visual
   * as ONE composed image from the beginning, using recognizable real-world objects intentionally arranged for teaching.
   */
  _optimizePrompt(prompt) {
    let p = prompt.trim();

    const prefix = [
      'You are creating a professional educational teaching visual, not a photograph.',
      'Design the complete composition before rendering it. The entire image must be one coherent teaching aid.',
      'Use realistic recognizable real-world objects as the main visual elements, but arrange those objects intentionally to explain the educational concept.',
      'Integrate the real-world objects, conceptual structure, headings, concise labels, property information, relationships, arrows, and callouts into one unified composition on a clean light educational canvas.',
      'Do not create a realistic background photograph and place annotations on top of it. Do not create an annotated photograph.',
      'The student should understand the concept by looking at the complete image.',
      'Use a professional classroom presentation or educational infographic composition with clear visual hierarchy, concise text, and meaningful arrows.',
      'Prioritize teaching clarity over photographic realism. 16:9 widescreen layout.'
    ].join(' ');

    const negativeInstructions = [
      'NEGATIVE INSTRUCTIONS: Do not generate a normal photograph. Do not generate a photo-first composition.',
      'Do not create a large realistic background and overlay labels. Do not create a warehouse scene with annotations.',
      'Do not create an office photograph with annotations. Do not create a street photograph with annotations.',
      'Do not make the background dominate the image. Do not use tiny objects surrounded by large empty scenery.',
      'Do not use random objects. Do not use decorative annotations. Do not use meaningless arrows.',
      'Do not use excessive text or long paragraphs. Do not create abstract AI artwork or sci-fi graphics.',
      'Do not create futuristic fantasy objects. Do not create a generic stock photograph.'
    ].join(' ');

    return `${prefix} TOPIC SCENARIO VISUAL SPECIFICATION: ${p} ${negativeInstructions}`;
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
