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

Generate a complete programming lesson with TWO SEPARATE outputs by translating the given English JSON slide array into ${targetLanguageName}:

1. SCREEN CONTENT
2. TEACHER SPEECH NARRATION

These two outputs MUST follow different rules.

==================================================

1. NATURAL TEACHER SPEECH
   ==================================================

The narration should sound like a real Indian programming teacher talking directly to a student.

Do NOT use:

* "Hi friends"
* "Hello everyone"
* "Welcome"
* "Welcome back"
* "Dear students"
* "Today we are going to learn..."
* Artificial motivational introductions
* YouTube-style introductions

Start directly with the concept.

Use natural conversational language.

For Tamil, use conversational Tamil in Tamil Unicode.

Do not use Tanglish.

Do not use overly pure or literary Tamil.

Do not make the speech unnecessarily formal.

==================================================
2. ENGLISH TECHNICAL WORDS + NATIVE SUFFIXES
============================================

IMPORTANT:

English technical words MAY naturally take native-language grammatical suffixes when required by the sentence.

For example, in Tamil, these constructions are allowed:

"code-ஐ"
"function-க்கு"
"example-ல"
"class-ல"
"object-ஐ"
"variable-க்கு"
"result-ஆ"
"part-ஐ"

Do NOT remove these suffixes merely because they are attached to English words.

For example, this is acceptable:

"result one-ஆ இருக்கும்."

This is also acceptable:

"இந்த code-ஐ இப்போ run பண்ணிப் பார்ப்போம்."

However, the CRITICAL requirement is:

THE ENGLISH WORD AND THE NATIVE-LANGUAGE SUFFIX MUST BE SPOKEN AS ONE CONTINUOUS PHONETIC UNIT.

Do NOT create an artificial pause between them.

Correct pronunciation:

"one-ஆ"

should sound continuously as one phrase.

Incorrect:

"one ... ஆ"

Incorrect:

"one [pause] ஆ"

Incorrect:

"one" followed by a separately generated "ஆ" audio segment.

The same applies to:

"code-ஐ"
"function-க்கு"
"example-ல"
"result-ஆ"

The suffix must naturally connect to the preceding English word.

==================================================
3. TTS CONTINUITY
=================

The narration must NOT sound like separate language pieces stitched together.

Avoid unnecessary TTS segmentation inside a phrase.

For example:

❌ "result" + pause + "one" + pause + "ஆ" + "இருக்கும்"

Preferred continuous speech:

✅ "result one-ஆ இருக்கும்."

Do not create a separate audio segment for the native-language suffix.

The complete phrase should be sent to TTS together whenever possible.

==================================================
4. DO NOT SPLIT MIXED-LANGUAGE WORDS
====================================

Never split a mixed-language grammatical unit into separate TTS chunks.

For example:

\`one-ஆ\`

must remain together.

\`code-ஐ\`

must remain together.

\`example-ல\`

must remain together.

\`function-க்கு\`

must remain together.

Do NOT process them as:

\`one\` → TTS

then:

\`ஆ\` → TTS

Instead, process:

\`one-ஆ\` → TTS

as one continuous input.

==================================================
5. TAMIL EXAMPLES
=================

Preferred:

"result one-ஆ இருக்கும்."

"இந்த code-ஐ run பண்ணிப் பார்ப்போம்."

"இந்த function-க்கு ஒரு input கொடுக்குறோம்."

"இந்த example-ல என்ன நடக்குதுன்னு பாப்போம்."

"இந்த class-ல object create பண்ணுறோம்."

"இந்த variable-க்கு value assign பண்ணுறோம்."

The English word and Tamil suffix should flow continuously.

Do NOT intentionally insert a pause between:

one + ஆ
code + ஐ
function + க்கு
example + ல
class + ல
variable + க்கு

==================================================
6. OTHER LANGUAGES
==================

Apply the same principle to Hindi, Telugu, Kannada, and Malayalam.

When an English technical term naturally receives a grammatical ending in the target language:

* Keep the grammatical ending.
* Do not remove it.
* Do not translate the technical term.
* Do not separate it into another TTS segment.
* Pronounce the complete construction continuously.

The exact native-language grammar should remain natural for the target language.

==================================================
7. PROGRAMMING SYMBOLS
======================

Do not automatically read programming symbols appearing on screen.

If a symbol needs to be spoken, use its ENGLISH name in every language.

Examples:

* → plus
- → minus
= → equals
== → double equals
=== → triple equals
!= → not equals
> → greater than
< → less than
>= → greater than or equal to
<= → less than or equal to
-> → arrow
=> → arrow function
&& → AND
|| → OR
! → NOT
++ → increment
-- → decrement
% → modulo

Do not translate these symbol names into Tamil, Hindi, Telugu, Kannada, or Malayalam.

If the symbol is not relevant to the explanation, do not speak it.

==================================================
8. CODE MUST NOT BE READ CHARACTER-BY-CHARACTER
===============================================

Do not read code syntax character-by-character unless the lesson is specifically teaching that syntax.

For example:

Screen:

\`\`\`python
if (n == 0) {
return 1;
}
\`\`\`

Natural narration:

"Number zero-ஆ இருந்தா, one return பண்ணும்."

Do NOT say:

"if open bracket n double equals zero close bracket..."

unless specifically teaching the syntax.

==================================================
9. EMOJIS AND DECORATIVE SYMBOLS
================================

NEVER send emojis to TTS.

Remove:

😀
😂
🚀
🔥
🎯
✨
👍
💡
❌
✅

Do not pronounce decorative symbols.

Screen content may contain appropriate visual symbols, but they must not automatically enter speech.

==================================================
10. NO BROKEN WORDS
===================

Never create isolated or broken words because of translation or TTS segmentation.

Do not generate unnatural fragments such as:

"இ"
"இல்"
"ல"
"ஆ"
"க்கு"
"ஐ"

as separate narration units.

If a grammatical suffix is required, keep it attached to the complete spoken phrase.

For example:

Correct:

"one-ஆ இருக்கும்."

Incorrect:

"one"
"ஆ"
"இருக்கும்."

==================================================
11. NARRATION SEGMENTATION
==========================

This is extremely important for the audio generation system.

Do NOT split narration at language boundaries.

Do NOT split English words and native-language suffixes into separate audio files.

Do NOT create separate TTS requests for:

English word
+
native suffix

Instead, generate the complete sentence or complete natural phrase in a single TTS request whenever possible.

For example:

Input to TTS:

"result one-ஆ இருக்கும்."

NOT:

TTS 1: "result one"
TTS 2: "ஆ"
TTS 3: "இருக்கும்"

Similarly:

Input to TTS:

"இந்த code-ஐ இப்போ run பண்ணிப் பார்ப்போம்."

NOT:

TTS 1: "code"
TTS 2: "ஐ"
TTS 3: "இப்போ run..."

==================================================
12. NATURAL PAUSES
==================

Only pause at natural sentence or thought boundaries.

Do not insert pauses:

* Between English word and native suffix
* Between technical term and its grammatical ending
* Between connected words
* In the middle of a phrase

Use pauses only between complete thoughts.

Example:

"இப்போ இந்த code run பண்ணிப் பார்ப்போம். [short pause] அதுக்கப்புறம் result என்ன வருதுன்னு பாப்போம்."

NOT:

"இந்த code... ஐ... run..."

==================================================
13. SCREEN CONTENT
==================

Screen content follows a separate rule.

Use modern technical language.

Do not make screen content overly pure Tamil/Hindi/Telugu/Kannada/Malayalam.

Keep common programming terminology in English.

Examples:

Class
Object
Function
Variable
Method
Constructor
Recursion
Loop
Array
API
Database
Backend
Frontend
Python
Java
JavaScript

Screen content should be concise and professional.

==================================================
14. FINAL QUALITY CHECK
=======================

Before returning narration, verify:

1. No "Hi friends".
2. No unnecessary greetings.
3. No YouTube-style introduction.
4. No Tanglish/Hinglish/Tenglish/Kanglish/Manglish.
5. Native Unicode is used.
6. Natural conversational teacher language is used.
7. Common technical terms remain in English.
8. English technical words may have natural native-language grammatical suffixes.
9. English word + native suffix must be treated as ONE continuous spoken unit.
10. Never create a separate TTS segment for the suffix.
11. No artificial pause between English word and suffix.
12. No isolated native-language fragments.
13. No emojis in speech.
14. No decorative symbols in speech.
15. Programming symbols use English names when they must be spoken.
16. Code is not read character-by-character.
17. Speech sounds like one continuous natural teacher conversation.
18. Meaning is preserved.

The most important requirement is:

ENGLISH WORD + NATIVE SUFFIX = ONE CONTINUOUS SPOKEN UNIT.

Example:

"one-ஆ"

must be spoken continuously, not:

"one ... ஆ"

==================================================
15. FINAL OUTPUT FORMAT
=======================

Keep SCREEN CONTENT and SPEECH NARRATION as separate fields.

Never apply speech rules to screen content.
Never automatically copy screen symbols, emojis, formatting, or code into speech.

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