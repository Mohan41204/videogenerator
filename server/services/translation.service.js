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

## CRITICAL: NEVER CREATE ISOLATED NATIVE SUFFIXES OR PARTICLES IN SPEECH

The narration will be converted directly to TTS.

Do NOT attach Tamil or native grammatical suffixes or particles directly to English technical words if the TTS may pronounce the suffix as a separate word.

Avoid constructions where suffixes become isolated during speech, such as:
❌ part-ஐ
❌ example-ல
❌ code-ஐ
❌ function-க்கு
❌ variable-ல
❌ class-க்கு
❌ object-ஐ
❌ method-ஐ
❌ topic-ல
❌ concept-ஐ

The problem is that TTS may pronounce the English word first and then separately pronounce:
"ஐ", "இல்", "ல", "க்கு", "ன்", "ம்".
This creates unnatural speech.

When an English technical word needs a native grammatical relationship, REWRITE THE ENTIRE SENTENCE so that the native suffix does not need to be attached directly to the English word.
Do NOT simply remove the suffix and leave the sentence grammatically broken. Rewrite the sentence naturally.

Examples:
❌ "இந்த part-ஐ கொஞ்சம் கவனமா பாப்போம்."
✅ "இப்போ இந்த part பற்றி கொஞ்சம் கவனமா பார்ப்போம்." (or) "இப்போ இந்த part எப்படி work ஆகுதுன்னு பார்ப்போம்."

❌ "இதை ஒரு example-ல பாப்போம்."
✅ "இப்போ ஒரு example எடுத்துப் பாப்போம்." (or) "இப்போ ஒரு example மூலம் புரிஞ்சுக்கலாம்."

❌ "இந்த code-ஐ run பண்ணலாம்."
✅ "இப்போ இந்த code எப்படி run ஆகுதுன்னு பாப்போம்."

❌ "இந்த function-க்கு ஒரு value கொடுக்கணும்."
✅ "இந்த function ஒரு valueஐ inputஆ எடுத்துக்கொள்ளும்."

Never intentionally create speech such as:
❌ "part... ஐ"
❌ "example... ல"
❌ "function... க்கு"

Never output a standalone Tamil/native suffix or particle. Every grammatical unit must belong naturally to a complete spoken phrase.
The priority is NATURAL TTS PRONUNCIATION, not preserving the original sentence structure.

Instead of: [English technical word + Tamil suffix]
prefer: [Tamil sentence restructuring + English technical word].

❌ "இந்த concept-ஐ explain பண்ணலாம்."
✅ "இந்த concept எப்படி work ஆகுதுன்னு explain பண்ணலாம்."

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
    
    // Process TTS normalization if target language is Tamil
    translatedText = await processNarrationForTTS(translatedText, targetLanguageName);
    
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
===========================

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

Tanglish
Hinglish
Tenglish
Kanglish
Manglish
Romanized Tamil
Romanized Hindi
Romanized Telugu
Romanized Kannada
Romanized Malayalam

The target language must use its proper native Unicode script.

IMPORTANT:

NATIVE UNICODE SCRIPT does NOT mean FORMAL LANGUAGE.

The narration should use native script while sounding conversational.

For example, Tamil:

❌ Romanized:
"Ippo recursion epdi work aaguthu nu paakalaam."

❌ Too formal:
"இப்போது recursion எவ்வாறு செயல்படுகிறது என்பதைப் பார்ப்போம்."

✅ Natural spoken classroom Tamil:
"இப்போ recursion எப்படி வேலை செய்கிறது என்று பாப்போம்."

Another example:

❌ Too formal:
"முதலில் function தன்னையே மீண்டும் அழைக்கிறது."

✅ Natural spoken classroom Tamil:
"முதல்ல function தன்னையே மறுபடியும் call பண்ணும்."

The same principle applies to Hindi, Telugu, Kannada, and Malayalam.

Avoid highly formal, literary, or Sanskritized vocabulary.

Use the way a real Indian teacher would naturally explain programming to students.

==================================================
3. TECHNICAL TERMS IN SPEECH
============================

Do NOT unnecessarily translate technical terminology.

Keep common technical terms in English when natural:

function
class
object
variable
method
attribute
constructor
recursion
loop
array
string
API
database
backend
frontend
server
request
response
component
React
Node.js
Python
Java
Spring Boot
JavaScript

Example:

Natural Tamil:
"இந்த function ஒரு value-ஐ return பண்ணும்."

NOT:

"இந்த செயல்பாடு ஒரு மதிப்பைத் திருப்பி வழங்கும்."

Natural Hindi:
"यह function एक value return करता है."

Natural Telugu:
"ఈ function ఒక value-ని return చేస్తుంది."

Natural Kannada:
"ಈ function ಒಂದು value-ನ return ಮಾಡುತ್ತದೆ."

Natural Malayalam:
"ഈ function ഒരു value return ചെയ്യും."

Use the target language for the explanation and English for commonly used technical terminology.

==================================================
3.5 CRITICAL TTS RULE: NO ISOLATED NATIVE SUFFIXES
==================================================

The narration will be converted directly to TTS.

Do NOT attach Tamil or native grammatical suffixes or particles directly to English technical words if the TTS may pronounce the suffix as a separate word.

Avoid constructions where suffixes become isolated during speech, such as:
❌ part-ஐ
❌ example-ல
❌ code-ஐ
❌ function-க்கு
❌ variable-ல
❌ class-க்கு
❌ object-ஐ
❌ method-ஐ
❌ topic-ல
❌ concept-ஐ

The problem is that TTS may pronounce the English word first and then separately pronounce:
"ஐ", "இல்", "ல", "க்கு", "ன்", "ம்".
This creates unnatural speech.

When an English technical word needs a native grammatical relationship, REWRITE THE ENTIRE SENTENCE so that the native suffix does not need to be attached directly to the English word.
Do NOT simply remove the suffix and leave the sentence grammatically broken. Rewrite the sentence naturally.

Examples:
❌ "இந்த part-ஐ கொஞ்சம் கவனமா பாப்போம்."
✅ "இப்போ இந்த part பற்றி கொஞ்சம் கவனமா பார்ப்போம்." (or) "இப்போ இந்த part எப்படி work ஆகுதுன்னு பார்ப்போம்."

❌ "இதை ஒரு example-ல பாப்போம்."
✅ "இப்போ ஒரு example எடுத்துப் பாப்போம்." (or) "இப்போ ஒரு example மூலம் புரிஞ்சுக்கலாம்."

❌ "இந்த code-ஐ run பண்ணலாம்."
✅ "இப்போ இந்த code எப்படி run ஆகுதுன்னு பாப்போம்."

❌ "இந்த function-க்கு ஒரு value கொடுக்கணும்."
✅ "இந்த function ஒரு value-ஐ input-ஆ எடுத்துக்கொள்ளும்."

Never intentionally create speech such as:
❌ "part... ஐ"
❌ "example... ல"
❌ "function... க்கு"

Never output a standalone Tamil/native suffix or particle. Every grammatical unit must belong naturally to a complete spoken phrase.
The priority is NATURAL TTS PRONUNCIATION, not preserving the original sentence structure.

Instead of: [English technical word + Tamil suffix]
prefer: [Tamil sentence restructuring + English technical word].

❌ "இந்த concept-ஐ explain பண்ணலாம்."
✅ "இந்த concept எப்படி work ஆகுதுன்னு explain பண்ணலாம்."

==================================================
4. CODE AND SCREEN CONTENT
==========================

NEVER change source code.

NEVER translate:

* Variable names
* Function names
* Class names
* Method names
* File names
* Programming keywords
* Commands
* URLs
* API endpoints
* Package names
* Library names
* Code blocks

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
=========================================

The speech narration must NEVER contain decorative emojis or symbols.

Remove all emojis from speech.

Examples:

😀
😃
😂
🚀
🔥
🎯
✨
👍
💡
❌
✅

These must NEVER be sent to the TTS engine.

Do not verbally pronounce decorative symbols.

For example:

❌ "Great! 🚀"

Output:

"Great!"

If the narration contains:

❌ "Class → Object"

Convert it to natural speech:

"Class and Object"

If a technical symbol is important to the explanation, convert it into natural spoken words.

Examples:

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
===========================

A symbol may remain on the SCREEN but should not automatically appear in SPEECH.

Example:

SCREEN:

Class → Object

SPEECH:

"Class and Object."

Example:

SCREEN:

factorial(5)

SPEECH:

"இங்க factorial function-க்கு five-ஐ pass பண்ணுறோம்."

The screen and speech are separate outputs.

Never copy visual formatting into the narration.

==================================================
7. MARKDOWN AND FORMATTING
==========================

Never send these to TTS:

**
*
#
## \`
HTML tags
Markdown bullets
Markdown links
Decorative separators
UI formatting

Convert the underlying meaning into natural speech when necessary.

==================================================
8. PRONUNCIATION AND TTS
========================

The narration will be converted to speech using TTS.

Therefore:

* Use natural sentence structures.
* Avoid unnecessarily long sentences.
* Use punctuation for natural pauses.
* Avoid awkward sentence structures.
* Avoid unnecessary symbols.
* Avoid emojis.
* Avoid Romanized words.
* Keep English technical terms recognizable.
* Do not write pronunciation instructions.
* Do not write IPA.
* Do not add translator notes.
* Do not add explanations about the translation.

The final narration should sound like natural human teaching, not like a screen reader.

==================================================
9. PRESERVE MEANING
===================

Preserve the original English lesson meaning.

Do NOT perform word-by-word translation.

You may restructure sentences to make them natural for the target language.

The objective is:

English lesson meaning
↓
Modern technical screen content

AND

English narration meaning
↓
Natural conversational target-language speech
↓
TTS-friendly narration

==================================================
10. IMPORTANT SEPARATION RULE
=============================

NEVER apply the conversational speech rules to the screen content.

NEVER apply the screen-content translation style to the speech.

SCREEN CONTENT:

Modern + technical + concise + English technical terminology + target-language explanation.

SPEECH NARRATION:

Natural + conversational + native Unicode + English technical terminology + TTS-friendly.

The two outputs must be generated independently.

==================================================
11. FINAL QUALITY CHECK
=======================

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
11. Are common technical terms kept in English?
12. Are all emojis removed?
13. Are unnecessary symbols removed?
14. Is programming punctuation NOT being read literally?
15. Is code explained naturally instead of being read character-by-character?
16. Is the narration suitable for TTS?
17. Is the original meaning preserved?

If the screen content sounds too pure/formal, rewrite it into modern technical educational language.
If the narration sounds too formal, rewrite it into natural conversational classroom speech.
If the narration contains emojis or unnecessary symbols, remove them before returning it.

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
    
    // Clean JSON response if wrapped in markdown and remove trailing commas
    let cleanedText = translatedJsonText.replace(/^\`\`\`json\s*/gi, '').replace(/\s*\`\`\`$/gi, '');
    
    // Fix trailing commas before closing braces/brackets (common LLM JSON error)
    cleanedText = cleanedText.replace(/,\s*([}\]])/g, '$1');
    
    const translatedSlides = JSON.parse(cleanedText);

    // Process slide narration for TTS if target language is Tamil
    if (Array.isArray(translatedSlides) && targetLanguageName.toLowerCase() === 'tamil') {
      for (const slide of translatedSlides) {
        if (slide && slide.narration) {
          slide.narration = await processNarrationForTTS(slide.narration, targetLanguageName);
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
 * Validates text for TTS issues, specifically targeting Tamil mixed-language suffix patterns
 * and general formatting noise.
 */
const validateTTSInput = (text) => {
  if (!text || typeof text !== 'string') return { hasIssues: false, issues: [] };

  const issues = [];

  // 1. Mixed language suffix pattern checks (Tamil specific)
  const hyphenatedSuffix = /[A-Za-z0-9]+-[\u0B80-\u0BFF]+/u;
  const adjacentSuffix = /[A-Za-z0-9]+[\u0B80-\u0BFF]+/u;
  const isolatedParticle = /\b[A-Za-z0-9]+\s+[\u0B80-\u0BFF]{1,3}(?=\s|[.,!?]|$)/u;

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

  // 4. Underscores in identifiers (e.g., user_name -> user name)
  cleaned = cleaned.replace(/([a-zA-Z0-9]+)_([a-zA-Z0-9]+)/g, '$1 $2');

  // 5. Template literal syntax `${variable}` -> `variable`
  cleaned = cleaned.replace(/\$\{\s*([a-zA-Z0-9_]+)\s*\}/g, '$1');

  // 6. Strip programming enclosure punctuation from speech
  // Parentheses, brackets, braces, backticks, quotes around code terms
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
 * Tamil-only Gemini cleanup assistant to rewrite narration so suffixes aren't attached to Latin words.
 */
const normalizeNarrationForTTS = async (text, attemptNumber = 1, previousIssues = []) => {
  const cacheKey = `tamil:${text}`;
  if (attemptNumber === 1 && normalizationCache.has(cacheKey)) {
    return normalizationCache.get(cacheKey);
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

  let strictInstruction = '';
  if (previousIssues.length > 0) {
    strictInstruction = `\nCRITICAL FIX REQUIRED: The previous output still contained the following issues: ${previousIssues.join(', ')}. FIX SPECIFICALLY THAT. Ensure NO Latin technical word has a Tamil suffix attached to it directly or via hyphen, remove any isolated suffix/particle or emoji, and ensure NO programming syntax or code punctuation is read literally.`;
  }

  const prompt = `
You are a pronunciation and Text-to-Speech (TTS) normalization assistant for Tamil educational narration.

Your task is to rewrite the following Tamil speech narration so it is 100% TTS-friendly without changing its technical meaning.

RULES:
1. Preserve the original meaning exactly.
2. Keep common English technical terms in English script (e.g. function, class, object, variable, method, API, database, component, React, Node.js, code, etc.).
3. NEVER attach Tamil grammatical suffixes directly to English technical words (e.g., NEVER use "function-ஐ", "code-ஐ", "functionஐ", "variable-ல", "class-க்கு").
4. If an English technical word needs a native grammatical relationship, REWRITE THE ENTIRE SENTENCE naturally so that the native suffix is not attached directly to the English word.
5. NEVER produce isolated Tamil suffixes or particles (like standalone "ஐ", "ல", "க்கு").
6. NEVER produce grammatically broken output or Romanized Tanglish.
7. Remove all emojis, markdown symbols, decorative arrows, and NEVER read programming punctuation literally (no "open bracket", "close parenthesis", "underscore", "semicolon", "colon", etc.). Explain code naturally.
8. Return ONLY the normalized Tamil narration text. Do NOT include markdown code blocks, JSON, notes, SSML, or explanations.
${strictInstruction}

Narration to normalize:
"${text}"
  `.trim();

  try {
    const result = await client.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    let normalized = result.text?.trim() || '';
    if (normalized.startsWith('"') && normalized.endsWith('"')) {
      normalized = normalized.slice(1, -1);
    }
    normalized = cleanTextForTTS(normalized);

    // Re-validation guard
    const validation = validateTTSInput(normalized);
    if (!validation.hasIssues) {
      if (attemptNumber === 1) {
        normalizationCache.set(cacheKey, normalized);
      }
      return normalized;
    }

    if (attemptNumber === 1) {
      console.warn(`[TTS Cleanup] Re-validation failed on 1st attempt. Issues: ${validation.issues.join(', ')}. Retrying once...`);
      return await normalizeNarrationForTTS(text, 2, validation.issues);
    }

    console.warn(`[TTS Cleanup] Re-validation failed after retry. Issues remaining: ${validation.issues.join(', ')}. Falling back to original.`);
    return cleanTextForTTS(text);
  } catch (err) {
    console.warn(`[TTS Cleanup] Gemini normalization failed: ${err.message}. Falling back to cleanTextForTTS.`);
    return cleanTextForTTS(text);
  }
};

/**
 * Pipeline helper to process narration for TTS across all target languages.
 */
const processNarrationForTTS = async (translatedText, targetLanguageName = 'English') => {
  if (!translatedText) {
    return translatedText;
  }

  const isTamil = targetLanguageName && targetLanguageName.toLowerCase() === 'tamil';
  const validation = validateTTSInput(translatedText);

  let ttsText = translatedText;
  if (isTamil && validation.hasIssues) {
    console.log(`[TTS Validation] Issues detected for ${targetLanguageName}: ${validation.issues.join(', ')}`);
    console.log(`Original narration: ${translatedText}`);

    try {
      ttsText = await normalizeNarrationForTTS(translatedText);
      console.log(`After Tamil TTS cleanup: ${ttsText}`);
    } catch (error) {
      console.warn('[TTS Cleanup] Failed, using original narration:', error.message);
      ttsText = translatedText;
    }
  }

  ttsText = cleanTextForTTS(ttsText);
  return ttsText;
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