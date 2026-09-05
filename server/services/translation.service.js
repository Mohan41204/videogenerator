const { GoogleGenAI } = require('@google/genai');

const translateText = async (text, targetLanguageName) => {
  if (!text || text.trim() === '') return text;
  
  // Do not translate if it's already English (which is the source)
  if (targetLanguageName.toLowerCase() === 'english') {
    return text;
  }

  const clientConfig = {};
  if (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY) {
    clientConfig.apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  } else {
    clientConfig.vertexai = process.env.GOOGLE_GENAI_USE_VERTEXAI === 'true';
    clientConfig.project = process.env.GOOGLE_CLOUD_PROJECT;
    clientConfig.location = process.env.GOOGLE_CLOUD_LOCATION || 'global';
  }
  const client = new GoogleGenAI(clientConfig);
  
  let styleInstruction = `Convert the English educational narration into natural conversational speech for ${targetLanguageName}.`;

  const prompt = `
You are an Indian classroom teacher.

${styleInstruction}

CRITICAL REQUIREMENT:
ALWAYS use the native Unicode script of the target language.
NEVER use Romanized, transliterated, or mixed-script versions of the target language.

For Tamil:
"idhuku" is WRONG.
"இதற்கு" is CORRECT.

For Hindi:
"kyun" is WRONG.
"क्यों" is CORRECT.

For Telugu:
"enduku" is WRONG.
"ఎందుకు" is CORRECT.

For Kannada:
"yaake" is WRONG.
"ಯಾಕೆ" is CORRECT.

For Malayalam:
"enthinu" is WRONG.
"എന്തിന്" is CORRECT.

Rules:
1. Output natural conversational Indian language suitable for an AI classroom teacher.
2. Ensure it is easy for students to understand and natural for Text-to-Speech.
3. The normal conversational words must be written in the target language's native Unicode script.
4. Keep technical terminology in English when appropriate (e.g., AWS S3, EC2, Lambda, React, Node.js, JavaScript, Python, Docker, API, OOP, Arrays, Functions, Variables).
5. Do not translate programming code, AWS commands, URLs, filenames, package names, variable names, or API names.
6. Make it sound like a teacher talking directly to students, but DO NOT use overly formal or literary language.
7. Do NOT add any extra markdown formatting, quotes, or notes to your response. Just return the raw translated text.

Narration to translate:
"${text}"
  `.trim();

  const runModelWithRetry = async (modelName) => {
    let attempts = 0;
    const maxAttempts = 3;
    let delay = 1000;

    while (attempts < maxAttempts) {
      try {
        const result = await client.models.generateContent({
          model: modelName,
          contents: prompt,
        });
        if (result.usageMetadata) {
          console.log(`[Token Usage] Provider: vertex-ai, Model: ${modelName}, Input Tokens: ${result.usageMetadata.promptTokenCount}, Output Tokens: ${result.usageMetadata.candidatesTokenCount}, Total Tokens: ${result.usageMetadata.totalTokenCount}, Timestamp: ${new Date().toISOString()}`);
        }
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
        result = await runModelWithRetry('gemini-3.7-flash');
      } catch (error) {
        console.warn('gemini-3.7-flash failed for translation. Falling back to gemini-2.5-flash...');
        result = await runModelWithRetry('gemini-2.5-flash');
      }
      translatedText = result.text?.trim() || '';
    } catch (geminiError) {
      console.error('All Gemini translation attempts failed:', geminiError.message);
      throw new Error('All Gemini API translation attempts failed.');
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
    return slides;
  }

  const clientConfig = {};
  if (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY) {
    clientConfig.apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  } else {
    clientConfig.vertexai = process.env.GOOGLE_GENAI_USE_VERTEXAI === 'true';
    clientConfig.project = process.env.GOOGLE_CLOUD_PROJECT;
    clientConfig.location = process.env.GOOGLE_CLOUD_LOCATION || 'global';
  }
  const client = new GoogleGenAI(clientConfig);
  
  const prompt = `
You are an expert technical translator. Translate the human-readable content of this educational slide array into ${targetLanguageName}.

CRITICAL REQUIREMENTS:
- Translate human-readable fields: heading, subheading, bullets, narration, title, description, buttonText, labels, etc.
- ALWAYS use the native Unicode script of the target language.
- NEVER use Romanized, transliterated, or mixed-script versions of the target language (e.g., NO Tanglish, NO Hinglish).
- For Tamil: "idhuku" is WRONG, "இதற்கு" is CORRECT.
- For Hindi: "kyun" is WRONG, "क्यों" is CORRECT.
- For Telugu: "enduku" is WRONG, "ఎందుకు" is CORRECT.
- For Kannada: "yaake" is WRONG, "ಯಾಕೆ" is CORRECT.
- For Malayalam: "enthinu" is WRONG, "എന്തിന്" is CORRECT.
- Preserve technical terminology strictly in English (e.g., AWS S3, EC2, Lambda, React, Node.js, JavaScript, Python, npm, Docker, OOPs, Arrays). Do NOT translate these words.
- NEVER translate executable code. If isCode is true, the code in bullets MUST remain completely unchanged.
- NEVER modify URLs, commands, file paths, package names or identifiers.
- Preserve JSON structure EXACTLY. Return an array of objects with the same structure, just translated text.
- Do not add or remove slide fields.
- Keep the exact meaning and tone accurate.
- Keep narration and visible instructions semantically consistent.

Slides JSON to translate:
${JSON.stringify(slides, null, 2)}
  `.trim();

  const runModelWithRetry = async (modelName) => {
    let attempts = 0;
    const maxAttempts = 3;
    let delay = 1000;

    while (attempts < maxAttempts) {
      try {
        const result = await client.models.generateContent({
          model: modelName,
          contents: prompt,
          config: { responseMimeType: "application/json" }
        });
        if (result.usageMetadata) {
          console.log(`[Token Usage] Provider: vertex-ai, Model: ${modelName}, Input Tokens: ${result.usageMetadata.promptTokenCount}, Output Tokens: ${result.usageMetadata.candidatesTokenCount}, Total Tokens: ${result.usageMetadata.totalTokenCount}, Timestamp: ${new Date().toISOString()}`);
        }
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
        result = await runModelWithRetry('gemini-3.7-flash');
      } catch (error) {
        console.warn('gemini-3.7-flash failed for slide translation. Falling back to gemini-2.5-flash...');
        result = await runModelWithRetry('gemini-2.5-flash');
      }
      translatedJsonText = result.text?.trim() || '';
    } catch (geminiError) {
      console.error('All Gemini slide translation attempts failed:', geminiError.message);
      throw new Error('All Gemini API slide translation attempts failed.');
    }
    
    // Clean JSON response if wrapped in markdown and remove trailing commas
    let cleanedText = translatedJsonText.replace(/^\`\`\`json\s*/gi, '').replace(/\s*\`\`\`$/gi, '');
    
    // Fix trailing commas before closing braces/brackets (common LLM JSON error)
    cleanedText = cleanedText.replace(/,\s*([}\]])/g, '$1');
    
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
