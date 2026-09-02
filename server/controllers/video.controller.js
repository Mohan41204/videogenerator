const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const audioService = require('../services/audio.service');
const ffmpegService = require('../services/ffmpeg.service');
const subtitleService = require('../services/subtitle.service');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Robust JSON extraction and cleaning utility
const cleanJsonString = (str) => {
  if (!str) return '';

  // Try to find JSON array block [ ... ]
  const arrayMatch = str.match(/\[\s*\{[\s\S]*\}\s*\]/);
  if (arrayMatch) {
    str = arrayMatch[0];
  } else {
    // Try to find JSON block { ... } if single object
    const objectMatch = str.match(/\{[\s\S]*\}/);
    if (objectMatch) {
      str = objectMatch[0];
    }
  }

  // Remove any potential markdown markers
  str = str.replace(/^```json\s*/gi, '').replace(/\s*```$/gi, '');

  // Fix invalid backslash escapes (e.g., \N, \s, \d, \user) by escaping the backslash.
  // Valid JSON escapes are: \", \\, \/, \b, \f, \n, \r, \t, and \uXXXX.
  // Note: We MUST NOT use case-insensitive matching here so that uppercase letters (like \N) are correctly doubled!
  str = str.replace(/\\(?!["\\/bfnrt]|u[0-9a-fA-F]{4})/g, '\\\\');

  return str.trim();
};

const generateVideo = async (req, res) => {
  try {
    const { text, format, languages, voiceId } = req.body;
    const backgroundPath = req.file ? req.file.path : null;
    let selectedLanguages = null;
    if (languages) {
      try {
        selectedLanguages = JSON.parse(languages);
      } catch(e) {
        console.error('Failed to parse languages from request');
      }
    }

    if (!text) {
      return res.status(400).json({ success: false, message: 'Text is required' });
    }

    const uniqueId = uuidv4();
    const outputDir = path.join(__dirname, '../output');
    // Ensure output directory exists for audio and video
    const videoDir = path.join(outputDir, 'video');
    const audioDir = path.join(outputDir, 'audio');
    if (!fs.existsSync(videoDir)) fs.mkdirSync(videoDir, { recursive: true });
    if (!fs.existsSync(audioDir)) fs.mkdirSync(audioDir, { recursive: true });

    const finalVideoPath = path.join(videoDir, `${uniqueId}.mp4`);
    const screenVideoPath = path.join(outputDir, `${uniqueId}_screen.mp4`);

    // --- Parse slides JSON ---
    console.log('Parsing script as JSON slides...');
    let slides;
    try {
      const cleaned = cleanJsonString(text);
      slides = JSON.parse(cleaned);

      if (Array.isArray(slides) && slides.length > 0 && slides[0].action) {
        slides = [{
          type: 'aws',
          service: 'AWS Service',
          title: 'AWS Tutorial',
          narration: 'Please follow along with the screen recording to learn how to use this AWS service.',
          steps: slides
        }];
      } else if (!Array.isArray(slides)) {
        if (slides.type && slides.type.toLowerCase() === 'aws') {
          slides = [slides];
        } else {
          throw new Error('Expected an array of slides or an AWS lesson object');
        }
      }

      slides = slides.map(slide => {
        if (slide.type && slide.type.toLowerCase() === 'aws') return slide;

        if (slide.code && (!slide.bullets || !slide.bullets.length)) {
          slide.bullets = [slide.code];
        }
        if (slide.isCode === undefined) {
          slide.isCode = /code|program|example|syntax/i.test(slide.heading || slide.subheading || '') ||
            (slide.bullets && slide.bullets.length === 1 && (slide.bullets[0].includes('\\N') || slide.bullets[0].includes('\n')));
        }
        if (slide.isCode) {
          const codeText = (slide.bullets && slide.bullets[0]) ? slide.bullets[0] : '';
          if (!slide.fileName || !slide.runCommand) {
            let fn = 'main.py';
            let cmd = 'python main.py';
            if (/public\s+class|System\.out\.print/i.test(codeText)) fn = 'Main.java', cmd = 'java Main';
            else if (/#include|std::/i.test(codeText)) fn = 'main.cpp', cmd = 'g++ main.cpp -o main && ./main';
            else if (/console\.log|const\s+|let\s+|function\s+/i.test(codeText)) fn = 'index.js', cmd = 'node index.js';
            else if (/using\s+System|Console\.WriteLine/i.test(codeText)) fn = 'Program.cs', cmd = 'dotnet run';
            if (!slide.fileName) slide.fileName = fn;
            if (!slide.runCommand) slide.runCommand = cmd;
          }
        }
        return slide;
      });
    } catch (e) {
      console.error('JSON parsing error:', e.message);
      return res.status(400).json({ success: false, message: `Invalid script JSON: ${e.message}` });
    }

    const SUPPORTED_LANGUAGES = require('../config/languages');
    const translationService = require('../services/translation.service');
    const { getActiveVoiceId } = require('./voice.controller');
    const resolvedVoiceId = voiceId || getActiveVoiceId();

    // --- STEP 1: Generate English (Ground Truth) Audio ---
    console.log(`Generating English audio for ${slides.length} slides...`);
    const englishAudioPaths = [];
    const englishDurations = [];
    const englishMasterPath = path.join(audioDir, `${uniqueId}_english.mp3`);

    for (let i = 0; i < slides.length; i++) {
      const slide = slides[i];
      const chunkPath = path.join(outputDir, `${uniqueId}_chunk_${i}_en.mp3`);
      await audioService.generateAudio(slide.narration || ' ', chunkPath, 'en', resolvedVoiceId);
      const duration = await audioService.getAudioDuration(chunkPath);
      englishAudioPaths.push(chunkPath);
      englishDurations.push(duration);
    }
    await audioService.mergeAudioFiles(englishAudioPaths, englishMasterPath);

    // --- STEP 2: Render animated silent video ---
    console.log('Rendering video with renderer factory...');
    const rendererFactory = require('../renderer/rendererFactory');
    const type = (slides.length > 0 && slides[0].type) ? slides[0].type : 'programming';
    const renderer = rendererFactory.getRenderer(type);
    await renderer.renderVideo(slides, englishDurations, screenVideoPath);

    // --- STEP 3: Merge silent video + English audio for master MP4 ---
    console.log('Merging screen video with English audio...');
    await ffmpegService.mergeVideoAndAudio(screenVideoPath, englishMasterPath, finalVideoPath);

    // --- STEP 4: Generate Multilingual Videos (Concurrent) ---
    const enableMultilingual = process.env.ENABLE_MULTILINGUAL_AUDIO === 'true';
    const videos = {
      en: {
        url: `/output/video/${uniqueId}.mp4`,
        language: 'English',
        code: 'en',
        slides: slides
      }
    };
    const failedLanguages = [];
    let status = 'success';

    if (enableMultilingual) {
      console.log('Generating multilingual videos...');
      let langCodes = Object.keys(SUPPORTED_LANGUAGES).filter(k => k !== 'en');
      if (selectedLanguages && Array.isArray(selectedLanguages)) {
        langCodes = langCodes.filter(k => selectedLanguages.includes(k));
      }
      
      for (const lang of langCodes) {
        const langConfig = SUPPORTED_LANGUAGES[lang];
        // Ensure language specific name
        const langVideoFileName = `${uniqueId}_${langConfig.code}.mp4`;
        const langVideoPath = path.join(videoDir, langVideoFileName);
        const masterLangAudioPath = path.join(audioDir, `${uniqueId}_${langConfig.fileName}`);
        const langScreenVideoPath = path.join(outputDir, `${uniqueId}_screen_${lang}.mp4`);
        
        try {
          // 1. Translate the entire slide deck
          console.log(`Translating slides for ${langConfig.name}...`);
          const langSlides = await translationService.translateSlides(slides, langConfig.name);
          
          // 2. Generate target language audio chunks using the translated narration
          const langChunks = [];
          for (let i = 0; i < langSlides.length; i++) {
            const slide = langSlides[i];
            // Use original English narration and convert it to mixed-language conversational style
            const translatedNarration = await translationService.translateText(slides[i].narration || ' ', langConfig.name);
            const rawChunkPath = path.join(outputDir, `${uniqueId}_rawchunk_${i}_${lang}.mp3`);
            await audioService.generateAudio(translatedNarration, rawChunkPath, langConfig.code, voiceId);
            
            // Adjust duration to exactly match English chunk
            const adjustedChunkPath = path.join(outputDir, `${uniqueId}_chunk_${i}_${lang}.mp3`);
            await audioService.adjustAudioDuration(rawChunkPath, adjustedChunkPath, englishDurations[i]);
            langChunks.push(adjustedChunkPath);
            fs.unlink(rawChunkPath, () => {});
          }
          await audioService.mergeAudioFiles(langChunks, masterLangAudioPath);
          
          // 3. Render animated silent video for this specific language
          console.log(`Rendering localized video for ${langConfig.name}...`);
          await renderer.renderVideo(langSlides, englishDurations, langScreenVideoPath);
          
          // 4. Merge localized video + localized audio
          await ffmpegService.mergeVideoAndAudio(langScreenVideoPath, masterLangAudioPath, langVideoPath);
          
          videos[lang] = {
            url: `/output/video/${langVideoFileName}`,
            language: langConfig.name,
            code: langConfig.code,
            slides: langSlides
          };
          
          // Cleanup chunks and intermediate files
          langChunks.forEach(p => fs.unlink(p, () => {}));
          fs.unlink(masterLangAudioPath, () => {});
          fs.unlink(langScreenVideoPath, () => {});
        } catch (err) {
          console.error(`Failed to generate localized video for ${lang}:`, err);
          status = 'partial';
          failedLanguages.push({ code: lang, error: err.message });
        }
      }
    }

    // Save metadata for potential regeneration
    const metadataPath = path.join(outputDir, `${uniqueId}_metadata.json`);
    fs.writeFileSync(metadataPath, JSON.stringify({
      slides,
      englishDurations,
      languages: videos,
      voiceId: resolvedVoiceId
    }, null, 2));

    // --- STEP 5: Clean up temporary files ---
    if (backgroundPath && req.file) fs.unlink(backgroundPath, () => {});
    fs.unlink(screenVideoPath, () => {});
    englishAudioPaths.forEach(p => fs.unlink(p, () => {}));
    fs.unlink(englishMasterPath, () => {}); // we can clean the master english audio too

    res.status(200).json({
      success: true,
      status: status,
      message: status === 'partial' ? 'Video generated with some language failures' : 'Video generated successfully',
      failedLanguages: failedLanguages.length > 0 ? failedLanguages : undefined,
      data: { 
        videoUrl: `/output/video/${uniqueId}.mp4`,
        id: uniqueId,
        videos 
      }
    });

  } catch (error) {
    console.error('Video generation error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate video', error: error.message });
  }
};


const generateScript = async (req, res) => {
  try {
    const { topic, subTopic, durationMinutes = 5 } = req.body;
    if (!topic) {
      return res.status(400).json({ success: false, message: 'Topic is required' });
    }

    const targetMins = parseInt(durationMinutes, 10) || 5;
    const targetWords = targetMins * 140; // ~140 words per minute of speech
    const slideCount = Math.max(3, Math.round(targetMins * 1.2)); // ~6 slides for 5 mins

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const prompt = `
Imagine you are an experienced classroom teacher creating detailed spoken study notes for students in an online screen-share classroom.

Your task is to generate a complete teaching script for the topic: "${topic}".
The subtopic to focus on is: "${subTopic || 'General Concepts'}".

TARGET LESSON DURATION: ${targetMins} MINUTES (~${targetWords} words total narration, exactly ${slideCount} slides).

Requirements for the teaching style:
- The script must teach students from beginner level to advanced understanding step by step.
- CRITICAL: Determine if the topic and subtopic are related to programming, coding, software engineering, databases, APIs, frameworks, markup languages, styling languages, or technical computer science concepts (e.g., Python, Java, Javascript, HTML/CSS, React, SQL, Git, Loops, OOP, Algorithms, Web Development, etc.):
  - **If the topic/subtopic is programming/coding-related, you MUST include actual, concrete example coding snippets**:
    - Provide slide(s) with a **Basic Example Program** showing fundamental implementation.
    - Provide slide(s) with an **Advanced Example Program** showing real-world / production-grade implementation.
    - For slides displaying code examples, the \`bullets\` array should contain exactly one string representing the full, formatted, and indented code block. You MUST also include the expected EXECUTED OUTPUT of the code directly below the program inside the same string.
    - Separate the code and the output using \`\\\\N\\\\N==== OUTPUT ====\\\\N\` followed by the output.
    - Use \\N (the literal string '\\N') to represent newlines inside the code block and output so that lines and spacing are perfectly preserved on the screen. Do NOT include markdown code fences (\`\`\`) inside the bullets array. Write real, complete, professional code snippets (e.g., \`"print('Hello World')\\\\N\\\\N==== OUTPUT ====\\\\NHello World"\`).
    - CRITICAL CODE LIMITATION: Keep code examples short, concise, and highly focused. Each code block MUST NOT exceed 6 to 10 lines of code total.
    - The slide object MUST have "isCode": true.
  - **If the topic/subtopic is NOT related to programming/coding**:
    - Do NOT include any programming code blocks or example programs.
    - Instead, generate detailed explanation slides, concrete real-world examples, analogies, practical case studies, and scenarios related to the topic and subtopic.
    - The slide object MUST have "isCode": false.
- Explain every concept and example in a very simple, easy-to-understand classroom teaching style.
- Use friendly teacher-to-student communication with encouraging transition phrases.
- Cover definitions, theory, syntax, examples, use cases, common mistakes, and practical understanding.
- CRITICAL DURATION TARGET: You MUST generate exactly ${slideCount} slides, and the total narration across all slides combined MUST be approximately ${targetWords} words total (~${Math.round(targetWords / slideCount)} words per slide narration) so that spoken audio duration is exactly around ${targetMins} minutes.

DIAGRAM SLIDES (IMPORTANT):
- For any concept that has a clear visual flow, structure, or relationship (e.g., how a for-loop works, a class hierarchy, a sequence of API calls, a data pipeline), you SHOULD include a dedicated diagram slide.
- A diagram slide must have "isDiagram": true and a valid "mermaid" string containing raw Mermaid.js code.
- The Mermaid code must be simple, maximum 10 nodes, use LR or TD layout, short labels (under 25 chars), no HTML, no markdown wrappers.
- Set "isCode": false and "isDiagram": true for diagram slides. Leave "bullets" as an empty array [].
- For non-diagram slides, "isDiagram" must be false and "mermaid" must be an empty string "".

OUTPUT FORMAT:
You MUST output ONLY a valid JSON array of "Slide" objects. Do not include markdown formatting, headings symbols, or code block formatting outside the JSON. Just raw JSON array.
Each Slide object must have:
- "heading": (String) A short, professional title for the slide.
- "subheading": (String) An optional subtitle or secondary thought. Can be empty string.
- "bullets": (Array of Strings) 2 to 4 bullet points summarizing the visual content. Keep these brief! (Except for programming code slides where the array should contain exactly one string representing the code block, and diagram slides where it should be an empty array []).
- "narration": (String) The spoken teaching script for this slide (~${Math.round(targetWords / slideCount)} words). Output plain narration text only for this field.
- "isCode": (Boolean) Set to true if this slide is a code example or contains code, and false otherwise.
- "isDiagram": (Boolean) Set to true if this slide is a diagram slide, and false otherwise.
- "mermaid": (String) If isDiagram is true, provide valid raw Mermaid.js code. Otherwise empty string "".
- "fileName": (String - optional) For code slides, the appropriate filename for the language (e.g. "Main.java", "main.py", "index.js", "script.sh", "Program.cs", "main.cpp").
- "runCommand": (String - optional) For code slides, the exact shell command to execute the file (e.g. "java Main", "python main.py", "node index.js", "./script.sh", "dotnet run", "./main").
`;

    const runModelWithRetry = async (modelName) => {
      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                heading:    { type: 'string' },
                subheading: { type: 'string' },
                bullets: {
                  type: 'array',
                  items: { type: 'string' }
                },
                narration:  { type: 'string' },
                isCode:     { type: 'boolean' },
                isDiagram:  { type: 'boolean' },
                mermaid:    { type: 'string' },
                fileName:   { type: 'string' },
                runCommand: { type: 'string' }
              },
              required: ['heading', 'subheading', 'bullets', 'narration', 'isCode', 'isDiagram', 'mermaid']
            }
          }
        }
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
          console.warn(`Attempt ${attempts} with ${modelName} failed: ${err.message}. Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          delay *= 2;
        }
      }
    };

    let result;
    try {
      console.log('Generating script using gemini-2.5-flash...');
      result = await runModelWithRetry('gemini-2.5-flash');
    } catch (error) {
      console.warn('gemini-2.5-flash failed after all retries. Falling back to gemini-flash-latest...');
      result = await runModelWithRetry('gemini-flash-latest');
    }

    const response = await result.response;
    let text = response.text();

    // Clean and extract potential JSON formatting from Gemini
    const cleanedText = cleanJsonString(text);

    res.status(200).json({ success: true, text: cleanedText });
  } catch (error) {
    console.error('Script generation error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate script', error: error.message });
  }
};

const generateAwsScript = async (req, res) => {
  try {
    const { topic, subTopic, durationMinutes = 5 } = req.body;
    if (!topic) {
      return res.status(400).json({ success: false, message: 'AWS Service / Topic is required' });
    }

    const targetMins = parseInt(durationMinutes, 10) || 5;
    const targetWords = targetMins * 140;

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const prompt = `
Imagine you are an experienced AWS instructor creating an automated screen-recording tutorial.

Your task is to generate a complete AWS Console automation script for: "${topic}".
Specific focus / task: "${subTopic || 'Basic Setup / Overview'}".

TARGET LESSON DURATION: ${targetMins} MINUTES (~${targetWords} words total narration).

Requirements:
- Provide a clear, step-by-step demonstration in the AWS Management Console.
- Your output must be a single JSON object.
- DO NOT INCLUDE ANY MARKDOWN formatting outside the JSON block.

**RECORDING OPTIMIZATION CRITERIA (CRITICAL):**
Your JSON will be executed by a Puppeteer-based recording engine. Optimize the recording for professional screen-capture quality:
1. Every navigation must wait for: networkidle, fonts loaded, images loaded, no loading spinner, and stable DOM for 500ms.
2. Before every click: highlight target first, then click.
3. Produce cinematic tutorial pacing suitable for YouTube.
4. **CRITICAL FLOW RULE:** ALWAYS start by navigating to the AWS Console Home (\`https://console.aws.amazon.com/console/home\`). NEVER jump directly to a service URL. Use the \`search\` action to type the service name, then \`click\` the service from dropdown results.

**SCROLL ACTION RULES (CRITICAL — strictly enforced, violations break the recording):**
5. A scroll action has EXACTLY two fields: "direction" and "distance". There is NO "value", "target" or "duration" field on a scroll action. This is INVALID and will break execution:
   { "action": "scroll", "value": "down" }
   This is the ONLY valid format:
   { "action": "scroll", "direction": "down", "distance": 300 }
6. "direction" must be the literal string "up" or "down". "distance" must be an integer number of pixels (typically 250–500), estimated based on how far the target element likely is from the current viewport.
7. NEVER emit two or more scroll actions back-to-back to reach the same target. Combine them into ONE scroll action with a larger "distance" instead. For example, do NOT do this:
   { "action": "scroll", "direction": "down", "distance": 150 },
   { "action": "scroll", "direction": "down", "distance": 150 }
   Instead, use a single scroll, interact, and then scroll again if needed. Here is a perfect example of a valid scroll sequence:
   {
     "action": "scroll",
     "direction": "down",
     "distance": 300
   },
   {
     "action": "highlight",
     "target": {
       "label": "Block all public access",
       "context": "checkbox option under the Block Public Access settings section of the create bucket form",
       "type": "checkbox"
     }
   },
   {
     "action": "scroll",
     "direction": "down",
     "distance": 400
   },
   {
     "action": "highlight",
     "target": {
       "label": "Create bucket",
       "context": "primary submission button located at the bottom of the create bucket form",
       "type": "button"
     }
   }
8. Only insert a scroll action when the next target is very likely off-screen (e.g. deep in a long form, below the fold). Do not scroll "just in case" or scroll toward elements already likely visible.
9. NEVER scroll to, or place the cursor near, the very top of the viewport (roughly y < 60px). That area contains the browser-level breadcrumb/toolbar strip, and repeated cursor presence there causes the AWS Console's auto-hide toolbar to toggle show/hide rapidly, which is a major source of jitter.
10. Do not immediately follow a scroll with another action targeting an element near the top of the viewport (y < 60px) since scrolling often triggers the AWS auto-hide header to appear, displacing the element you were aiming for.
11. Do not chain unrelated \`highlight\`/\`click\` pairs back-to-back without a navigation or wait action in between when the page layout is still settling (e.g., right after a page load or a panel expand/collapse).

Before finalizing your output, review every scroll action and verify: (a) it uses "direction" + "distance" only, and (b) no two scroll actions appear consecutively.

**CRITICAL ELEMENT TARGETING RULES — VIOLATION = SCRIPT FAILURE:**
- The \`target.label\` MUST always be the **visible text label on the UI element itself** (e.g., a button label, input field label, heading, or link text visible on screen).
- **NEVER output a \`target\` with an empty or blank \`label\` field.** This will CRASH the engine.
- NEVER use a value you are about to type as a \`target.label\`. For example, if you want to type a bucket name into a "Bucket name" textbox, the target label is \`"Bucket name"\`, NOT \`"demo-s3-bucket-789012"\`.
- NEVER use a dynamic value (bucket name, resource name, ARN, ID) as a \`target.label\` unless that exact text is visibly rendered as a link or button on the screen AFTER the resource has been created.
- After creating a resource, use \`waitForNetworkIdle\` first, then \`click\` the resource by its exact name (since the listing renders it as a link).
- For the global search bar, use action \`search\` with just a \`value\` field (no \`target\` needed).

**TARGET DISAMBIGUATION — \`target.context\` (CRITICAL, REQUIRED ON EVERY \`target\`):**
- Many AWS Console pages render the SAME text in more than one place at once — most commonly the service/page name appears both in the top breadcrumb trail AND as an actual clickable link or button in the main content area. If you only give a \`label\`, the engine cannot tell which one you mean, and it will frequently mis-click the breadcrumb instead of the real element. This has caused real failures.
- Every \`target\` object MUST include a \`context\` string field, in addition to \`label\` and \`type\`, describing WHERE on the page the element is located and how to tell it apart from lookalikes. Examples of good context: \`"the primary blue button inside the main form, not the breadcrumb link at the top of the page"\`, \`"row in the resource list table, not the page title"\`, \`"left-hand sidebar navigation menu"\`, \`"inside the modal dialog"\`.
- If the element you are targeting is itself part of the breadcrumb trail and that is genuinely intended (rare), say so explicitly in \`context\` (e.g. \`"breadcrumb link used to navigate back up one level"\`) so it's clear this was deliberate rather than a mistake.
- Never leave \`context\` empty when \`label\` could plausibly match more than one element on the page.

The JSON MUST follow this exact structure:
{
  "type": "aws",
  "service": "${topic}",
  "title": "AWS Tutorial: ${topic} - ${subTopic || 'Overview'}",
  "narration": "Write the full spoken teaching script here, approximately ${targetWords} words.",
  "steps": [
    { "action": "goto", "url": "https://console.aws.amazon.com/console/home" },
    { "action": "waitForNetworkIdle" },
    { "action": "search", "value": "${topic}" },
    { "action": "waitForNetworkIdle" },
    { "action": "click", "target": { "label": "Amazon ${topic}", "type": "link", "context": "search results dropdown item, not the breadcrumb" } },
    { "action": "waitForNetworkIdle" },
    { "action": "highlight", "target": { "label": "Create bucket", "type": "button", "context": "primary action button in the main content area, top-right of the bucket list" } },
    { "action": "click", "target": { "label": "Create bucket", "type": "button", "context": "primary action button in the main content area, top-right of the bucket list" } },
    { "action": "waitForNetworkIdle" },
    {
      "action": "type",
      "target": { "label": "Bucket name", "type": "textbox", "context": "text input field inside the General configuration section of the create-bucket form" },
      "value": "demo-videogen-001"
    },
    { "action": "scroll", "direction": "down", "distance": 300 },
    { "action": "highlight", "target": { "label": "Block all public access", "type": "checkbox", "context": "checkbox inside the Block Public Access settings section" } },
    { "action": "scroll", "direction": "down", "distance": 300 },
    { "action": "highlight", "target": { "label": "Create bucket", "type": "button", "context": "submit button at the bottom of the create-bucket form, not the top button used earlier" } },
    { "action": "click", "target": { "label": "Create bucket", "type": "button", "context": "submit button at the bottom of the create-bucket form, not the top button used earlier" } },
    { "action": "waitForNetworkIdle" },
    { "action": "click", "target": { "label": "demo-videogen-001", "type": "link", "context": "row in the S3 bucket listing table, not any breadcrumb text" } }
  ]
}

Available actions for steps:
- goto (requires 'url')
- waitForNetworkIdle (optional 'timeout')
- search (requires 'value' - types into the global AWS search bar)
- click (requires 'target' object with 'label', 'type', and 'context')
- doubleClick (requires 'target' object with 'label', 'type', and 'context')
- type (requires 'target' object with 'label', 'type', and 'context' to focus the field, plus 'value' to type)
- select (requires 'target' object with 'label', 'type', and 'context', plus 'value')
- check / uncheck (requires 'target' object with 'label', 'type', and 'context')
- hover (requires 'target' object with 'label', 'type', and 'context')
- scroll (requires 'direction': "up"/"down" and 'distance' in pixels — NEVER a 'target' or 'duration')
- highlight (requires 'target' object with 'label', 'type', and 'context' - draws a visual box around the element)
- wait (requires 'duration' in ms - AVOID IF POSSIBLE)

Ensure the steps logically flow like a real human navigating the console. Do NOT use CSS selectors. Use ONLY semantic labels and types (e.g., type: "button", "link", "textbox", "checkbox", "dropdown", "tab", "section"), and always pair them with a disambiguating "context" string.
`;

    const model = genAI.getGenerativeModel({
      model: 'gemini-flash-latest',
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'object',
          properties: {
            type: { type: 'string' },
            service: { type: 'string' },
            title: { type: 'string' },
            narration: { type: 'string' },
            steps: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  action: { type: 'string' },
                  url: { type: 'string' },
                  value: { type: 'string' },
                  duration: { type: 'integer' },
                  target: {
                    type: 'object',
                    properties: {
                      label: { type: 'string' },
                      type: { type: 'string' },
                      context: { type: 'string' }
                    },
                    required: ['label', 'context']
                  }
                },
                required: ['action']
              }
            }
          },
          required: ['type', 'service', 'title', 'narration', 'steps']
        }
      }
    });

    let result;
    let attempts = 0;
    const maxAttempts = 3;
    let delay = 15000; // start with 15s delay for 429 errors

    while (attempts < maxAttempts) {
      try {
        result = await model.generateContent(prompt);
        break;
      } catch (err) {
        attempts++;
        if (attempts >= maxAttempts) throw err;

        console.warn(`[AWS Script Gen] Attempt ${attempts} failed: ${err.message}. Retrying in ${delay}ms...`);
        // If there is a specific retry delay from the API, we could parse it, but a static backoff is safe.
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 1.5;
      }
    }

    const response = await result.response;
    let text = response.text();

    const cleanedText = cleanJsonString(text);
    res.status(200).json({ success: true, text: cleanedText });
  } catch (error) {
    console.error('AWS script generation error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate AWS script', error: error.message });
  }
};

const regenerateLanguageVideo = async (req, res) => {
  try {
    const { id, lang } = req.params;
    const outputDir = path.join(__dirname, '../output');
    const metadataPath = path.join(outputDir, `${id}_metadata.json`);
    
    if (!fs.existsSync(metadataPath)) {
      return res.status(404).json({ success: false, message: 'Metadata not found for this video' });
    }

    const SUPPORTED_LANGUAGES = require('../config/languages');
    const langConfig = SUPPORTED_LANGUAGES[lang];
    if (!langConfig) {
      return res.status(400).json({ success: false, message: 'Unsupported language code' });
    }

    const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
    const { englishDurations, languages, voiceId: savedVoiceId } = metadata;
    
    // Fallback to original slides if languages data is missing this language
    const originalSlides = metadata.slides;
    const langSlides = languages && languages[lang] && languages[lang].slides 
                       ? languages[lang].slides 
                       : originalSlides; // fallback

    const translationService = require('../services/translation.service');
    const audioService = require('../services/audio.service');
    const ffmpegService = require('../services/ffmpeg.service');
    
    const audioDir = path.join(outputDir, 'audio');
    const videoDir = path.join(outputDir, 'video');
    if (!fs.existsSync(audioDir)) fs.mkdirSync(audioDir, { recursive: true });
    if (!fs.existsSync(videoDir)) fs.mkdirSync(videoDir, { recursive: true });

    // 1. Re-render silent video using localized slides
    console.log(`Re-rendering localized silent video for ${id} in ${lang}...`);
    const screenVideoPath = path.join(outputDir, `${id}_screen_regen_${lang}.mp4`);
    const rendererFactory = require('../renderer/rendererFactory');
    const type = (langSlides.length > 0 && langSlides[0].type) ? langSlides[0].type : 'programming';
    const renderer = rendererFactory.getRenderer(type);
    await renderer.renderVideo(langSlides, englishDurations, screenVideoPath);

    // 2. Generate target language audio using localized slides
    const masterLangAudioPath = path.join(audioDir, `${id}_${langConfig.fileName}`);
    const langChunks = [];

    const { getActiveVoiceId } = require('./voice.controller');
    const voiceId = req.body.voiceId || savedVoiceId || getActiveVoiceId();

    for (let i = 0; i < langSlides.length; i++) {
      const slide = langSlides[i];
      // Always translate original English narration to mixed-language conversational style for audio
      const translatedNarration = await translationService.translateText(originalSlides[i].narration || ' ', langConfig.name);
      const rawChunkPath = path.join(outputDir, `${id}_rawchunk_${i}_${lang}.mp3`);
      await audioService.generateAudio(translatedNarration, rawChunkPath, langConfig.code, voiceId);
      
      const adjustedChunkPath = path.join(outputDir, `${id}_chunk_${i}_${lang}.mp3`);
      await audioService.adjustAudioDuration(rawChunkPath, adjustedChunkPath, englishDurations[i]);
      langChunks.push(adjustedChunkPath);
      fs.unlink(rawChunkPath, () => {});
    }

    await audioService.mergeAudioFiles(langChunks, masterLangAudioPath);
    
    // 3. Merge localized audio and video
    const langVideoFileName = `${id}_${langConfig.code}.mp4`;
    const langVideoPath = path.join(videoDir, langVideoFileName);
    
    console.log(`Merging regenerated video for ${lang}...`);
    await ffmpegService.mergeVideoAndAudio(screenVideoPath, masterLangAudioPath, langVideoPath);

    // Cleanup
    langChunks.forEach(p => fs.unlink(p, () => {}));
    fs.unlink(screenVideoPath, () => {});
    fs.unlink(masterLangAudioPath, () => {});

    res.status(200).json({
      success: true,
      message: `${langConfig.name} video regenerated successfully`,
      data: { url: `/output/video/${langVideoFileName}` }
    });

  } catch (error) {
    console.error(`Regenerate video error for ${req.params.lang}:`, error);
    res.status(500).json({ success: false, message: 'Failed to regenerate language video', error: error.message });
  }
};

module.exports = {
  generateVideo,
  generateScript,
  generateAwsScript,
  regenerateLanguageVideo
};