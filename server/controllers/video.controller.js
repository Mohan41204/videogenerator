const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const audioService = require('../services/audio.service');
const ffmpegService = require('../services/ffmpeg.service');
const subtitleService = require('../services/subtitle.service');
const { GoogleGenAI } = require('@google/genai');

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
    const { text, format } = req.body;
    const backgroundPath = req.file ? req.file.path : null;

    if (!text) {
      return res.status(400).json({ success: false, message: 'Text is required' });
    }

    const uniqueId = uuidv4();
    const outputDir = path.join(__dirname, '../output');

    const finalAudioPath      = path.join(outputDir, `${uniqueId}.mp3`);
    const screenVideoPath     = path.join(outputDir, `${uniqueId}_screen.mp4`);
    const finalVideoPath      = path.join(outputDir, `${uniqueId}.mp4`);

    // --- Parse slides JSON ---
    console.log('Parsing script as JSON slides...');
    let slides;
    try {
      const cleaned = cleanJsonString(text);
      slides = JSON.parse(cleaned);

      if (Array.isArray(slides) && slides.length > 0 && slides[0].action) {
        // Fallback: if Gemini returned an array of steps instead of the wrapper object
        slides = [{
          type: 'aws',
          service: 'AWS Service',
          title: 'AWS Tutorial',
          narration: 'Please follow along with the screen recording to learn how to use this AWS service.',
          steps: slides
        }];
      } else if (!Array.isArray(slides)) {
        if (slides.type && slides.type.toLowerCase() === 'aws') {
          // AWS JSON is a single object. Wrap it in an array so the audio loops work.
          slides = [slides];
        } else {
          throw new Error('Expected an array of slides or an AWS lesson object');
        }
      }

      // Auto-fix any structure issues (only for programming slides)
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
            if (/public\s+class|System\.out\.print/i.test(codeText)) {
              fn = 'Main.java';
              cmd = 'java Main';
            } else if (/#include|std::/i.test(codeText)) {
              fn = 'main.cpp';
              cmd = 'g++ main.cpp -o main && ./main';
            } else if (/console\.log|const\s+|let\s+|function\s+/i.test(codeText)) {
              fn = 'index.js';
              cmd = 'node index.js';
            } else if (/using\s+System|Console\.WriteLine/i.test(codeText)) {
              fn = 'Program.cs';
              cmd = 'dotnet run';
            }
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

    const audioPaths = [];
    const durations  = [];

    // --- STEP 1: Generate narration audio for each slide ---
    console.log(`Generating audio for ${slides.length} slides...`);
    const batchSize = 10;
    for (let i = 0; i < slides.length; i += batchSize) {
      const batch = slides.slice(i, i + batchSize);
      const results = await Promise.all(batch.map(async (slide, batchIndex) => {
        const actualIndex = i + batchIndex;
        const chunkPath = path.join(outputDir, `${uniqueId}_chunk_${actualIndex}.mp3`);
        await audioService.generateAudio(slide.narration || ' ', chunkPath);
        const duration = await audioService.getAudioDuration(chunkPath);
        return { path: chunkPath, duration };
      }));
      results.forEach(r => { audioPaths.push(r.path); durations.push(r.duration); });
    }

    // --- STEP 2: Merge all audio chunks into one master narration file ---
    console.log('Merging audio chunks...');
    await audioService.mergeAudioFiles(audioPaths, finalAudioPath);

    // --- STEP 3: Render animated video with appropriate Renderer ---
    console.log('Rendering video with renderer factory...');
    const rendererFactory = require('../renderer/rendererFactory');
    const type = (slides.length > 0 && slides[0].type) ? slides[0].type : 'programming';
    const renderer = rendererFactory.getRenderer(type);
    
    await renderer.renderVideo(slides, durations, screenVideoPath);

    // --- STEP 4: Merge silent screen video + narration audio ---
    console.log('Merging screen video with narration audio...');
    await ffmpegService.mergeVideoAndAudio(screenVideoPath, finalAudioPath, finalVideoPath);

    // --- STEP 5: Clean up temporary files ---
    if (backgroundPath && req.file) fs.unlink(backgroundPath, () => {});
    fs.unlink(finalAudioPath, () => {});
    fs.unlink(screenVideoPath, () => {});
    audioPaths.forEach(p => fs.unlink(p, () => {}));

    const videoUrl = `/output/${uniqueId}.mp4`;
    res.status(200).json({
      success: true,
      message: 'Video generated successfully',
      data: { videoUrl, id: uniqueId }
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

    console.log('Gemini credential loaded:', !!process.env.GEMINI_API_KEY);
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
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
    - Separate the code and the output using \`\\N\\N==== OUTPUT ====\\N\` followed by the output.
    - Use \\N (the literal string '\\N') to represent newlines inside the code block and output so that lines and spacing are preserved on the screen. Do NOT include markdown code fences (\`\`\`) inside the bullets array. Write real, complete, professional code snippets (e.g., \`"print('Hello World')\\N\\N==== OUTPUT ====\\NHello World"\`).
    - CRITICAL CODE LIMITATION: Keep code examples short, concise, and highly focused. Each code block MUST NOT exceed 6 to 10 lines of code total.
    - The slide object MUST have "isCode": true.
  - **If the topic/subtopic is NOT related to programming/coding**:
    - Do NOT include any programming code blocks or example programs.
    - Instead, generate detailed explanation slides, concrete real-world examples, analogies, practical case studies, and scenarios related to the topic and subtopic.
    - The slide object MUST have "isCode": false.
    - **CRITICAL VISUAL FORMATTING & HIGHLIGHTING RULES FOR WHITEBOARD SLIDES**:
      - The \`bullets\` array must contain 2 to 4 styled objects or paragraphs representing different elements rendered sequentially on the whiteboard.
      - Support the following structures inside the \`bullets\` array:
        - **Bullet Lists**: Lines starting with \`- \` or \`* \`
        - **Numbered Lists**: Lines starting with \`1. \`, \`2. \`
        - **Quotes**: Text starting with \`[quote]\` for key analogies or notable phrases
        - **Tables**: Markdown-style table syntax (e.g., \`| Header 1 | Header 2 |\\n|---|---|\\n| Cell 1 | Cell 2 |\`)
        - **Section Headings**: Lines starting with \`## \` or \`### \`
      - **KEYWORD ONLY HIGHLIGHTS (CRITICAL)**: Do NOT highlight entire sentences or long phrases. Instead, wrap ONLY important words/concepts in \`[yellow]keyword[/yellow]\` and critical definitions in \`[red]term[/red]\`.
        - Example: Instead of \`[yellow]Photosynthesis converts sunlight into glucose.[/yellow]\`, use \`[yellow]Photosynthesis[/yellow]\` converts \`[yellow]sunlight[/yellow]\` into \`[yellow]glucose[/yellow]\`. Highlight ONLY the specific concepts.
- Explain every concept and example in a very simple, easy-to-understand classroom teaching style.
- Use friendly teacher-to-student communication with encouraging transition phrases.
- Cover definitions, theory, syntax, examples, use cases, common mistakes, and practical understanding.
- CRITICAL DURATION TARGET: You MUST generate exactly ${slideCount} slides, and the total narration across all slides combined MUST be approximately ${targetWords} words total (~${Math.round(targetWords / slideCount)} words per slide narration) so that spoken audio duration is exactly around ${targetMins} minutes.
 
DIAGRAM SLIDES (IMPORTANT):
- For any concept that has a clear visual flow, structure, or relationship (e.g., how a process works, a class hierarchy, a sequence of API calls, a data pipeline), you SHOULD include a dedicated diagram slide.
- A diagram slide must have "isDiagram": true and a valid "mermaid" string containing raw Mermaid.js code.
- The Mermaid code must be simple, maximum 10 nodes, use LR or TD layout, short labels (under 25 chars), no HTML, no markdown wrappers.
- Set "isCode": false and "isDiagram": true for diagram slides. Leave "bullets" as an empty array [].
- For non-diagram slides, "isDiagram" must be false and "mermaid" must be an empty string "".
 
OUTPUT FORMAT:
You MUST output ONLY a valid JSON array of "Slide" objects. Do not include markdown formatting, headings symbols, or code block formatting outside the JSON. Just raw JSON array.
Each Slide object must have:
- "heading": (String) A short, professional title for the slide.
- "subheading": (String) An optional subtitle or secondary thought. Can be empty string.
- "bullets": (Array of Strings) Content to display on the slide.
- "narration": (String) The spoken teaching script for this slide (~${Math.round(targetWords / slideCount)} words). Output plain narration text only for this field.
- "isCode": (Boolean) Set to true if this slide is a code example or contains code, and false otherwise.
- "isDiagram": (Boolean) Set to true if this slide is a diagram slide, and false otherwise.
- "mermaid": (String) If isDiagram is true, provide valid raw Mermaid.js code. Otherwise empty string "".
- "fileName": (String - optional) For code slides, the appropriate filename for the language (e.g. "Main.java", "main.py", "index.js", "script.sh", "Program.cs", "main.cpp").
- "runCommand": (String - optional) For code slides, the exact shell command to execute the file (e.g. "java Main", "python main.py", "node index.js", "./script.sh", "dotnet run", "./main").
`;

    const runModelWithRetry = async (modelName) => {
      let attempts = 0;
      const maxAttempts = 3;
      let delay = 1000;

      while (attempts < maxAttempts) {
        console.log(`Attempt ${attempts + 1}/${maxAttempts}`);
        try {
          const response = await ai.models.generateContent({
            model: modelName,
            contents: prompt,
            config: {
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
          return response;
        } catch (err) {
          let status = err.status;
          if (!status && err.message) {
            try {
              const match = err.message.match(/"code"\s*:\s*(\d+)/);
              if (match) {
                status = parseInt(match[1], 10);
              }
            } catch (e) {}
          }

          console.warn(`${modelName === 'gemini-3.6-flash' ? 'Gemini 3.6 Flash' : modelName} returned ${status || 'error'}`);

          if (status === 404 || status === 401 || status === 403 || status === 400) {
            console.warn(`Fatal error ${status} encountered. Immediate fail/fallback without further retries.`);
            throw err;
          }

          attempts++;
          if (attempts >= maxAttempts) {
            if (modelName === 'gemini-3.6-flash') {
              console.warn(`Switching to fallback model: gemini-3.5-flash-lite`);
            }
            throw err;
          }
          console.log(`Retrying in ${delay}ms`);
          await new Promise(resolve => setTimeout(resolve, delay));
          delay *= 2;
        }
      }
    };

    let response;
    try {
      console.log('Primary Gemini model: gemini-3.6-flash');
      response = await runModelWithRetry('gemini-3.6-flash');
    } catch (error) {
      response = await runModelWithRetry('gemini-3.5-flash-lite');
      console.log('Fallback model succeeded');
    }

    let text = response.text;

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

    console.log('Gemini credential loaded:', !!process.env.GEMINI_API_KEY);
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
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

**CRITICAL ELEMENT TARGETING RULES — VIOLATION = SCRIPT FAILURE:**
- The \`target.label\` MUST always be the **visible text label on the UI element itself** (e.g., a button label, input field label, heading, or link text visible on screen).
- **NEVER output a \`target\` with an empty or blank \`label\` field.** Example of BANNED output: \`{"action":"scroll","target":{"label":""}}\`. This will CRASH the engine.
- **NEVER output a \`duration\` field on a \`scroll\` action.** It is not a valid field.
- NEVER use a value you are about to type as a \`target.label\`. For example, if you want to type a bucket name into a "Bucket name" textbox, the target label is \`"Bucket name"\`, NOT \`"demo-s3-bucket-789012"\`.
- NEVER use a dynamic value (bucket name, resource name, ARN, ID) as a \`target.label\` unless that exact text is visibly rendered as a link or button on the screen AFTER the resource has been created.
- After creating a resource, use \`waitForNetworkIdle\` first, then \`click\` the resource by its exact name (since the listing renders it as a link).
- **For \`scroll\` actions: ONLY use \`direction\` ("down" or "up") and \`distance\` (pixels). NEVER include a \`target\` or \`duration\` field on a scroll action.**
- For the global search bar, use action \`search\` with just a \`value\` field (no \`target\` needed).

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
    { "action": "click", "target": { "label": "Amazon ${topic}", "type": "link" } },
    { "action": "waitForNetworkIdle" },
    { "action": "highlight", "target": { "label": "Create bucket", "type": "button" } },
    { "action": "click", "target": { "label": "Create bucket", "type": "button" } },
    { "action": "waitForNetworkIdle" },
    {
      "action": "type",
      "target": { "label": "Bucket name", "type": "textbox" },
      "value": "demo-videogen-001"
    },
    { "action": "scroll", "direction": "down", "distance": 300 },
    { "action": "highlight", "target": { "label": "Block all public access", "type": "checkbox" } },
    { "action": "scroll", "direction": "down", "distance": 300 },
    { "action": "highlight", "target": { "label": "Create bucket", "type": "button" } },
    { "action": "click", "target": { "label": "Create bucket", "type": "button" } },
    { "action": "waitForNetworkIdle" },
    { "action": "click", "target": { "label": "demo-videogen-001", "type": "link" } }
  ]
}

Available actions for steps:
- goto (requires 'url')
- waitForNetworkIdle (optional 'timeout')
- search (requires 'value' - types into the global AWS search bar)
- click (requires 'target' object with 'label' and 'type')
- doubleClick (requires 'target' object)
- type (requires 'target' object to focus the field, plus 'value' to type)
- select (requires 'target' object, plus 'value')
- check / uncheck (requires 'target' object)
- hover (requires 'target' object)
- scroll (requires 'direction': "up"/"down" and 'distance' in pixels)
- highlight (requires 'target' object - draws a visual box around the element)
- wait (requires 'duration' in ms - AVOID IF POSSIBLE)

Ensure the steps logically flow like a real human navigating the console. Do NOT use CSS selectors. Use ONLY semantic labels and types (e.g., type: "button", "link", "textbox", "checkbox", "dropdown", "tab", "section").
`;

    const runAwsModelWithRetry = async (modelName) => {
      let attempts = 0;
      const maxAttempts = 3;
      let delay = 5000;

      while (attempts < maxAttempts) {
        console.log(`Attempt ${attempts + 1}/${maxAttempts}`);
        try {
          const response = await ai.models.generateContent({
            model: modelName,
            contents: prompt,
            config: {
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
                            type: { type: 'string' }
                          },
                          required: ['label']
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
          return response;
        } catch (err) {
          let status = err.status;
          if (!status && err.message) {
            try {
              const match = err.message.match(/"code"\s*:\s*(\d+)/);
              if (match) {
                status = parseInt(match[1], 10);
              }
            } catch (e) {}
          }

          console.warn(`${modelName === 'gemini-3.6-flash' ? 'Gemini 3.6 Flash' : modelName} returned ${status || 'error'}`);

          if (status === 404 || status === 401 || status === 403 || status === 400) {
            console.warn(`[AWS Script Gen] Fatal error ${status} encountered. Immediate fail/fallback without further retries.`);
            throw err;
          }

          attempts++;
          if (attempts >= maxAttempts) {
            if (modelName === 'gemini-3.6-flash') {
              console.warn(`Switching to fallback model: gemini-3.5-flash-lite`);
            }
            throw err;
          }
          console.log(`Retrying in ${delay}ms`);
          await new Promise(resolve => setTimeout(resolve, delay));
          delay *= 2;
        }
      }
    };

    let response;
    try {
      console.log('Primary Gemini model: gemini-3.6-flash');
      response = await runAwsModelWithRetry('gemini-3.6-flash');
    } catch (error) {
      response = await runAwsModelWithRetry('gemini-3.5-flash-lite');
      console.log('Fallback model succeeded');
    }

    let text = response.text;

    const cleanedText = cleanJsonString(text);
    res.status(200).json({ success: true, text: cleanedText });
  } catch (error) {
    console.error('AWS script generation error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate AWS script', error: error.message });
  }
};

module.exports = {
  generateVideo,
  generateScript,
  generateAwsScript
};
