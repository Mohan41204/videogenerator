const { GoogleGenerativeAI } = require('@google/generative-ai');

const translateText = async (text, targetLanguageName) => {
  if (!text || text.trim() === '') return text;
  
  // Do not translate if it's already English (which is the source)
  if (targetLanguageName.toLowerCase() === 'english') {
    return text;
  }

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  
  let styleInstruction = `Convert the English educational narration into natural conversational speech for ${targetLanguageName}.`;
  const lowerLang = targetLanguageName.toLowerCase();
  if (lowerLang === 'tamil') {
    styleInstruction = `Convert the English educational narration into natural conversational Tanglish.`;
  } else if (lowerLang === 'hindi') {
    styleInstruction = `Convert the English educational narration into natural conversational Hinglish.`;
  } else if (lowerLang === 'telugu') {
    styleInstruction = `Convert the English educational narration into natural conversational Tenglish.`;
  } else if (lowerLang === 'malayalam') {
    styleInstruction = `Convert the English educational narration into natural conversational Manglish.`;
  } else if (lowerLang === 'kannada') {
    styleInstruction = `Convert the English educational narration into natural conversational Kanglish.`;
  }

  const prompt = `
You are an Indian classroom teacher.

${styleInstruction}

Do NOT translate word-for-word.

Rules:
1. Preserve the original educational meaning.
2. Use natural Indian classroom speech.
3. Keep technical terminology in English when appropriate.
4. Use the target language naturally around technical terms.
5. Do not use formal literary language.
6. Do not create unnatural machine translation.
7. Do not translate programming code.
8. Do not translate AWS commands.
9. Do not translate URLs.
10. Do not translate filenames.
11. Do not translate API names.
12. Do not change variable/function names.
13. Keep technical accuracy.
14. Keep narration concise enough for the slide duration.
15. Do not introduce unrelated information.
16. Make it sound like a teacher talking directly to students.
17. Use natural transitions.
18. Avoid repetitive phrases.
19. Do NOT add any extra markdown formatting, quotes, or notes to your response. Just return the raw translated text.

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
      console.warn('Primary Gemini translation attempts failed. Falling back to gemini-1.5-pro...', geminiError.message);
      try {
        const result = await runModelWithRetry('gemini-1.5-pro');
        const response = await result.response;
        translatedText = response.text().trim();
      } catch (proError) {
        throw new Error('All Gemini API translation attempts (including pro fallback) failed.');
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

const translateSlides = async (slides, targetLanguageName) => {
  if (!slides || !slides.length) return slides;
  
  if (targetLanguageName.toLowerCase() === 'english') {
    return slides; // Deep clone if strictly necessary, but returning slides is fine if not mutated further
  }

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  
  const prompt = `
You are an expert technical translator. Translate the human-readable content of this educational slide array into ${targetLanguageName}.

CRITICAL REQUIREMENTS:
- Translate human-readable fields: heading, subheading, bullets, narration, title, description, buttonText, labels, etc.
- Preserve technical terminology in English where appropriate (e.g., AWS S3, EC2, Lambda, React, Node.js, JavaScript, Python, npm, Docker, OOPs, Arrays). Do NOT translate these words.
- NEVER translate executable code. If isCode is true, the code in bullets MUST remain completely unchanged.
- NEVER modify URLs, commands, file paths, package names or identifiers.
- Preserve JSON structure EXACTLY. Return an array of objects with the same structure, just translated text.
- Do not add or remove slide fields.
- Keep the exact meaning and tone accurate.
- Keep narration and visible instructions semantically consistent.
- For Tamil, use a natural Tamil/Tanglish classroom style where appropriate.

Slides JSON to translate:
${JSON.stringify(slides, null, 2)}
  `.trim();

  const runModelWithRetry = async (modelName) => {
    const model = genAI.getGenerativeModel({ 
      model: modelName,
      generationConfig: { responseMimeType: "application/json" }
    });
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
        console.warn(`Slide translation attempt ${attempts} with ${modelName} failed. Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2;
      }
    }
  };

  try {
    let translatedJsonText;
    try {
      let result;
      try {
        result = await runModelWithRetry('gemini-2.5-flash');
      } catch (error) {
        console.warn('gemini-2.5-flash failed for slide translation. Falling back to gemini-flash-latest...');
        result = await runModelWithRetry('gemini-flash-latest');
      }
      const response = await result.response;
      translatedJsonText = response.text().trim();
    } catch (geminiError) {
      console.warn('Primary Gemini slide translation attempts failed. Falling back to gemini-1.5-pro...', geminiError.message);
      try {
        const result = await runModelWithRetry('gemini-1.5-pro');
        const response = await result.response;
        translatedJsonText = response.text().trim();
      } catch (proError) {
        throw new Error('All Gemini API slide translation attempts (including pro fallback) failed.');
      }
    }
    
    // Clean JSON response if wrapped in markdown
    const cleanedText = translatedJsonText.replace(/^\`\`\`json\s*/gi, '').replace(/\s*\`\`\`$/gi, '');
    const translatedSlides = JSON.parse(cleanedText);
    
    return translatedSlides;
  } catch (error) {
    console.error(`Slide translation to ${targetLanguageName} failed:`, error);
    throw error;
  }
};

module.exports = {
  translateText,
  translateSlides
};
