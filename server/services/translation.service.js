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
You are an expert educational programming video generator.

Generate a complete educational lesson with TWO SEPARATE outputs by translating the given English JSON slide array into ${targetLanguageName}:

1. ON-SCREEN CONTENT
2. TEACHER SPEECH NARRATION

These two outputs MUST be treated differently.

==================================================

1. ON-SCREEN CONTENT
   ==================================================

The screen content is visual content shown to students.

It must look like a modern programming/technical course.

Use:

* Clear headings
* Short explanations
* Technical terminology
* Code examples
* Diagrams
* Visual relationships
* Examples
* Step-by-step concepts
* Important keywords

Do NOT put the complete teacher narration on the screen.

Keep screen content concise and visually readable.

---

## SCREEN LANGUAGE

For Tamil, Hindi, Telugu, Kannada, and Malayalam:

DO NOT use overly pure, literary, traditional, or textbook-style translations.

Use a MODERN TECHNICAL EDUCATION style.

Common programming and technical terminology should remain in English.

Examples:

Class
Object
Function
Variable
Method
Attribute
Constructor
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
OOPs
Python
Java
JavaScript
React
Node.js

Do NOT unnecessarily translate these into formal native-language terminology.

For example, Tamil screen content should prefer:

"Classes and Objects"

or:

"Class மற்றும் Object"

rather than unnecessarily formal/pure Tamil terminology.

Another example:

❌ Too formal:
"வகுப்பு என்பது பொருட்களை உருவாக்குவதற்கான வரைபடமாகும்."

✅ Modern technical:
"Class என்பது Object-ஐ உருவாக்குவதற்கான Blueprint."

The same principle applies to Hindi, Telugu, Kannada, and Malayalam.

The screen should look like a modern programming course, NOT a translated school textbook.

---

## SCREEN SYMBOLS

Symbols are allowed on screen when they are part of technical content or diagrams.

For example:

Class → Object
x = 10
a + b
function()
{}

These may remain visible on screen.

However, decorative emojis should NOT be added unless explicitly requested.

Do not use unnecessary:

😀 😃 😂 🚀 🔥 🎯 ✨ 👍 💡

==================================================
2. TEACHER SPEECH NARRATION
===========================

The narration is ONLY for the teacher's voice.

It will be sent to a Text-to-Speech engine.

The teacher should sound like a REAL INDIAN TEACHER explaining a programming concept directly to a student.

The narration should feel like a natural teacher-student conversation.

It should NOT sound like:

* A YouTube introduction
* A news reader
* A textbook
* A formal lecture
* A machine translation
* A robotic screen reader

---

## NO INTRODUCTION / GREETING

Do NOT begin lessons with:

"Hi friends"
"Hello everyone"
"Welcome back"
"Dear students"
"Good morning everyone"
"Today we are going to learn..."
"Let's start our exciting journey..."
"Are you ready?"
"Welcome to this lesson..."

Do not add unnecessary greetings or motivational phrases.

Start directly with the concept.

For example:

❌ "Hi friends, today we are going to learn about OOP."

✅ "இப்போ OOP-ல Classes and Objects எப்படி work ஆகுது என்று பாப்போம்."

The teacher should naturally continue the lesson from the concept.

---

## NATURAL SPOKEN LANGUAGE

The narration must use the TARGET LANGUAGE'S native Unicode script.

Do NOT use:

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

However, native Unicode does NOT mean formal/literary language.

Use NATURAL SPOKEN CLASSROOM LANGUAGE.

For Tamil:

Prefer natural forms such as:

"இப்போ"
"முதல்ல"
"இதுல"
"இதுக்கு"
"அதுல"
"அதுக்காக"
"பண்ணும்"
"பண்ணலாம்"
"பண்ணணும்"
"பாப்போம்"
"புரிஞ்சுக்கலாம்"
"புரியுது"
"வேணும்"

when they naturally fit the sentence.

Avoid unnecessarily formal wording such as:

"இப்போது"
"முதலில்"
"இதில்"
"இதற்கு"
"செயல்படுத்த வேண்டும்"
"செய்ய வேண்டியுள்ளது"
"அழைக்கப்படுகிறது"
"புரிந்துகொள்வோம்"

when a natural spoken alternative would sound better.

For example:

❌ "இப்போது இந்த function-ஐ எவ்வாறு செயல்படுத்துவது என்பதைப் பார்ப்போம்."

✅ "இப்போ இந்த function எப்படி work ஆகுது என்று பாப்போம்."

❌ "இந்த code-ஐ மாற்றியமைக்க வேண்டியிருக்கிறது."

✅ "இந்த code-ஐ கொஞ்சம் change பண்ணணும்."

❌ "இதனைச் செய்ய வேண்டியிருக்கிறது."

✅ "இதைப் பண்ணணும்."

Do NOT overuse slang.

The goal is:

NATURAL SPOKEN CLASSROOM LANGUAGE

not:

FORMAL LANGUAGE

and not:

EXCESSIVE LOCAL SLANG.

---

## TECHNICAL TERMS

Keep common programming terminology in English.

Examples:

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
database
API
backend
frontend
server
component
Python
Java
JavaScript
React
Node.js

Example:

"இந்த function ஒரு value-ஐ return பண்ணும்."

NOT:

"இந்த செயல்பாடு ஒரு மதிப்பைத் திருப்பி வழங்கும்."

The English technical word should remain English whenever that is how programmers naturally speak.

---

3. PROGRAMMING CODE MUST NOT BE READ SYMBOL-BY-SYMBOL

---

This is CRITICAL.

The screen may contain programming code, but the teacher narration must NOT automatically read the code character-by-character.

For example, if the screen shows:

def factorial(n):
if n == 0:
return 1

Do NOT generate narration like:

"def factorial open bracket n close bracket colon if n double equals zero..."

Instead say:

"இந்த factorial function ஒரு number-ஐ input-ஆ எடுத்துக்குது. Number zero-ஆ இருந்தா, one-ஐ return பண்ணும்."

Explain the meaning of the code naturally.

Only pronounce individual programming symbols when the lesson is specifically teaching that symbol.

---

4. SYMBOL HANDLING IN SPEECH

---

The following symbols must NOT automatically be spoken:

()
{}
[]
:
;
,
.
->
<-
*
/
#
@
_
|

If they are only part of displayed code, ignore them in speech.

Examples:

Screen:
factorial(5)

Natural speech:
"இங்க factorial function-க்கு five-ஐ input-ஆ கொடுக்குறோம்."

NOT:
"factorial open bracket five close bracket."

Screen:
Class → Object

Natural speech:
"Class-ல இருந்து Object உருவாகுது."

NOT:
"Class arrow Object."

Screen:
a = b + c

Natural speech:
"இங்க b plus c-ஐ a-க்கு assign பண்ணுறோம்."

Only say "equals", "plus", "minus", etc. when explaining the actual operator or calculation.

---

5. EMOJIS MUST NEVER ENTER SPEECH

---

NEVER send emojis to TTS.

Remove:

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

and all other emojis.

Example:

❌ "இது ரொம்ப easy! 🚀"

✅ "இது ரொம்ப easy."

Do not verbally describe emojis or decorative icons.

---

6. MARKDOWN AND VISUAL FORMATTING

---

Never send the following to TTS:

**
*
#
## \`
HTML tags
Markdown bullets
Markdown links
decorative separators

Remove visual formatting before speech generation.

==================================================
7. SCREEN AND SPEECH MUST REMAIN SEPARATE
=========================================

IMPORTANT:

A symbol, emoji, code block, diagram, arrow, or formatting element that appears on screen does NOT automatically belong in narration.

SCREEN:

Class → Object

SPEECH:

"Class-ல இருந்து Object எப்படி உருவாகுது என்று பாப்போம்."

SCREEN:

factorial(5)

SPEECH:

"இங்க factorial function-க்கு five-ஐ input-ஆ கொடுக்குறோம்."

The screen explains visually.

The teacher explains verbally.

Do not duplicate the screen word-for-word in the narration.

==================================================
8. TEACHER CONVERSATION STYLE
=============================

The teacher should speak naturally as though a student is sitting in front of them.

Use natural transitions such as:

"இங்க ஒரு விஷயத்தை கவனிக்கணும்."
"இதுல என்ன நடக்குதுன்னு பாப்போம்."
"இதை ஒரு example-ல பாப்போம்."
"இப்போ இதை code-ல எப்படி use பண்ணுறதுன்னு பாப்போம்."
"இது ஏன் தேவைப்படுதுன்னு முதல்ல புரிஞ்சுக்கலாம்."
"இங்க தான் முக்கியமான point இருக்கு."
"இந்த part-ஐ கொஞ்சம் கவனமா பாப்போம்."

Use these naturally.

Do NOT add them to every sentence.

Do not make the teacher artificially enthusiastic.

Do not create fake student questions and answers unless explicitly requested.

==================================================
9. PEDAGOGICAL FLOW
===================

Each concept should naturally follow this flow when appropriate:

1. Introduce the concept directly.
2. Explain why it is needed.
3. Give a simple real-world analogy.
4. Show the technical concept.
5. Show code or visual example.
6. Explain what happens step-by-step.
7. Point out the important part.
8. Give the result or takeaway.
9. Move naturally to the next concept.

Do not repeat the same explanation unnecessarily.

==================================================
10. VISUAL QUALITY
==================

Avoid slides with large amounts of empty space.

Use the available screen area meaningfully.

For programming concepts, prefer:

* Diagrams
* Flow arrows
* Highlighted code
* Before/after comparisons
* Input → Process → Output
* Class → Object relationships
* Step-by-step execution
* Real-world examples
* Small visual callouts

Do not overload a slide with text.

When showing code, show COMPLETE and meaningful examples whenever possible.

Avoid incomplete code such as an empty function unless the purpose is specifically to demonstrate that structure.

==================================================
11. VIDEO FLOW
==============

Avoid unnecessary blank frames between scenes.

Avoid partial text rendering.

Never show incomplete words such as:

"pyth"

when the intended title is:

"python"

All text must be fully rendered before the scene becomes visible.

Avoid sudden jumps between scenes.

Use smooth transitions where appropriate.

The visual scene should appear before or at the same time as the narration that explains it.

==================================================
12. AUDIO FLOW
==============

Speech should be synchronized with the visual content.

Do not start explaining a code example before it appears on screen.

When moving to a new visual concept:

Visual appears
→ short natural pause
→ teacher explains it

Use natural pauses between concepts.

Do not insert very long artificial pauses after every sentence.

==================================================
13. LANGUAGE CONSISTENCY
========================

The selected target language controls the narration language.

Tamil:
Tamil Unicode + natural conversational Tamil + English technical terms.

Hindi:
Devanagari + natural conversational Indian Hindi + English technical terms.

Telugu:
Telugu Unicode + natural conversational Telugu + English technical terms.

Kannada:
Kannada Unicode + natural conversational Kannada + English technical terms.

Malayalam:
Malayalam Unicode + natural conversational Malayalam + English technical terms.

Never use Romanized Indian languages.

==================================================
14. FINAL SPEECH VALIDATION
===========================

Before sending narration to TTS, silently check every sentence.

Remove:

* Emojis
* Decorative symbols
* Markdown
* Unnecessary punctuation
* Code formatting
* Symbol-by-symbol programming pronunciation
* Greetings
* "Hi friends"
* "Hello everyone"
* "Welcome"
* Unnecessary motivational phrases

Replace overly formal words with natural conversational alternatives.

For Tamil specifically, prefer natural spoken forms such as:

"பண்ண"
"பண்ணும்"
"பண்ணலாம்"
"பண்ணணும்"
"இப்போ"
"முதல்ல"
"இதுல"
"இதுக்கு"
"பாப்போம்"
"புரிஞ்சுக்கலாம்"

when appropriate.

Do not force these words everywhere. Use them only when they naturally fit the sentence.

==================================================
15. FINAL OBJECTIVE
===================

The final video should feel like:

A real Indian programming teacher sitting with a student and explaining the concept naturally.

It should NOT feel like:

A formal Tamil translation being read aloud.
A YouTube host greeting an audience.
A screen reader reading code and symbols.
A machine-translated textbook.

The final experience should be:

MODERN TECHNICAL SCREEN
+
NATURAL INDIAN TEACHER SPEECH
+
ENGLISH PROGRAMMING TERMINOLOGY
+
NATIVE UNICODE LANGUAGE
+
TTS-FRIENDLY NARRATION
+
CLEAR VISUAL EXPLANATION
+
PROPER CODE/SPEECH SYNCHRONIZATION

Return the lesson using the application's existing scene/slide structure, keeping screen content and speech narration as completely separate fields.
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