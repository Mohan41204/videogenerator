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
    let backgroundPath = req.file ? req.file.path : null;

    if (!text) {
      return res.status(400).json({ success: false, message: 'Text is required' });
    }

    const uniqueId = uuidv4();
    const outputDir = path.join(__dirname, '../output');

    const finalAudioPath = path.join(outputDir, `${uniqueId}.mp3`);
    const assFilePath = path.join(outputDir, `${uniqueId}.ass`);
    const finalVideoPath = path.join(outputDir, `${uniqueId}.mp4`);

    console.log('Parsing script as JSON slides...');
    let slides;
    try {
      const cleaned = cleanJsonString(text);
      slides = JSON.parse(cleaned);
      if (!Array.isArray(slides)) throw new Error('Expected an array of slides');
      
      // Auto-fix any structure issues (e.g., model using 'code' instead of 'bullets')
      slides = slides.map(slide => {
        if (slide.code && (!slide.bullets || !slide.bullets.length)) {
          slide.bullets = [slide.code];
        }
        if (slide.isCode === undefined) {
          const isCodeSlide = /code|program|example|syntax/i.test(slide.heading || slide.subheading || '') ||
                              (slide.bullets && slide.bullets.length === 1 && (slide.bullets[0].includes('\\N') || slide.bullets[0].includes('\n')));
          slide.isCode = isCodeSlide;
        }
        return slide;
      });
    } catch (e) {
      console.error('JSON parsing error details:', e);
      console.error('Raw text that failed parsing:', text);
      return res.status(400).json({ success: false, message: `Script text must be a valid JSON array of slides. Error: ${e.message}` });
    }

    let audioPaths = [];
    let durations = [];

    // 1. Generate audio for each slide's narration
    console.log(`Generating audio for ${slides.length} slides...`);
    const batchSize = 10;
    for (let i = 0; i < slides.length; i += batchSize) {
      const batch = slides.slice(i, i + batchSize);

      const batchPromises = batch.map(async (slide, batchIndex) => {
        const actualIndex = i + batchIndex;
        const chunkPath = path.join(outputDir, `${uniqueId}_chunk_${actualIndex}.mp3`);
        await audioService.generateAudio(slide.narration || ' ', chunkPath);
        const duration = await audioService.getAudioDuration(chunkPath);
        return { path: chunkPath, duration };
      });

      const results = await Promise.all(batchPromises);
      results.forEach(res => {
        audioPaths.push(res.path);
        durations.push(res.duration);
      });
    }

    // 2. Generate ASS Subtitle File for Slides
    console.log('Generating ASS subtitle file for slides...');
    await subtitleService.generateAssFile(slides, durations, assFilePath, format);

    // 3. Merge Audio Chunks
    console.log('Merging audio chunks...');
    await audioService.mergeAudioFiles(audioPaths, finalAudioPath);

    // 4. Generate Final Video
    console.log('Generating video with subtitles...');
    await ffmpegService.generateVideo(finalAudioPath, backgroundPath, assFilePath, finalVideoPath, format);

    // 5. Clean up temporary files
    if (req.file) {
      fs.unlink(backgroundPath, () => { });
    }
    fs.unlink(finalAudioPath, () => { });
    fs.unlink(assFilePath, () => { });
    audioPaths.forEach(p => fs.unlink(p, () => { }));

    const videoUrl = `/output/${uniqueId}.mp4`;

    res.status(200).json({
      success: true,
      message: 'Video generated successfully',
      data: {
        videoUrl,
        id: uniqueId
      }
    });

  } catch (error) {
    console.error('Video generation error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate video', error: error.message });
  }
};

const generateScript = async (req, res) => {
  try {
    const { topic, subTopic } = req.body;
    if (!topic) {
      return res.status(400).json({ success: false, message: 'Topic is required' });
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const prompt = `
Imagine you are an experienced classroom teacher creating detailed spoken study notes for students.

Your task is to generate a complete teaching script for the topic: "${topic}".
The subtopic to focus on is: "${subTopic || 'General Concepts'}".

Requirements for the teaching style:
- The script must teach students from beginner level to advanced understanding step by step.
- CRITICAL: Determine if the topic and subtopic are related to programming, coding, software engineering, databases, APIs, frameworks, markup languages, styling languages, or technical computer science concepts (e.g., Python, Java, Javascript, HTML/CSS, React, SQL, Git, Loops, OOP, Algorithms, Web Development, etc.):
  - **If the topic/subtopic is programming/coding-related, you MUST include actual, concrete example coding snippets**:
    - For every core concept/subconcept of the topic (e.g., if topic is "Python" and subtopic is "OOPS", core concepts would be Class & Object, Encapsulation, Inheritance, Polymorphism, Abstraction, etc.):
      - Provide at least one slide with a **Basic Example Program** showing the fundamental implementation.
      - Provide at least one slide with an **Advanced Example Program** showing real-world / production-grade implementation.
      - Make sure the example programs are complete, realistic, and directly show the concepts in action.
    - For slides displaying code examples, the \`bullets\` array should contain exactly one string representing the full, formatted, and indented code block. Use \\N (the literal string '\\N') to represent newlines inside the code block so that lines and spacing are perfectly preserved on the screen. Do NOT include markdown code fences (\`\`\`) inside the bullets array. Write real, complete, professional code snippets (e.g., \`"class Dog:\\\\N    def __init__(self, name):\\\\N        self.name = name"\`).
    - CRITICAL CODE LIMITATION: Keep code examples short, concise, and highly focused. Each code block MUST NOT exceed 6 to 10 lines of code total. Avoid writing long boilerplate code, multiple classes, or large mock datasets. The code snippet should be short enough to occupy no more than 40% of the slide height, so it has plenty of breathing room on the screen.
    - The slide object MUST have "isCode": true.
  - **If the topic/subtopic is NOT related to programming/coding**:
    - Do NOT include any programming code blocks or example programs.
    - Instead, generate detailed explanation slides, and if possible, include concrete real-world examples, analogies, practical case studies, and scenarios related to the topic and subtopic.
    - The slide object MUST have "isCode": false.
- Explain every concept and example in a very simple, easy-to-understand classroom teaching style.
- Use friendly teacher-to-student communication.
- Include real-world examples, analogies, practical explanations, and small exercises where appropriate.
- Cover definitions, theory, syntax, examples, use cases, common mistakes, and interview-oriented understanding.
- The explanation should feel like a real classroom session where a teacher explains concepts slowly and clearly.
- Keep the flow natural and engaging so students can easily follow along in a video lesson.
- The generated content must be long and detailed enough for at least a 30-minute MP4 educational video narration.
- Maintain continuity between topics and subtopics.
- Avoid short summaries; provide deep explanations with beginner-friendly teaching.

OUTPUT FORMAT:
You MUST output ONLY a valid JSON array of "Slide" objects. Do not include markdown formatting, headings symbols, or code block formatting outside the JSON. Do not include phrases like "fade in", "pause", "screen shows". Just raw JSON array.
Each Slide object must have:
- "heading": (String) A short, professional title for the slide.
- "subheading": (String) An optional subtitle or secondary thought. Can be empty string.
- "bullets": (Array of Strings) 2 to 4 bullet points summarizing the visual content. Keep these brief! (Except for programming code slides where the array should contain exactly one string representing the code block).
- "narration": (String) The long, detailed spoken teaching script for this slide matching all the teaching style requirements above. Output plain narration text only for this field.
- "isCode": (Boolean) Set to true if this slide is a code example or contains code, and false otherwise.
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
                isCode: { type: 'boolean' }
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
