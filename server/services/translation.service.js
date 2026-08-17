const { GoogleGenerativeAI } = require('@google/generative-ai');

const translateText = async (text, targetLanguageName) => {
  if (!text || text.trim() === '') return text;
  
  // Do not translate if it's already English (which is the source)
  if (targetLanguageName.toLowerCase() === 'english') {
    return text;
  }

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  
  const prompt = `
You are an expert technical translator. Translate the following teaching narration into ${targetLanguageName}.

CRITICAL REQUIREMENTS:
- Preserve all technical terminology in English where appropriate (e.g., AWS S3, EC2, Lambda, React, Node.js, JavaScript, Python, npm, Docker, OOPs, Arrays). Do NOT translate these words.
- Preserve all numbers, URLs, and code snippets exactly as they are.
- Preserve the exact teaching meaning and tone (friendly, encouraging).
- Do NOT add any extra markdown formatting, quotes, or notes to your response. Just return the raw translated text.
- If there are punctuation marks like periods, commas, or question marks, preserve them to help with audio pacing.

Narration to translate:
"${text}"
  `.trim();

  const runModelWithRetry = async (modelName) => {
    const model = genAI.getGenerativeModel({ model: modelName });
    let attempts = 0;
    const maxAttempts = 3;
    let delay = 1000;

    while (attempts < maxAttempts) {
      try {
        const result = await model.generateContent(prompt);
        return result;
      } catch (err) {
        attempts++;
        if (attempts >= maxAttempts) throw err;
        console.warn(`Translation attempt ${attempts} with ${modelName} failed. Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2;
      }
    }
  };

  try {
    let translatedText;
    try {
      let result;
      try {
        result = await runModelWithRetry('gemini-2.5-flash');
      } catch (error) {
        console.warn('gemini-2.5-flash failed for translation. Falling back to gemini-flash-latest...');
        result = await runModelWithRetry('gemini-flash-latest');
      }
      const response = await result.response;
      translatedText = response.text().trim();
    } catch (geminiError) {
      console.warn('All Gemini translation attempts failed. Falling back to Groq...', geminiError.message);
      if (process.env.GROQ_API_KEY) {
        const Groq = require('groq-sdk');
        const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
        const completion = await groq.chat.completions.create({
          messages: [{ role: "user", content: prompt }],
          model: "llama-3.1-8b-instant",
        });
        translatedText = completion.choices[0].message.content.trim();
      } else {
        throw new Error('Gemini API limit reached and no GROQ_API_KEY provided in .env for fallback.');
      }
    }
    
    // Clean any accidental quotes
    if (translatedText.startsWith('"') && translatedText.endsWith('"')) {
      translatedText = translatedText.slice(1, -1);
    }
    
    return translatedText;
  } catch (error) {
    console.error(`Translation to ${targetLanguageName} failed:`, error);
    throw error;
  }
};

module.exports = {
  translateText
};
