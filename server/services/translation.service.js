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
You are a professional Indian classroom teacher creating SPEECH NARRATION for an educational video.

Your task is to translate ONLY the given English narration into ${targetLanguageName} for spoken audio.

IMPORTANT:
This translation is ONLY for the teacher's SPEECH/NARRATION.

DO NOT modify, translate, rewrite, or generate any screen content, slide text, headings, labels, code, UI text, diagrams, or visual content.

The output will be sent directly to a Text-to-Speech (TTS) engine.

## SPEECH STYLE

The narration must sound like a real Indian teacher naturally explaining a technical topic to students.

Use:
* Natural conversational language.
* Everyday spoken grammar.
* Friendly classroom tone.
* Simple and easy-to-understand wording.
* Natural colloquial expressions.
* Short, TTS-friendly sentences.
* Native Unicode script for the TARGET LANGUAGE.
* English technical terms where they are normally used by Indian technical teachers.

Do NOT use:
* Romanized language.
* Tanglish.
* Hinglish.
* Tenglish.
* Kanglish.
* Manglish.
* English written using the target language script.
* Very formal language.
* Literary language.
* Textbook-style language.
* Overly pure/native vocabulary that sounds unnatural in a technical classroom.
* Word-for-word machine translation.

## VERY IMPORTANT: NATIVE SCRIPT ≠ FORMAL LANGUAGE

Write the speech using the TARGET LANGUAGE'S native Unicode script, but make the wording sound like normal spoken conversation.

For example, for Tamil:

❌ Romanized Tanglish:
"Ippo recursion epdi work aaguthu nu paakalaam."

❌ Too formal:
"இப்போது recursion எவ்வாறு செயல்படுகிறது என்பதைப் பார்ப்போம்."

✅ Natural spoken classroom Tamil:
"இப்போ recursion எப்படி வேலை செய்கிறது என்று பாப்போம்."

Another example:

❌ Too formal:
"முதலில் function தன்னையே மீண்டும் அழைக்கிறது."

✅ Natural spoken classroom speech:
"முதல்ல function தன்னையே மறுபடியும் call பண்ணும்."

The goal is NOT "pure Tamil".

The goal is:
NATIVE UNICODE SCRIPT + NATURAL SPOKEN CLASSROOM LANGUAGE.

## TECHNICAL TERMS

Do not unnecessarily translate technical/programming terminology.

Keep commonly used technical terms in English when natural:
* function
* variable
* loop
* recursion
* array
* object
* API
* database
* backend
* frontend
* server
* request
* response
* component
* React
* Node.js
* JavaScript
* Python
* Java
* Spring Boot

Example Tamil narration:
"இந்த function ஒரு value-ஐ return பண்ணும்."

Not:
"இந்த செயல்பாடு ஒரு மதிப்பைத் திருப்பி வழங்கும்."

The first version is preferred because this is spoken technical teaching.

## PRONUNCIATION / TTS

The translated narration will be converted into speech.

Therefore:
* Use natural sentence structures.
* Avoid unnecessarily long sentences.
* Use punctuation naturally.
* Make technical terms easy for TTS to pronounce.
* Do not use Romanized pronunciation hints.
* Do not add IPA.
* Do not add pronunciation instructions.
* Do not add explanations about the translation.
* Do not add SSML unless specifically requested.
* Do not add markdown.
* Do not add bullet points.
* Do not add labels.
* Do not add comments.

## MEANING

Preserve the original English narration's meaning.
However, DO NOT translate word-by-word.
You may restructure the sentence so that it sounds natural when spoken by a teacher.

Example:
English: "Now let's understand how recursion works."
Natural spoken Tamil: "இப்போ recursion எப்படி வேலை செய்கிறது என்று பாப்போம்."
Not: "இப்போது recursion எவ்வாறு செயல்படுகிறது என்பதைப் புரிந்துகொள்வோம்."

## LANGUAGE RULES

### Tamil
Use conversational spoken Tamil in Tamil Unicode script.
Prefer natural forms such as:
"இப்போ", "முதல்ல", "இதுல", "இதுக்கு", "அதுக்காக", "பண்ணும்", "பண்ணலாம்", "பாப்போம்", "புரிஞ்சுக்கலாம்" when appropriate.

Do not force formal alternatives such as:
"இப்போது", "முதலில்", "இதில்", "இதற்கு", "செயல்படுகிறது", "அழைக்கிறது", "புரிந்துகொள்வோம்" if they make the narration sound like textbook Tamil.

### Hindi
Use natural conversational Indian Hindi in Devanagari script.
Do not use Romanized Hindi.
Avoid highly formal or Sanskritized Hindi.
Use the way an Indian teacher would naturally explain programming to students.

### Telugu
Use natural conversational Telugu in Telugu Unicode script.
Do not use Romanized Telugu.
Avoid highly literary/formal Telugu.
Use simple spoken classroom Telugu.

### Kannada
Use natural conversational Kannada in Kannada Unicode script.
Do not use Romanized Kannada.
Avoid highly literary/formal Kannada.
Use simple spoken classroom Kannada.

### Malayalam
Use natural conversational Malayalam in Malayalam Unicode script.
Do not use Romanized Malayalam.
Avoid highly literary/formal Malayalam.
Use simple spoken classroom Malayalam.

## DO NOT CHANGE TECHNICAL MEANING

If the English narration says:
"First, the function calls itself again."

A natural Tamil speech version can be:
"முதல்ல function தன்னையே மறுபடியும் call பண்ணும்."

Keep the programming concept unchanged.

## FINAL OUTPUT

Return ONLY the final translated SPEECH NARRATION.

Do not return:
* English original
* translation explanation
* language name
* pronunciation guide
* notes
* alternatives
* markdown
* JSON
* SSML
* screen/content text

The result must be ready to send directly to the TTS engine.

FINAL CHECK BEFORE OUTPUT:
1. Is this ONLY speech narration?
2. Is all non-technical language written in native Unicode script?
3. Is there ZERO Tanglish/Hinglish/Tenglish/Kanglish/Manglish?
4. Does it sound like a real Indian teacher speaking?
5. Is it conversational rather than formal/literary?
6. Are technical terms kept in English where natural?
7. Is the original meaning preserved?
8. Is it easy and natural for TTS pronunciation?

If the narration sounds too formal, rewrite it into natural spoken classroom language before returning it.

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
