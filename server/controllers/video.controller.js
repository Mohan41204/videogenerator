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
      if (!Array.isArray(slides)) throw new Error('Expected an array of slides');

      // Auto-fix any structure issues
      slides = slides.map(slide => {
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

    // --- STEP 3: Render animated screen-share video with Puppeteer ---
    console.log('Rendering screen-share video with Puppeteer...');
    const puppeteerService = require('../services/puppeteer.service');
    await puppeteerService.renderScreenShareVideo(slides, durations, screenVideoPath);

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

OUTPUT FORMAT:
You MUST output ONLY a valid JSON array of "Slide" objects. Do not include markdown formatting, headings symbols, or code block formatting outside the JSON. Just raw JSON array.
Each Slide object must have:
- "heading": (String) A short, professional title for the slide.
- "subheading": (String) An optional subtitle or secondary thought. Can be empty string.
- "bullets": (Array of Strings) 2 to 4 bullet points summarizing the visual content. Keep these brief! (Except for programming code slides where the array should contain exactly one string representing the code block).
- "narration": (String) The spoken teaching script for this slide (~${Math.round(targetWords / slideCount)} words). Output plain narration text only for this field.
- "isCode": (Boolean) Set to true if this slide is a code example or contains code, and false otherwise.
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
                heading: { type: 'string' },
                subheading: { type: 'string' },
                bullets: {
                  type: 'array',
                  items: { type: 'string' }
                },
                narration: { type: 'string' },
                isCode: { type: 'boolean' },
                fileName: { type: 'string' },
                runCommand: { type: 'string' }
              },
              required: ['heading', 'subheading', 'bullets', 'narration', 'isCode']
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

module.exports = {
  generateVideo,
  generateScript
};
