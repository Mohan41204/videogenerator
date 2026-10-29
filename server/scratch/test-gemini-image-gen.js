const { GoogleGenAI } = require('@google/genai');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function testGen() {
  const clientConfig = {
    vertexai: true,
    project: process.env.GOOGLE_CLOUD_PROJECT || 'sky-meet-01',
    location: process.env.GOOGLE_CLOUD_LOCATION || 'us-central1',
  };

  const ai = new GoogleGenAI(clientConfig);
  console.log('Generating image with gemini-2.5-flash-image...');

  const res = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: [{ role: 'user', parts: [{ text: 'Create an educational diagram of an if statement with a traffic light on a white background with 16:9 ratio.' }] }],
    config: {
      responseModalities: ['IMAGE']
    }
  });

  console.log('Candidates count:', res.candidates?.length);
  for (const c of res.candidates || []) {
    for (const p of c.content?.parts || []) {
      if (p.inlineData) {
        console.log('Found inlineData! mimeType:', p.inlineData.mimeType, 'data length:', p.inlineData.data?.length);
        const buf = Buffer.from(p.inlineData.data, 'base64');
        const testFile = path.join(__dirname, 'test_output.png');
        fs.writeFileSync(testFile, buf);
        console.log('Saved test image to:', testFile, 'bytes:', buf.length);
      }
    }
  }
}

testGen().catch(console.error);
