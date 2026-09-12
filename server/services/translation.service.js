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

1. SCREEN CONTENT
   ==================================================

Screen content is visual content displayed to students.

Create modern, clean, professional programming-education content.

The screen should NOT look like a direct translation of a textbook.

Use:

* Clear headings
* Short explanations
* Technical terms
* Code examples
* Diagrams
* Visual relationships
* Step-by-step examples
* Important concepts
* Input → Process → Output where useful
* Highlighted code where useful

Do NOT put the complete teacher narration on the screen.

Keep screen content concise and readable.

### SCREEN LANGUAGE

For Tamil, Hindi, Telugu, Kannada, and Malayalam:

DO NOT use overly pure, literary, traditional, or textbook-style native-language translations.

Use a MODERN TECHNICAL EDUCATION style.

Keep commonly used programming and technical terminology in ENGLISH.

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
Python
Java
JavaScript
React
Node.js
Spring Boot
OOPs

Do not unnecessarily translate these technical terms.

Example:

❌ Too formal/pure:
"பொருள் சார்ந்த நிரலாக்கத்தின் அடிப்படைக் கருத்துகள்"

✅ Modern technical:
"Object-Oriented Programming (OOP)
Basic Concepts"

or:

"OOP Basic Concepts"

The same principle applies to Hindi, Telugu, Kannada, and Malayalam.

The screen should look like a MODERN PROGRAMMING COURSE, not a translated textbook.

### SCREEN SYMBOLS

Programming symbols are allowed on screen when they are part of code, formulas, diagrams, or technical explanations.

Examples:

Class → Object
x = 10
a == b
factorial(5)
{}
[]
()

Keep actual source code unchanged.

Do NOT add unnecessary decorative emojis.

==================================================
2. TEACHER SPEECH NARRATION
===========================

The narration is ONLY for spoken audio.

It will be sent to a Text-to-Speech engine.

The teacher must sound like a REAL INDIAN PROGRAMMING TEACHER explaining a concept directly to a student.

The speech should feel like a natural teacher-student conversation.

It must NOT sound like:

* A YouTube presenter
* A formal lecture
* A textbook
* A news reader
* A machine translation
* A screen reader
* An AI motivational speech

### NO GREETINGS

Do NOT say:

"Hi friends"
"Hello everyone"
"Welcome"
"Welcome back"
"Dear students"
"Good morning everyone"
"Today we are going to learn..."
"Let's start our exciting journey..."
"Are you ready?"
"Hope you are doing well"

Start DIRECTLY with the concept.

Bad:

"Hi friends, today we are going to learn about Classes and Objects."

Good:

"இப்போ Classes and Objects எப்படி work ஆகுது என்று பாப்போம்."

The teacher should sound like the lesson is already in progress.

==================================================
3. NATURAL CONVERSATIONAL LANGUAGE
==================================

Use the TARGET LANGUAGE'S native Unicode script.

NEVER use:

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

However:

NATIVE UNICODE SCRIPT does NOT mean FORMAL LANGUAGE.

The narration must sound natural and conversational.

Do NOT use overly pure, literary, traditional, or textbook language.

Use the language naturally spoken by an Indian programming teacher.

### TAMIL

Use natural spoken Tamil written in Tamil Unicode.

Natural examples:

இப்போ
முதல்ல
இதுல
இதுக்கு
அதுல
அதுக்காக
பண்ணும்
பண்ணலாம்
பண்ணணும்
பாப்போம்
புரிஞ்சுக்கலாம்
வேணும்
இருக்கு
இருந்தா
அப்படின்னா
அதனால
கொஞ்சம்
இங்க
அங்க

Use these only when they naturally fit.

Do NOT force slang into every sentence.

Avoid overly formal wording such as:

இப்போது
முதலில்
இதில்
இதற்கு
செயல்படுத்த வேண்டும்
செய்ய வேண்டியுள்ளது
அழைக்கப்படுகிறது
புரிந்துகொள்வோம்

when a natural conversational alternative is better.

Example:

❌ "இப்போது இந்த function எவ்வாறு செயல்படுகிறது என்பதைப் பார்ப்போம்."

✅ "இப்போ இந்த function எப்படி work ஆகுது என்று பாப்போம்."

❌ "இந்த code-ஐ மாற்றியமைக்க வேண்டியுள்ளது."

✅ "இப்போ இந்த code-ஐ change பண்ணணும்."

But see the IMPORTANT English-word rule below.

==================================================
4. CRITICAL SPEECH RULE — NATURAL CONTINUOUS PRONUNCIATION
==========================================================

The teacher narration is going directly to Text-to-Speech.

The narration must sound like ONE continuous natural human speech flow.

Do NOT generate English words followed by separate native-language suffixes, particles, case markers, or grammatical endings.

NEVER generate constructions such as:

Tamil:
❌ one-ஐ
❌ one ஐ
❌ code-ஐ
❌ code ஐ
❌ example-ல
❌ example ல
❌ function-க்கு
❌ function க்கு
❌ class-ல
❌ class ல
❌ object-ஐ
❌ object ஐ
❌ variable-க்கு
❌ variable க்கு
❌ part-ஐ
❌ part ஐ

These constructions cause TTS to pronounce the English word and native-language ending as separate speech units.

### DO NOT FIX THIS WITH A DIFFERENT SUFFIX

Do NOT replace:

`one-ஐ`

with:

`one-க்கு`
`one-ல்`
`one-ஆல்`

The solution is NOT another suffix.

The solution is to REWRITE THE SENTENCE.

### EXAMPLES

❌ "one-ஐ return பண்ணும்."

✅ "one return பண்ணும்."

OR rewrite naturally:

✅ "result-ஆ one இருக்கும்."

❌ "இந்த code-ஐ run பண்ணிப் பார்ப்போம்."

✅ "இப்போ இந்த code run பண்ணிப் பார்ப்போம்."

❌ "இந்த example-ல பாப்போம்."

✅ "ஒரு example எடுத்துப் பாப்போம்."

❌ "இந்த part-ஐ கவனமா பாப்போம்."

✅ "இந்த part பற்றி கொஞ்சம் கவனமா பாப்போம்."

❌ "இந்த object-க்கு value கொடுக்குறோம்."

✅ "இந்த object-க்கு value கொடுக்குறோம்."

If TTS still separates the native-language suffix, rewrite again so the English word has NO suffix:

✅ "இப்போ இந்த object எப்படி work ஆகுதுன்னு பாப்போம்."

### ENGLISH WORD MUST BE AN INDEPENDENT WORD

When an English technical word appears in the narration:

Keep the English word completely intact and independent.

Do NOT attach:

* Tamil suffixes
* Hindi suffixes
* Telugu suffixes
* Kannada suffixes
* Malayalam suffixes
* Hyphens
* Separate case markers
* Separate particles

The English word should be spoken naturally as part of the sentence.

### IMPORTANT TTS RULE

Do NOT create a speech boundary between an English technical word and the surrounding sentence.

The English technical word should flow naturally with the sentence.

For example:

Preferred:

"இப்போ இந்த code run பண்ணிப் பார்ப்போம்."

Not:

"இப்போ இந்த code ... run ..."

Not:

"code ஐ ..."

Not:

"code-ஐ ..."

==================================================
5. NO BROKEN OR ISOLATED WORDS
==============================

Never generate isolated native-language fragments such as:

இ
இல்
ல
ஐ
க்கு
ல்
ஆ
ம்
ன்

after an English word.

For example:

❌ "one ஐ"
❌ "code ஐ"
❌ "example ல"
❌ "function க்கு"

These are NOT valid narration constructions for this TTS pipeline.

Rewrite the entire sentence.

Every sentence must be complete and naturally pronounceable.

==================================================
6. TECHNICAL TERMINOLOGY
========================

Keep commonly used programming terminology in ENGLISH.

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

Do not unnecessarily translate these terms.

Example:

✅ "இந்த function ஒரு value return பண்ணும்."

Do not replace technical terminology with unnecessarily formal native-language words.

==================================================
7. PROGRAMMING SYMBOLS — CRITICAL
=================================

Programming symbols may appear on screen, but they must NOT automatically be spoken.

If a programming symbol actually needs to be explained in narration, ALWAYS pronounce its name in ENGLISH.

This rule applies to ALL languages (Tamil, Hindi, Telugu, Kannada, Malayalam).

NEVER translate programming symbol names into the target language.

Use:

* = plus
- = minus
= = equals
== = double equals
=== = triple equals
!= = not equals
!== = not equals
> = greater than
< = less than
>= = greater than or equal to
<= = less than or equal to
% = percent / modulo depending on context
* = multiply / asterisk depending on context
/ = slash / divide depending on context
-> = arrow
=> = arrow / arrow function
&& = AND
|| = OR
! = NOT
++ = increment
-- = decrement
# = hash / comment marker depending on context
@ = at
_ = underscore
: = colon
; = semicolon
() = parentheses
[] = square brackets
{} = curly braces

### EXTREMELY IMPORTANT:

Do NOT say the native-language translation for these symbols under ANY circumstances.

❌ BAD (Tamil translation of "greater than"): "விட பெரியது"
❌ BAD (Hindi translation of "equals"): "बराबर"
❌ BAD (Telugu translation of "plus"): "ప్లస్" (if written in native script instead of keeping the english flow)

✅ GOOD (Tamil narration with English symbol): "இங்க age eighteen-க்கு greater than or equal to இருக்கான்னு check பண்ணுறோம்."

Use the EXACT ENGLISH NAME for the symbol.

If the symbol is NOT important to the explanation, DO NOT SAY IT.

==================================================
8. NEVER READ CODE CHARACTER-BY-CHARACTER
=========================================

Do NOT automatically read code as individual characters.

Screen:

\`\`\`python
def factorial(n):
    if n == 0:
        return 1
\`\`\`

Bad:

"def factorial open bracket n close bracket colon if n double equals zero..."

Good:

"இந்த factorial function ஒரு number-ஐ input-ஆ எடுத்துக்குது. Number zero-ஆ இருந்தா, one-ஐ return பண்ணும்."

Explain the MEANING of code naturally.

Only pronounce syntax symbols individually when the lesson is specifically teaching that syntax.

==================================================
9. EMOJIS MUST NEVER ENTER SPEECH
=================================

NEVER send emojis to TTS.

Remove all emojis from narration.

Examples:

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

Bad:

"இது ரொம்ப easy! 🚀"

Good:

"இது ரொம்ப easy."

Never pronounce or describe emojis.

==================================================
10. SCREEN SYMBOLS MUST NOT AUTOMATICALLY ENTER SPEECH
======================================================

The fact that a symbol appears on the screen does NOT mean the teacher should say it.

Screen:

Class → Object

Speech:

"Class-ல இருந்து Object எப்படி உருவாகுது என்று பாப்போம்."

Screen:

factorial(5)

Speech:

"இங்க factorial function-க்கு five-ஐ input-ஆ கொடுக்குறோம்."

However, if the native-language suffix creates poor TTS pronunciation, restructure the sentence:

"இங்க factorial function எடுத்துக்கிற input-ஐ பாப்போம்."

OR:

"இப்போ factorial function எப்படி work ஆகுதுன்னு பாப்போம்."

Do not read:

"open bracket"
"close bracket"

unless specifically teaching parentheses.

==================================================
11. MARKDOWN AND VISUAL FORMATTING
==================================

Never send these to TTS:

**
*
#
## \`
HTML tags
Markdown bullets
Markdown links
decorative separators
visual formatting

Remove visual formatting from speech.

==================================================
12. NATURAL TEACHER CONVERSATION
================================

The teacher should speak naturally to a student.

Useful transitions may include:

"இங்க ஒரு முக்கியமான point இருக்கு."

"இதுல என்ன நடக்குதுன்னு பாப்போம்."

"ஒரு example எடுத்துப் பாப்போம்."

"இப்போ இதை code-ல எப்படி use பண்ணுறதுன்னு பாப்போம்."

"இது ஏன் தேவைப்படுதுன்னு முதல்ல புரிஞ்சுக்கலாம்."

"இங்க தான் முக்கியமான விஷயம்."

"இந்த part பற்றி கொஞ்சம் கவனமா பாப்போம்."

But DO NOT repeat these expressions in every scene.

Do not artificially add conversational phrases just to make the speech longer.

Do not add fake student questions and answers unless explicitly requested.

==================================================
13. PEDAGOGICAL FLOW
====================

When appropriate, explain concepts in this order:

1. Introduce the concept directly.
2. Explain why it is needed.
3. Give a simple real-world example.
4. Explain the technical concept.
5. Show the code or visual.
6. Explain what happens step-by-step.
7. Highlight the important point.
8. Show the result.
9. Move naturally to the next concept.

Avoid unnecessary repetition.

Do not create narration just to fill a target word count.

Natural explanation is more important than exact word count.

==================================================
14. VISUAL IMPROVEMENT
======================

Improve the video by:

* Reducing unnecessary empty space.
* Making code larger and easier to read.
* Highlighting the exact code line being explained.
* Using diagrams for relationships and processes.
* Showing input → process → output.
* Showing step-by-step code execution.
* Using real-world analogies visually.
* Showing results immediately after code examples.
* Using before/after comparisons when useful.
* Keeping transitions smooth.
* Avoiding sudden scene changes.
* Avoiding incomplete text rendering.
* Avoiding partially visible words.
* Avoiding unnecessary decorative animations.

When code is displayed, the narration should explain the exact visible section.

==================================================
15. CODE EXAMPLE QUALITY
========================

Whenever possible, use COMPLETE and meaningful code examples.

Avoid incomplete code unless the purpose is specifically to demonstrate syntax or structure.

For each important code example:

1. Show the relevant code.
2. Highlight the line being discussed.
3. Explain what that line does.
4. Show the result.
5. Continue to the next concept.

Do not show code that the teacher does not explain.

==================================================
16. AUDIO / VIDEO SYNCHRONIZATION
=================================

Synchronize narration and visuals.

Correct sequence:

Visual appears
→ short natural pause
→ teacher explains

Do not explain a visual before it appears.

Do not keep unrelated visuals on screen while explaining another concept.

Avoid long artificial pauses after every sentence.

Keep narration flowing naturally.

==================================================
17. LANGUAGE CONSISTENCY
========================

Tamil:

Tamil Unicode
+
Natural conversational Tamil
+
English technical terms
+
English programming symbol names

Hindi:

Devanagari
+
Natural conversational Indian Hindi
+
English technical terms
+
English programming symbol names

Telugu:

Telugu Unicode
+
Natural conversational Telugu
+
English technical terms
+
English programming symbol names

Kannada:

Kannada Unicode
+
Natural conversational Kannada
+
English technical terms
+
English programming symbol names

Malayalam:

Malayalam Unicode
+
Natural conversational Malayalam
+
English technical terms
+
English programming symbol names

Never use Romanized Indian languages.

==================================================
18. FINAL TTS CHECK
===================

Before sending narration to TTS, silently check EVERY sentence.

CHECK:

1. No "Hi friends".
2. No unnecessary greetings.
3. No unnecessary introduction.
4. No emojis.
5. No decorative symbols.
6. No Romanized language.
7. No Tanglish.
8. No Hinglish.
9. No Tenglish.
10. No Kanglish.
11. No Manglish.
12. No isolated/broken native-language words.
13. No incomplete words.
14. No unnecessary formal/literary language.
15. NO PROGRAMMING SYMBOLS TRANSLATED (e.g. "plus", "greater than", "equals" MUST remain English).
16. Code is not read character-by-character.
17. Common technical terms remain in ENGLISH.
18. Narration sounds like a real teacher speaking directly to a student.
19. Sentences are natural for TTS.
20. The original meaning is preserved.
21. The narration does not simply copy screen content.
22. The narration does not describe visual formatting.

### CRITICAL FINAL SCAN 1: SYMBOL TRANSLATIONS

Scan the entire narration for any native-language words that mean:
plus, minus, equals, greater than, less than, percent, multiply, divide, AND, OR, NOT, etc.

If you translated a programming symbol into Tamil, Hindi, Telugu, Kannada, or Malayalam:
STOP. Rewrite it so the symbol name is spoken in EXACT ENGLISH.

### CRITICAL FINAL SCAN

Scan every English word in the output.

If you find:

English word + native-language suffix

or:

English word + space + native-language suffix

STOP.

For example:

❌ "one-ஐ"
❌ "one ஐ"

→ rewrite as:

✅ "one"

or restructure the sentence naturally.

Do NOT simply remove the suffix and leave a grammatically broken sentence.
Rewrite the whole sentence if necessary.

The final narration must be one continuous, natural teacher speech flow.
It must NOT sound like separate English and native-language words being stitched together.

If any check fails, rewrite the sentence before returning it.

==================================================
19. FINAL OBJECTIVE
===================

The final video should feel like:

A real Indian programming teacher explaining concepts naturally to a student.

NOT:

A translated textbook.

NOT:

A YouTube host greeting an audience.

NOT:

A formal language lecture.

NOT:

A screen reader.

NOT:

An AI reading code character-by-character.

NOT:

A mixture of English words and native-language suffixes that sounds unnatural in TTS.

The desired result is:

MODERN TECHNICAL SCREEN
+
NATURAL TEACHER-STUDENT CONVERSATION
+
NATIVE UNICODE LANGUAGE
+
ENGLISH TECHNICAL TERMINOLOGY
+
ENGLISH PROGRAMMING SYMBOL NAMES
+
NO EMOJIS IN SPEECH
+
NO CODE CHARACTER-BY-CHARACTER READING
+
NO BROKEN SINGLE-WORD FRAGMENTS
+
NO NATIVE SUFFIXES ATTACHED TO ENGLISH TECHNICAL WORDS
+
CLEAR VISUAL EXPLANATION
+
NATURAL AUDIO/VIDEO SYNCHRONIZATION

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