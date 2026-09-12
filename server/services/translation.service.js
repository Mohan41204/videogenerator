const { GoogleGenAI } = require('@google/genai');

const translateText = async (text, targetLanguageName) => {
  if (!text || text.trim() === '') return text;
  
  // Do not translate if it's already English (which is the source)
  if (targetLanguageName.toLowerCase() === 'english') {
    return text;
  }

  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  const clientConfig = {};
  if (apiKey && apiKey.trim()) {
    clientConfig.apiKey = apiKey.trim();
  } else {
    clientConfig.vertexai = true;
    clientConfig.project = process.env.GOOGLE_CLOUD_PROJECT || 'sky-meet-01';
    clientConfig.location = process.env.GOOGLE_CLOUD_LOCATION || 'asia-south1';
  }
  const client = new GoogleGenAI(clientConfig);
  
  let styleInstruction = `Convert the English educational narration into natural conversational speech for ${targetLanguageName}.`;

  const prompt = `
You are a professional Indian classroom teacher and TTS narration writer.

Your task is to translate the given English teaching narration into ${targetLanguageName}.

IMPORTANT: This is a SPOKEN CLASSROOM NARRATION, not a formal written translation.

The output must sound like a real Indian teacher naturally explaining a programming or technical topic to students.

### CORE REQUIREMENT

Use:
* Native Unicode script of the target language.
* Natural conversational/spoken grammar.
* Simple everyday classroom language.
* Friendly teacher-like expressions.
* English technical/programming terms where they are commonly used.
* Short, TTS-friendly sentences.
* Natural Indian classroom speaking style.

DO NOT use:
* Romanized language.
* Tanglish.
* Hinglish.
* Tenglish.
* Kanglish.
* Manglish.
* English sentences written using the target language script.
* Very formal textbook language.
* Literary language.
* Sanskritized or highly formal vocabulary.
* Word-by-word translation.
* Unnatural machine-translation style.

### VERY IMPORTANT

Do NOT confuse "native script" with "formal language".
The output must be written using the target language's Unicode script, but the grammar and wording should feel like NORMAL SPOKEN CONVERSATION.

For example, in Tamil:
❌ Romanized/Tanglish: "Ippo recursion epdi work aaguthu nu paakalaam."
❌ Too formal: "இப்போது recursion எவ்வாறு செயல்படுகிறது என்பதைப் பார்ப்போம்."
✅ Natural spoken classroom Tamil: "இப்போ recursion எப்படி வேலை செய்கிறது என்று பாப்போம்."

❌ Too formal: "முதலில் function தன்னையே மீண்டும் அழைக்கிறது."
✅ Natural spoken classroom Tamil: "முதல்ல function தன்னையே மறுபடியும் call பண்ணும்."

### LANGUAGE-SPECIFIC STYLE

For Tamil:
* Use natural spoken Tamil in Tamil Unicode.
* Words such as "இப்போ", "முதல்ல", "இதுல", "இதுக்கு", "அதுக்காக", "பண்ணும்", "பண்ணலாம்", "பாப்போம்", "புரிஞ்சுக்கலாம்" are acceptable when they naturally fit the sentence.
* Do not force formal equivalents such as "இப்போது", "முதலில்", "இதில்", "இதற்கு", "செயல்படுத்தலாம்", "அழைக்கிறது" when they make the narration sound unnatural.
* Keep programming words such as recursion, function, variable, loop, API, database, backend, frontend, React, Node.js, Java, etc. in English.

For Hindi:
* Use natural conversational Hindi in Devanagari script.
* Do not use Romanized Hindi.
* Avoid excessively Sanskritized/formal Hindi.
* Keep technical terms in English when appropriate.

For Telugu:
* Use natural conversational Telugu in Telugu Unicode script.
* Do not use Romanized Telugu.
* Avoid highly literary/formal Telugu.
* Use simple spoken classroom Telugu.

For Kannada:
* Use natural conversational Kannada in Kannada Unicode script.
* Do not use Romanized Kannada.
* Avoid highly literary/formal Kannada.
* Use simple spoken classroom Kannada.

For Malayalam:
* Use natural conversational Malayalam in Malayalam Unicode script.
* Do not use Romanized Malayalam.
* Avoid highly literary/formal Malayalam.
* Use simple spoken classroom Malayalam.

### TECHNICAL TERMS

Do NOT unnecessarily translate technical/programming terminology.
For example, it is acceptable and preferred to say:
"function", "variable", "loop", "recursion", "API", "database", "backend", "frontend", "component", "server", "request", "response", "array", "object", "JavaScript", "React", "Node.js", "Python", "Spring Boot"

Do not translate technical terminology just for the sake of translation.

### TTS REQUIREMENTS
The narration will be converted into speech using Google Cloud Text-to-Speech.
Therefore:
* Write sentences that are easy to pronounce naturally.
* Avoid unnecessarily long sentences.
* Use normal punctuation.
* Avoid excessive symbols.
* Avoid markdown.
* Avoid bullet points.
* Avoid emojis.
* Avoid pronunciation explanations.
* Do not output SSML.
* Do not add pronunciation notes.
* Do not add English explanations outside the translated narration.
* Preserve natural pauses using punctuation.

### PRESERVE MEANING
The meaning of the original English narration must remain the same.
However, do NOT translate word-by-word. You may restructure sentences when necessary so that they sound natural when spoken by an Indian teacher.

ENGLISH MEANING → NATURAL SPOKEN TARGET LANGUAGE → NATIVE UNICODE SCRIPT → TTS-FRIENDLY SPEECH

### CODE AND TECHNICAL CONTENT
Never translate:
* source code
* function names
* variable names
* class names
* file names
* URLs
* API endpoints
* commands
* programming keywords
* package names
* library names

If code is being explained, keep the code itself unchanged and explain it naturally.
For example:
Screen: factorial(5)
Narration: "இங்க factorial function-க்கு 5-ஐ pass பண்ணுறோம்."

### OUTPUT RULE
Return ONLY the translated narration.
Do not return explanations, notes, labels, language names, quotation marks, markdown, JSON, comments, or alternatives.
The final output must be ready to send directly to the TTS engine.

### FINAL QUALITY CHECK
Silently verify:
1. Is the entire non-technical language written in native Unicode script?
2. Is there ZERO Romanized/Tanglish/Hinglish/Tenglish/Kanglish/Manglish?
3. Does it sound like a real Indian teacher speaking to students?
4. Is it conversational rather than formal or literary?
5. Are technical terms kept in English where natural?
6. Is the meaning of the English narration preserved?
7. Is the sentence structure easy for TTS pronunciation?

Narration to translate:
"${text}"
  `.trim();

  const runModelWithRetry = async (modelName, maxRetries = 3) => {
    let attempts = 0;
    let delay = 1000;

    while (attempts < maxRetries) {
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
        if (attempts >= maxRetries) throw err;
        console.warn(`Translation attempt ${attempts} with ${modelName} failed. Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2;
      }
    }
  };

  try {
    let translatedText;
    try {
      let result = await runModelWithRetry('gemini-2.5-flash', 3);
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

  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  const clientConfig = {};
  if (apiKey && apiKey.trim()) {
    clientConfig.apiKey = apiKey.trim();
  } else {
    clientConfig.vertexai = true;
    clientConfig.project = process.env.GOOGLE_CLOUD_PROJECT || 'sky-meet-01';
    clientConfig.location = process.env.GOOGLE_CLOUD_LOCATION || 'asia-south1';
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

  const runModelWithRetry = async (modelName, maxRetries = 3) => {
    let attempts = 0;
    let delay = 1000;

    while (attempts < maxRetries) {
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
        if (attempts >= maxRetries) throw err;
        console.warn(`Slide translation attempt ${attempts} with ${modelName} failed. Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2;
      }
    }
  };

  try {
    let translatedJsonText;
    try {
      let result = await runModelWithRetry('gemini-2.5-flash', 3);
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
