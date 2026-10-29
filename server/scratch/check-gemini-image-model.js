const { GoogleGenAI } = require('@google/genai');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function check() {
  const clientConfig = {};
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  const useVertexAi = process.env.GOOGLE_GENAI_USE_VERTEXAI === 'true' || !apiKey;

  if (useVertexAi) {
    clientConfig.vertexai = true;
    clientConfig.project = process.env.GOOGLE_CLOUD_PROJECT || 'sky-meet-01';
    clientConfig.location = process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';
  } else {
    clientConfig.apiKey = apiKey.trim();
  }

  console.log('Client config:', { ...clientConfig, apiKey: clientConfig.apiKey ? '***' : undefined });
  const ai = new GoogleGenAI(clientConfig);

  console.log('Testing gemini-3.1-flash-image call...');
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-image',
      contents: [
        {
          role: 'user',
          parts: [{ text: 'A simple diagram of an if statement with a traffic light on a white background.' }]
        }
      ],
      config: {
        responseModalities: ['IMAGE']
      }
    });

    console.log('Success! Response candidates:', response.candidates?.length);
    for (const c of response.candidates || []) {
      for (const p of c.content?.parts || []) {
        console.log('Part keys:', Object.keys(p));
        if (p.inlineData) {
          console.log('Inline data mimeType:', p.inlineData.mimeType, 'length:', p.inlineData.data?.length);
        }
        if (p.text) console.log('Text:', p.text);
      }
    }
  } catch (err) {
    console.error('gemini-3.1-flash-image error:', err.message);
    if (err.status) console.error('Status:', err.status);
    if (err.errorDetails) console.error('Details:', err.errorDetails);
  }
}

check().catch(console.error);
