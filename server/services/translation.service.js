const { GoogleGenAI } = require('@google/genai');

/**
 * Shared "no suffix on English words" rule block.
 * Used by both the Tamil-specific prompt and the generic multi-language prompt
 * (and the slides prompt) so all three stay consistent.
 */
const TAMIL_NO_SUFFIX_BLOCK = `
CRITICAL TTS RULE: NEVER ATTACH TAMIL GRAMMAR TO ENGLISH WORDS

An English technical word must always stay a clean, bare, standalone token. Never attach a Tamil grammatical suffix or case marker to it — not fused ("valueஆ"), not hyphenated ("value-ஐ"), and not left as an isolated spaced particle ("value ஐ"). All three forms are equally banned.

Instead, restructure the sentence using one of these techniques:

a) Use the "எப்படி ... பாப்போம்/பண்ணலாம்" pattern so the English word never needs a case marker at all.
❌ "இந்த part-ஐ கொஞ்சம் பாப்போம்."
✅ "இந்த part எப்படி work ஆகுதுன்னு பாப்போம்."

b) When you need to refer back to the concept with a case marker, put the marker on a Tamil demonstrative pronoun or noun (இதை, அதை, இதுக்கு, அதுக்கு, மதிப்பு, முடிவு) instead of on the English word. The English word stays bare:
❌ "இந்த function-க்கு ஒரு value கொடுக்கணும்."
✅ "இந்த function ஒரு value எடுத்துக்கிட்டு, அதை use பண்ணும்."

c) There is no acceptable form where a Tamil suffix touches an English word directly — fused, hyphenated, or spaced. Always restructure instead.

The same principle applies to Hindi, Telugu, Kannada, and Malayalam scripts when a native case ending or postposition would otherwise land directly on an English technical word.
`.trim();

/**
 * Natural Chennai spoken Tamil translation prompt with English code-mixing for TTS.
 * Generates conversational classroom speech as spoken by Chennai developers/teachers.
 */
const buildTamilTranslationPrompt = (text) => `
You are an expert Tamil teacher and software developer creating natural spoken SPEECH NARRATION for an educational programming video.

Your task is to translate the given English narration into natural, conversational Chennai Tamil (சென்னை பேச்சுத் தமிழ்) with English code-mixing, exactly like a friendly Chennai-based developer or teacher explaining concepts to students in an online class.

==================================================
1. CHENNAI SPOKEN TAMIL + CODE-MIXING STYLE
==================================================

- Speak in natural, casual, friendly Chennai Tamil (சென்னை பேச்சுத் தமிழ்).
- Freely mix Tamil and English words the way tech professionals naturally speak.
- The output must sound like a real human teacher explaining live in class, NOT like a textbook, formal announcement, or machine translation.
- AVOID formal, literary, or archaic Tamil.

Examples of desired style:
❌ Formal/Textbook: "இந்த செயல்பாடு ஒரு மதிப்பை எடுத்துக்கொண்டு செயல்படுத்துகிறது."
✅ Conversational: "இந்த function ஒரு value எடுத்துக்கிட்டு அதுக்கு ஏத்த மாதிரி work பண்ணும்."

❌ Formal/Textbook: "இப்போது இந்த செயல்முறையைப் பார்ப்போம்."
✅ Conversational: "சரி, இப்போ இது எப்படி work ஆகுதுன்னு பாக்கலாம்."

❌ Formal/Textbook: "இதனை நாம் தரவுத்தளத்தில் சேமிக்கிறோம்."
✅ Conversational: "இத நம்ம database-ல save பண்ணிக்கிறோம்."

❌ Formal/Textbook: "இந்த மாறி ஒரு மதிப்பை சேமிக்கிறது."
✅ Conversational: "இந்த variable-ல ஒரு value store ஆகும்."

==================================================
2. NATURAL ENGLISH CODE-MIXING & SUFFIXES
==================================================

- Keep technical and programming terms in English script (e.g. function, variable, database, code, array, object, loop, class, API, server, value, component, state, etc.).
- You are COMPLETELY FREE to attach natural Tamil grammatical suffixes and case markers directly to English words using hyphens or natural attachments where Chennai speakers naturally say them:
  * function-ஐ
  * variable-ல
  * database-க்கு
  * value-ஓட
  * code-ல
  * component-க்கு
- Do NOT artificially restructure sentences to avoid suffixes. Spoken naturalness is the top priority.

==================================================
3. CHENNAI SLANG AND NATURAL TRANSITIONS
==================================================

Use natural Chennai conversational markers and expressions where they fit organically:
* சரி பாக்கலாம்
* அப்படித்தான்
* பாத்தீங்கன்னா
* புரியுதா
* இப்போ என்ன ஆகுதுன்னா
* இதுதான் முக்கியமான விஷயம்
* சிம்பிளா சொல்லணும்னா
* அடுத்து என்ன பண்ணப்போறோம்னா
* அதுக்காகத்தான்
* ஓகேங்களா
* இங்க கவனிக்க வேண்டியது என்னன்னா
* இதை நல்லா புரிஞ்சுக்கோங்க

Do NOT force slang into every single line; use them naturally when explaining ideas or transitioning between points.

==================================================
4. EXPLAIN CODE & OPERATORS NATURALLY
==================================================

- Explain code and logic naturally as spoken explanation.
- Do NOT read code punctuation character-by-character (avoid reading brackets, semicolons, colons, braces literally).
- Explain operators naturally in conversation (e.g. "plus", "equals", "check பண்ணுது").
- Keep numbers and units easy to speak (e.g. "ten", "five seconds", "100ms").

==================================================
5. OUTPUT REQUIREMENTS
==================================================

- Return ONLY the translated Chennai Tamil spoken narration.
- Do NOT include markdown code blocks, quotes around the output, notes, explanations, or pronunciation guides.
- Preserve the exact technical meaning of the lesson while making it conversational and engaging.

Translate the following English narration into natural Chennai spoken Tamil:
"${text}"
`.trim();

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

  const isTamil = targetLanguageName && targetLanguageName.toLowerCase() === 'tamil';

  // NOTE: Tamil is fully handled by buildTamilTranslationPrompt above and never
  // reaches the generic prompt below. The generic prompt only ever runs for
  // Hindi, Telugu, Kannada, and Malayalam (English returns early, Tamil branches
  // off here). Its Tamil-flavoured illustrations exist purely to demonstrate the
  // "keep terms in English, never suffix them" principle by example.
  const prompt = isTamil
    ? buildTamilTranslationPrompt(text)
    : `
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
"இந்த function ஒரு value return பண்ணும்."

Not:
"இந்த செயல்பாடு ஒரு மதிப்பைத் திருப்பி வழங்கும்."

The first version is preferred because this is spoken technical teaching, and the English word stays bare with no Tamil suffix attached to it.

## ${TAMIL_NO_SUFFIX_BLOCK}

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
6. Are technical terms kept in English where natural, and are they bare — no native suffix attached directly to them?
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

    // Direct TTS flow: The translated Chennai Tamil text goes directly to TTS with no AI normalization or validation
    return translatedText.trim();
  } catch (error) {
    console.error(`Translation to ${targetLanguageName} failed:`, error);
    throw error;
  }
};

/**
 * Extracts a JSON array/object from a model response even if the model wrapped it
 * in a markdown code fence or added leading/trailing prose. Falls back to slicing
 * from the first '[' or '{' to the matching last ']' or '}' if a direct parse fails.
 */
const extractJson = (rawText) => {
  let cleaned = rawText.trim();

  // Strip a leading/trailing markdown code fence if present (```json ... ``` or ``` ... ```)
  cleaned = cleaned.replace(/^```[a-zA-Z]*\s*/, '').replace(/\s*```$/, '');

  // Fix trailing commas before closing braces/brackets (common LLM JSON error)
  cleaned = cleaned.replace(/,\s*([}\]])/g, '$1');

  try {
    return JSON.parse(cleaned);
  } catch (firstErr) {
    // Fallback: the model may have added prose before/after the JSON payload.
    // Slice from the first bracket to the last matching bracket and retry.
    const firstBracket = Math.min(
      ...['[', '{'].map(ch => {
        const idx = cleaned.indexOf(ch);
        return idx === -1 ? Infinity : idx;
      })
    );
    const lastBracket = Math.max(cleaned.lastIndexOf(']'), cleaned.lastIndexOf('}'));

    if (firstBracket !== Infinity && lastBracket > firstBracket) {
      const sliced = cleaned.slice(firstBracket, lastBracket + 1).replace(/,\s*([}\]])/g, '$1');
      return JSON.parse(sliced);
    }
    throw firstErr;
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

  const isTamil = targetLanguageName && targetLanguageName.toLowerCase() === 'tamil';

  const prompt = `
You are an expert educational video content generator for programming and technical subjects.

Generate both the ON-SCREEN CONTENT and TEACHER SPEECH NARRATION for the lesson by translating the given English JSON slide array into ${targetLanguageName}.

The two outputs have DIFFERENT language and formatting requirements.

==================================================
1. ON-SCREEN CONTENT
==================================================

The screen content is displayed visually to students (heading, subheading, bullets, labels).

It must be modern, professional, concise, technical, and easy to read.

DO NOT write screen content in overly pure, literary, traditional, or textbook-style Tamil, Hindi, Telugu, Kannada, or Malayalam.

Use a modern technical classroom style.

For technical/programming terminology, KEEP COMMON ENGLISH TERMS IN ENGLISH.

Examples:
Class
Object
Function
Variable
Method
Attribute
Constructor
Inheritance
Encapsulation
Polymorphism
Recursion
Loop
Array
String
API
Database
Backend
Frontend
Server
Component
React
Node.js
Python
Java
Spring Boot

Do not unnecessarily translate these technical terms into pure native-language equivalents.

The surrounding explanation may use the selected target language.

For example, for Tamil:

❌ Too pure/formal:
"பொருள் சார்ந்த நிரலாக்கத்தின் அடிப்படைக் கருத்துகளைப் புரிந்துகொள்வோம்."

✅ Modern technical screen content:
"Object-Oriented Programming (OOP)
அடிப்படை Concepts"

Another example:

❌ Too formal:
"வகுப்பு என்பது பொருட்களை உருவாக்குவதற்கான வரைபடமாகும்."

✅ Modern technical style:
"Class என்பது Object-ஐ உருவாக்குவதற்கான Blueprint."

The same principle applies to Hindi, Telugu, Kannada, and Malayalam.

The screen should look like a modern programming course, not a translated textbook.

Keep screen text concise.

Do not put the complete narration on the screen.

Use:
* Headings
* Key concepts
* Short explanations
* Examples
* Diagrams
* Code
* Important technical terms

Do not add unnecessary decorative emojis.

Do not add decorative symbols unless they are actually required for the technical content.

Programming symbols that are part of code must remain unchanged.

==================================================
2. TEACHER SPEECH NARRATION
==================================================

The narration (the 'narration' field) is ONLY for spoken audio.

It will be sent to a Text-to-Speech engine.

The narration must sound like a REAL INDIAN TEACHER naturally explaining the topic to students.

Use:
* Natural conversational language
* Friendly classroom tone
* Simple spoken grammar
* Everyday wording
* Natural colloquial expressions
* Short TTS-friendly sentences
* Native Unicode script for the selected target language
* English technical terms where programmers normally use them

This is NOT formal translation.
This is NOT literary language.
This is NOT textbook language.
This is NOT pure/native-language terminology.
This is NOT Romanized language.

Do NOT generate:
Tanglish, Hinglish, Tenglish, Kanglish, Manglish, or any Romanized Indian-language script.

The target language must use its proper native Unicode script.

IMPORTANT: NATIVE UNICODE SCRIPT does NOT mean FORMAL LANGUAGE.

For example, Tamil:

❌ Romanized:
"Ippo recursion epdi work aaguthu nu paakalaam."

❌ Too formal:
"இப்போது recursion எவ்வாறு செயல்படுகிறது என்பதைப் பார்ப்போம்."

✅ Natural spoken classroom Tamil:
"இப்போ recursion எப்படி வேலை செய்கிறது என்று பாப்போம்."

The same principle applies to Hindi, Telugu, Kannada, and Malayalam. Avoid highly formal, literary, or Sanskritized vocabulary.

==================================================
3. TECHNICAL TERMS IN SPEECH
==================================================

Do NOT unnecessarily translate technical terminology. Keep common technical terms in English when natural:
function, class, object, variable, method, attribute, constructor, recursion, loop, array, string, API, database, backend, frontend, server, request, response, component, React, Node.js, Python, Java, Spring Boot, JavaScript.

Example (Tamil):
"இந்த function ஒரு value return பண்ணும்."
NOT: "இந்த செயல்பாடு ஒரு மதிப்பைத் திருப்பி வழங்கும்."

Example (Hindi):
"यह function एक value return करता है."

Example (Telugu):
"ఈ function ఒక value return చేస్తుంది."

Example (Kannada):
"ಈ function ಒಂದು value return ಮಾಡುತ್ತದೆ."

Example (Malayalam):
"ഈ function ഒരു value return ചെയ്യും."

- For Tamil: Use natural Chennai spoken Tamil (சென்னை பேச்சுத் தமிழ்) with English code-mixing (e.g. function-ஐ, variable-ல, database-க்கு, value-ஓட, code-ல). Freely mix English and Tamil without forcing artificial sentence restructuring or suffix separation.
- For Hindi, Telugu, Kannada, Malayalam: Use natural spoken classroom language with English technical terms.

==================================================
4. CODE AND SCREEN CONTENT
==================================================

NEVER change source code.

NEVER translate:
Variable names, function names, class names, method names, file names, programming keywords, commands, URLs, API endpoints, package names, library names, code blocks.

Screen code must remain exactly as generated.

However, the teacher narration must NOT automatically read code character-by-character.

For example, if the screen shows:
def factorial(n):
if n == 0:
return 1

The narration should naturally explain:
"The factorial function takes a number as input. If that number is zero, it returns one."

Do NOT say:
"def factorial open bracket n close bracket colon..."
unless the lesson is specifically teaching that syntax.

==================================================
5. SYMBOLS AND EMOJIS — CRITICAL TTS RULE
==================================================

The speech narration must NEVER contain decorative emojis or symbols. Remove all emojis from speech.

Do not verbally pronounce decorative symbols. For example, if the narration contains "Class → Object", convert it to natural speech: "Class and Object."

If a technical symbol is important to the explanation, convert it into natural spoken words:
* → "plus"
- → "minus"
= → "equals"
== → "double equals"
!= → "not equal to"
> → "greater than"
< → "less than"
>= → "greater than or equal to"
<= → "less than or equal to"

Do not read parentheses, brackets, braces, commas, colons, semicolons, or other programming punctuation literally unless the lesson is specifically explaining those symbols.

==================================================
6. SCREEN SYMBOLS VS SPEECH
==================================================

A symbol may remain on the SCREEN but should not automatically appear in SPEECH.

SCREEN: Class → Object
SPEECH: "Class and Object."

Example:
SCREEN: factorial(5)
SPEECH: "இங்க factorial function ஒரு value எடுத்துக்கிட்டு, அதை use பண்ணும்."

The screen and speech are separate outputs. Never copy visual formatting into the narration.

==================================================
7. MARKDOWN AND FORMATTING
==================================================

Never send these to TTS: **, *, #, backticks, HTML tags, markdown bullets, markdown links, decorative separators, UI formatting. Convert the underlying meaning into natural speech when necessary.

==================================================
8. PRONUNCIATION AND TTS
==================================================

The narration will be converted to speech using TTS. Use natural sentence structures, avoid unnecessarily long sentences, use punctuation for natural pauses, avoid awkward sentence structures, avoid unnecessary symbols, avoid emojis, avoid Romanized words, keep English technical terms recognizable. Do not write pronunciation instructions, IPA, translator notes, or explanations about the translation.

The final narration should sound like natural human teaching, not like a screen reader.

==================================================
9. PRESERVE MEANING
==================================================

Preserve the original English lesson meaning. Do NOT perform word-by-word translation. You may restructure sentences to make them natural for the target language.

==================================================
10. IMPORTANT SEPARATION RULE
==================================================

NEVER apply the conversational speech rules to the screen content. NEVER apply the screen-content translation style to the speech.

SCREEN CONTENT: Modern + technical + concise + English technical terminology + target-language explanation.
SPEECH NARRATION: Natural + conversational + native Unicode + English technical terminology + TTS-friendly.

The two outputs must be generated independently.

==================================================
11. FINAL QUALITY CHECK
==================================================

Before returning the generated lesson, silently verify:

SCREEN CONTENT:
1. Is the screen content modern and technical?
2. Is it free from overly pure/literary native-language terminology?
3. Are common programming terms kept in English?
4. Is the screen concise and readable?
5. Is code unchanged?
6. Are unnecessary emojis removed?

SPEECH:
7. Is the narration written in native Unicode?
8. Is there ZERO Tanglish/Hinglish/Tenglish/Kanglish/Manglish?
9. Does it sound like a real Indian teacher?
10. Is it conversational rather than formal/literary?
11. Are common technical terms kept in English (with natural code-mixing allowed)?
12. Are all emojis removed?
13. Are unnecessary symbols removed?
14. Is programming punctuation NOT being read literally?
15. Is code explained naturally instead of being read character-by-character?
16. Is the narration suitable for TTS?
17. Is the original meaning preserved?

If the screen content sounds too pure/formal, rewrite it into modern technical educational language.
If the narration sounds too formal, rewrite it into natural conversational classroom speech.
If the narration contains emojis or unnecessary symbols, fix it before returning it.

Return structured outputs according to the application's existing scene/slide schema, keeping SCREEN CONTENT and SPEECH NARRATION as separate fields.
Translate human-readable fields: heading, subheading, bullets, narration, title, description, buttonText, labels, etc.
Preserve JSON structure EXACTLY. Return an array of objects with the same structure, just translated text.

Slides JSON to translate into ${targetLanguageName}:
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

    const translatedSlides = extractJson(translatedJsonText);

    // Safely preserve board structure (ids, sentenceIndex, connections) and merge translated labels
    if (Array.isArray(translatedSlides)) {
      for (let i = 0; i < translatedSlides.length; i++) {
        const transSlide = translatedSlides[i];
        const origSlide = slides[i];
        if (origSlide && origSlide.board) {
          if (!transSlide.board) {
            transSlide.board = JSON.parse(JSON.stringify(origSlide.board));
          } else {
            const mergedBoard = JSON.parse(JSON.stringify(origSlide.board));
            if (transSlide.board.heading) {
              mergedBoard.heading = transSlide.board.heading;
            }
            if (Array.isArray(mergedBoard.nodes) && Array.isArray(transSlide.board.nodes)) {
              for (let n = 0; n < mergedBoard.nodes.length; n++) {
                const transNode = transSlide.board.nodes.find(tn => String(tn.id) === String(mergedBoard.nodes[n].id)) || transSlide.board.nodes[n];
                if (transNode && transNode.label) {
                  mergedBoard.nodes[n].label = transNode.label;
                }
              }
            }
            if (Array.isArray(mergedBoard.edges) && Array.isArray(transSlide.board.edges)) {
              for (let e = 0; e < mergedBoard.edges.length; e++) {
                const transEdge = transSlide.board.edges[e];
                if (transEdge && transEdge.label) {
                  mergedBoard.edges[e].label = transEdge.label;
                }
              }
            }
            if (Array.isArray(mergedBoard.notes) && Array.isArray(transSlide.board.notes)) {
              for (let m = 0; m < mergedBoard.notes.length; m++) {
                const transNote = transSlide.board.notes[m];
                if (transNote && transNote.text) {
                  mergedBoard.notes[m].text = transNote.text;
                }
              }
            }
            transSlide.board = mergedBoard;
          }
        }
      }
    }

    return translatedSlides;
  } catch (error) {
    console.error(`Slide translation to ${targetLanguageName} failed:`, error);
    throw error;
  }
};

/**
 * In-memory cache for normalized Tamil narration results
 */
const normalizationCache = new Map();

/**
 * Known Tamil bound case-marker / suffix tokens that must never appear as an
 * isolated word right after an English technical word. Kept as an explicit
 * whitelist (rather than "any short Tamil string") so that ordinary short
 * Tamil words — ஒரு (a/one), இது (this), அது (that), etc. — are never
 * mistaken for a stray grammatical suffix.
 */
const TAMIL_CASE_SUFFIX_TOKENS = ['ஐ', 'ஆ', 'ஓடு', 'ஓட', 'இல்', 'ல்', 'ல', 'க்கு', 'இன்', 'ஆல்', 'உடன்'];

/**
 * Validates text for TTS issues, specifically targeting Tamil mixed-language suffix patterns
 * and general formatting noise.
 */
const validateTTSInput = (text) => {
  if (!text || typeof text !== 'string') return { hasIssues: false, issues: [] };

  const issues = [];

  // 1. Mixed language suffix pattern checks (Tamil specific)
  const hyphenatedSuffix = /[A-Za-z0-9]+-[\u0B80-\u0BFF]+/u;
  const adjacentSuffix = /[A-Za-z0-9]+[\u0B80-\u0BFF]+/u;
  const isolatedParticle = new RegExp(
    `\\b[A-Za-z0-9]+\\s+(?:${TAMIL_CASE_SUFFIX_TOKENS.join('|')})(?=\\s|[.,!?]|$)`,
    'u'
  );

  if (hyphenatedSuffix.test(text) || adjacentSuffix.test(text) || isolatedParticle.test(text)) {
    issues.push('mixed-language-suffix');
  }

  // 2. Literal programming symbol phrases spoken by accident
  const literalSymbolSpokenRegex = /\b(?:open|close)\s+(?:parenthesis|parentheses|bracket|brackets|brace|braces)\b|\bequals\s+greater\s+than\b|\bminus\s+greater\s+than\b|\bampersand\s+ampersand\b|\bpipe\s+pipe\b/i;
  if (literalSymbolSpokenRegex.test(text)) {
    issues.push('literal-programming-symbol-spoken');
  }

  // 3. Emojis
  const emojiRegex = /(?:\p{Extended_Pictographic}|\p{Emoji_Presentation})/u;
  if (emojiRegex.test(text)) {
    issues.push('emoji');
  }

  // 4. Markdown syntax
  const markdownRegex = /\*\*|#+|`|^\s*[*+-]\s+|\[.*?\]\(.*?\)/m;
  if (markdownRegex.test(text)) {
    issues.push('markdown');
  }

  // 5. Decorative symbols / arrows
  const symbolRegex = /[\u2190-\u21FF\u2600-\u26FF\u2700-\u27BF★➔➡►◄]|→|★/u;
  if (symbolRegex.test(text)) {
    issues.push('decorative-symbol');
  }

  // 6. Excessive / repeated punctuation
  const repeatedPunctuationRegex = /([.,!?;:-])\1+/;
  if (repeatedPunctuationRegex.test(text)) {
    issues.push('repeated-punctuation');
  }

  // 7. Repeated whitespace
  const repeatedWhitespaceRegex = /\s{2,}/;
  if (repeatedWhitespaceRegex.test(text)) {
    issues.push('repeated-whitespace');
  }

  return {
    hasIssues: issues.length > 0,
    issues
  };
};

/**
 * Cleans programming syntax symbols from teacher narration so TTS engines
 * do not read code punctuation literally (e.g., "open bracket", "underscore", "semicolon", "equals greater than").
 * Converts semantic operators into natural spoken words.
 */
const cleanProgrammingSymbolsForTTS = (text) => {
  if (!text || typeof text !== 'string') return text;

  let cleaned = text;

  // 1. Remove literal spoken representations of programming symbols
  cleaned = cleaned.replace(/\b(?:open|close)\s+(?:parenthesis|parentheses|bracket|brackets|brace|braces)\b/gi, '');
  cleaned = cleaned.replace(/\bequals\s+greater\s+than\b/gi, 'arrow');
  cleaned = cleaned.replace(/\bminus\s+greater\s+than\b/gi, 'arrow');
  cleaned = cleaned.replace(/\bampersand\s+ampersand\b/gi, 'and');
  cleaned = cleaned.replace(/\bpipe\s+pipe\b/gi, 'or');
  cleaned = cleaned.replace(/\basterisk\b/gi, 'times');
  cleaned = cleaned.replace(/\bsemicolon\b/gi, '');
  cleaned = cleaned.replace(/\bcolon\b/gi, '');
  cleaned = cleaned.replace(/\bdouble\s+quote\b/gi, '');
  cleaned = cleaned.replace(/\bsingle\s+quote\b/gi, '');
  cleaned = cleaned.replace(/\bbacktick\b/gi, '');

  // 2. Convert multi-character comparison & logical operators to spoken words
  cleaned = cleaned.replace(/===\s*/g, ' strictly equals ');
  cleaned = cleaned.replace(/!==\s*/g, ' strictly not equal to ');
  cleaned = cleaned.replace(/==\s*/g, ' is equal to ');
  cleaned = cleaned.replace(/!=\s*/g, ' is not equal to ');
  cleaned = cleaned.replace(/>=\s*/g, ' is greater than or equal to ');
  cleaned = cleaned.replace(/<=\s*/g, ' is less than or equal to ');
  cleaned = cleaned.replace(/=>\s*/g, ' arrow ');
  cleaned = cleaned.replace(/->\s*/g, ' arrow ');
  cleaned = cleaned.replace(/&&\s*/g, ' and ');
  cleaned = cleaned.replace(/\|\|\s*/g, ' or ');

  // 3. Convert single comparison / arithmetic operators when surrounded by variables/numbers
  cleaned = cleaned.replace(/([a-zA-Z0-9_\u0B80-\u0BFF]+)\s*>\s*([a-zA-Z0-9_\u0B80-\u0BFF]+)/g, '$1 is greater than $2');
  cleaned = cleaned.replace(/([a-zA-Z0-9_\u0B80-\u0BFF]+)\s*<\s*([a-zA-Z0-9_\u0B80-\u0BFF]+)/g, '$1 is less than $2');
  cleaned = cleaned.replace(/([a-zA-Z0-9_\u0B80-\u0BFF]+)\s*\*\s*([a-zA-Z0-9_\u0B80-\u0BFF]+)/g, '$1 multiplied by $2');
  cleaned = cleaned.replace(/([a-zA-Z0-9_\u0B80-\u0BFF]+)\s*\/\s*([a-zA-Z0-9_\u0B80-\u0BFF]+)/g, '$1 divided by $2');
  cleaned = cleaned.replace(/([a-zA-Z0-9_\u0B80-\u0BFF]+)\s*%\s*([a-zA-Z0-9_\u0B80-\u0BFF]+)/g, '$1 modulo $2');

  // 4. Python dunder methods and underscore cleanup for TTS
  // 4a. Handle dunder (double-underscore) methods: __init__ -> init, __str__ -> str, __name__ -> name
  cleaned = cleaned.replace(/__([a-zA-Z][a-zA-Z0-9]*)__/g, '$1');
  // 4b. Strip remaining leading/trailing underscores from identifiers: _private -> private, name_ -> name
  cleaned = cleaned.replace(/\b_+([a-zA-Z][a-zA-Z0-9]*)/g, '$1');
  cleaned = cleaned.replace(/([a-zA-Z0-9]+)_+\b/g, '$1');
  // 4c. Internal underscores in identifiers: user_name -> user name
  cleaned = cleaned.replace(/([a-zA-Z0-9]+)_([a-zA-Z0-9]+)/g, '$1 $2');

  // 5. Template literal syntax `${variable}` -> `variable`
  cleaned = cleaned.replace(/\$\{\s*([a-zA-Z0-9_]+)\s*\}/g, '$1');

  // 6. Strip programming enclosure punctuation from speech
  cleaned = cleaned.replace(/[`"'#]/g, '');
  cleaned = cleaned.replace(/[(){}\[\]]/g, ' ');

  // 7. Remove trailing/isolated colons, semicolons that are code artifacts
  cleaned = cleaned.replace(/:\s*$/gm, '.');
  cleaned = cleaned.replace(/;\s*/g, '. ');
  cleaned = cleaned.replace(/\s*:\s*/g, ' ');

  // 8. Collapse repeated whitespace and clean spaces around punctuation
  cleaned = cleaned.replace(/\s+/g, ' ');
  cleaned = cleaned.replace(/\s+([.,!?])/g, '$1');

  return cleaned.trim();
};

/**
 * Deterministic JS cleanup pass for TTS text.
 * Strips formatting noise and programming syntax symbols without altering speech grammar.
 */
const cleanTextForTTS = (text) => {
  if (!text || typeof text !== 'string') return text;

  let cleaned = text;

  // Apply programming symbol cleanup
  cleaned = cleanProgrammingSymbolsForTTS(cleaned);

  // Replace arrow symbols with natural spoken words
  cleaned = cleaned.replace(/\s*→\s*/g, ' and ');
  cleaned = cleaned.replace(/[\u2190-\u21FF\u2600-\u26FF\u2700-\u27BF★➔➡►◄]/g, '');

  // Strip emojis
  cleaned = cleaned.replace(/(?:\p{Extended_Pictographic}|\p{Emoji_Presentation})/gu, '');

  // Strip markdown formatting
  cleaned = cleaned.replace(/\*\*/g, '');
  cleaned = cleaned.replace(/#+/g, '');
  cleaned = cleaned.replace(/`/g, '');
  cleaned = cleaned.replace(/^\s*[*+-]\s+/gm, '');
  cleaned = cleaned.replace(/\[(.*?)\]\(.*?\)/g, '$1');

  // Collapse repeated punctuation
  cleaned = cleaned.replace(/([.,!?;:-])\1+/g, '$1');

  // Collapse repeated whitespace
  cleaned = cleaned.replace(/\s{2,}/g, ' ');

  return cleaned.trim();
};

/**
 * DEPRECATED: Previously performed a secondary Gemini AI normalization pass on Tamil narration.
 * Completely bypassed/removed — no secondary AI requests occur.
 */
const normalizeNarrationForTTS = async (text, attemptNumber = 1, previousIssues = []) => {
  return cleanTextForTTS(text);
};

/**
 * Pipeline helper to process narration for TTS across all target languages.
 * Secondary Gemini normalization and validation passes have been removed.
 * Spoken narration goes directly to the TTS engine.
 */
const processNarrationForTTS = async (translatedText, targetLanguageName = 'English') => {
  if (!translatedText) {
    return translatedText;
  }
  return cleanTextForTTS(translatedText);
};

module.exports = {
  translateText,
  translateSlides,
  validateTTSInput,
  normalizeNarrationForTTS,
  cleanTextForTTS,
  cleanProgrammingSymbolsForTTS,
  processNarrationForTTS,
  normalizationCache
};