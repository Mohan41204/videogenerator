const { GoogleGenAI } = require('@google/genai');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function list() {
  const clientConfig = {
    vertexai: true,
    project: process.env.GOOGLE_CLOUD_PROJECT || 'sky-meet-01',
    location: process.env.GOOGLE_CLOUD_LOCATION || 'us-central1',
  };

  const ai = new GoogleGenAI(clientConfig);
  console.log('Testing image generation models in Vertex AI...');

  const modelsToTest = [
    'gemini-3.1-flash-image',
    'gemini-3.1-flash-image-preview',
    'gemini-2.5-flash-image',
    'imagegeneration@006',
    'imagen-3.0-generate-002',
    'imagen-3.0-generate-001',
    'imagen-3.0-fast-generate-001'
  ];

  for (const m of modelsToTest) {
    try {
      if (m.startsWith('imagen') || m.startsWith('imagegeneration')) {
        const res = await ai.models.generateImages({
          model: m,
          prompt: 'test illustration',
          config: { numberOfImages: 1 }
        });
        console.log(`[SUCCESS] ${m} (generateImages)`);
      } else {
        const res = await ai.models.generateContent({
          model: m,
          contents: [{ role: 'user', parts: [{ text: 'test' }] }],
          config: { responseModalities: ['IMAGE'] }
        });
        console.log(`[SUCCESS] ${m} (generateContent)`);
      }
    } catch (e) {
      console.log(`[FAILED] ${m}: ${e.message?.substring(0, 150)}`);
    }
  }
}

list().catch(console.error);
