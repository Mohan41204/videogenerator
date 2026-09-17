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
   * Appends quality and educational infographic directives for image generation.
   * Ensures the prompt produces professional educational infographics with
   * diagrams, arrows, labels, and visual structure — not generic photographs.
   */
  _optimizePrompt(prompt) {
    let p = prompt.trim();
    // Educational infographic quality directives
    const infographicDirectives = 'Professional educational infographic style, clean 16:9 presentation layout, white or very light background, strong visual hierarchy, clean vector-style diagrams, rounded cards and panels, professional typography, soft coordinated colors, labeled boxes for concepts, directional arrows showing relationships and flow, concise readable text labels on important elements, polished realistic illustrations for real-world objects, balanced composition, consistent illustration style, high-resolution sharp graphics, presentation-slide quality. Avoid: generic stock photography, generic topic illustrations, decorative AI artwork, abstract concept art, photo collages, product advertisements, cinematic scenes, unrelated objects, random objects, excessive icons, floating random symbols, meaningless arrows, random labels, excessive text, long paragraphs, confusing layouts, visual clutter, futuristic fantasy elements, unnecessary glowing effects, overly artistic compositions, irrelevant background elements, watermarks, logos, signatures.';
    
    if (!p.toLowerCase().includes('infographic')) {
      p += `. ${infographicDirectives}`;
    }
    return p;
  }

  /**
   * Attempts generation using Google Gemini / Imagen.
   */
  async _tryGeminiImageGen(prompt, outputPath) {
    if (!process.env.GOOGLE_CLOUD_PROJECT) return null;
    
    try {
      const { GoogleGenAI } = require('@google/genai');
      const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
      const clientConfig = {};
      if (apiKey && apiKey.trim()) {
        clientConfig.apiKey = apiKey.trim();
      } else {
        clientConfig.vertexai = true;
        clientConfig.project = process.env.GOOGLE_CLOUD_PROJECT || 'sky-meet-01';
        clientConfig.location = process.env.GOOGLE_CLOUD_LOCATION || 'asia-south1';
      }
      const ai = new GoogleGenAI(clientConfig);
      
      const response = await ai.models.generateContent({
        model: 'imagen-3.0-generate-002',
        contents: prompt,
      });

      const parts = response.candidates?.[0]?.content?.parts;
      if (parts && parts.length > 0) {
        for (const part of parts) {
          if (part.inlineData && part.inlineData.data) {
            const buffer = Buffer.from(part.inlineData.data, 'base64');
            fs.writeFileSync(outputPath, buffer);
            return true;
          }
        }
      }
    } catch (err) {
      // Pass error to fallback (Tier 2: Pollinations AI)
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
