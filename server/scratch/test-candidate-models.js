const { GoogleGenAI } = require('@google/genai');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

function isValidImageBuffer(buffer) {
  if (!buffer || !Buffer.isBuffer(buffer) || buffer.length < 1000) return false;
  // Check PNG (89 50 4E 47), JPEG (FF D8 FF), WebP (RIFF....WEBP)
  const isPng = buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47;
  const isJpg = buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF;
  const isWebp = buffer.slice(0, 4).toString('ascii') === 'RIFF' && buffer.slice(8, 12).toString('ascii') === 'WEBP';
  return isPng || isJpg || isWebp;
}

async function testCandidateModels() {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  const useVertexAi = process.env.GOOGLE_GENAI_USE_VERTEXAI === 'true' || !apiKey;
  const clientConfig = {};

  if (useVertexAi) {
    clientConfig.vertexai = true;
    clientConfig.project = process.env.GOOGLE_CLOUD_PROJECT || 'sky-meet-01';
    clientConfig.location = process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';
  } else {
    clientConfig.apiKey = apiKey.trim();
  }

  const ai = new GoogleGenAI(clientConfig);
  const models = ['gemini-3.1-flash-image', 'gemini-2.5-flash-image'];

  for (const model of models) {
    console.log(`Attempting generation with model: ${model}...`);
    try {
      const response = await ai.models.generateContent({
        model,
        contents: [{ role: 'user', parts: [{ text: 'Clean educational diagram of if/else logic' }] }],
        config: {
          responseModalities: ['IMAGE']
        }
      });

      let found = false;
      for (const candidate of response.candidates || []) {
        for (const part of candidate.content?.parts || []) {
          if (part.inlineData?.data) {
            const buf = Buffer.from(part.inlineData.data, 'base64');
            const valid = isValidImageBuffer(buf);
            console.log(`[${model}] Valid image received! Bytes: ${buf.length}, Valid: ${valid}`);
            found = true;
            break;
          }
        }
        if (found) break;
      }
      if (found) return model;
    } catch (e) {
      console.log(`[${model}] Failed: ${e.message}`);
    }
  }
}

testCandidateModels().then(m => console.log('Selected working model:', m)).catch(console.error);
