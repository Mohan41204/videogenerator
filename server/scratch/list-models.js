const { GoogleGenAI } = require('@google/genai');
require('dotenv').config({ path: require('path').join(__dirname, '../../../.env') });

const run = async () => {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  console.log('Listing models...');
  const response = await ai.models.list();
  for await (const model of response) {
    if (model.name.includes('flash') || model.name.includes('gemini')) {
      console.log(model.name);
    }
  }
};

run().catch(console.error);
