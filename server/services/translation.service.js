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