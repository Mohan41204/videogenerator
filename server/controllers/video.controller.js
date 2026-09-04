const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const audioService = require('../services/audio.service');
const ffmpegService = require('../services/ffmpeg.service');
const subtitleService = require('../services/subtitle.service');
const { GoogleGenAI } = require('@google/genai');
const teachingEngine = require('../services/teachingEngine.service');

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
        } else if (slides.scenes && Array.isArray(slides.scenes)) {
          slides = slides.scenes;
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
    const isCustomVoice = voiceId && typeof voiceId === 'string' && voiceId.trim() !== '' && voiceId !== 'default-computer' && voiceId !== 'default';
    const resolvedVoiceId = isCustomVoice ? voiceId.trim() : null;

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

    // --- STEP 1b: Generate Real-World Visual Scenario Images (if present) ---
    const imageGenService = require('../services/imageGeneration.service');
    const imagesDir = path.join(outputDir, 'images');
    if (!fs.existsSync(imagesDir)) fs.mkdirSync(imagesDir, { recursive: true });

    for (let i = 0; i < slides.length; i++) {
      const slide = slides[i];
      if (slide.realWorldVisual && slide.realWorldVisual.enabled && slide.realWorldVisual.imagePrompt && !slide.imagePath) {
        const imageFileName = `${uniqueId}_scene_${i}_scenario.jpg`;
        const imageFilePath = path.join(imagesDir, imageFileName);
        try {
          const genResult = await imageGenService.generateScenarioImage(slide.realWorldVisual.imagePrompt, imageFilePath);
          if (genResult.success) {
            slide.imagePath = imageFilePath;
            slide.imageUrl = `/output/images/${imageFileName}`;
          } else {
            console.warn(`[VideoController] Real-world visual generation failed for scene ${i + 1}: ${genResult.error}`);
            slide.realWorldVisual.enabled = false;
          }
        } catch (imgErr) {
          console.warn(`[VideoController] Error generating real-world image for scene ${i + 1}:`, imgErr.message);
          slide.realWorldVisual.enabled = false;
        }
      }
    }

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
            await audioService.generateAudio(translatedNarration, rawChunkPath, langConfig.code, resolvedVoiceId);
            
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

    const scriptResult = await teachingEngine.generateTeachingScript({
      topic,
      subTopic,
      durationMinutes
    });

    res.status(200).json({
      success: true,
      text: scriptResult.text,
      plan: scriptResult.plan,
      domain: scriptResult.domain
    });
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

    const client = new GoogleGenAI({
      vertexai: process.env.GOOGLE_GENAI_USE_VERTEXAI === 'true',
      project: process.env.GOOGLE_CLOUD_PROJECT,
      location: process.env.GOOGLE_CLOUD_LOCATION || 'global',
    });

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
7. NEVER emit two or more scroll actions back-to-back to reach the same target. Combine them into ONE scroll action with a larger "distance" instead.
8. Only insert a scroll action when the next target is very likely off-screen.
9. NEVER scroll to, or place the cursor near, the very top of the viewport (roughly y < 60px).
10. Do not immediately follow a scroll with another action targeting an element near the top of the viewport (y < 60px).
11. Do not chain unrelated \`highlight\`/\`click\` pairs back-to-back without a navigation or wait action in between.

**CRITICAL ELEMENT TARGETING RULES — VIOLATION = SCRIPT FAILURE:**
- The \`target.label\` MUST always be the **visible text label on the UI element itself**.
- **NEVER output a \`target\` with an empty or blank \`label\` field.**
- NEVER use a value you are about to type as a \`target.label\`.
- NEVER use a dynamic value unless that exact text is visibly rendered.
- After creating a resource, use \`waitForNetworkIdle\` first, then \`click\` the resource by its exact name.
- For the global search bar, use action \`search\` with just a \`value\` field.

**TARGET DISAMBIGUATION — \`target.context\`:**
- Every \`target\` object MUST include a \`context\` string field describing WHERE on the page the element is located.

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
    { "action": "click", "target": { "label": "Amazon ${topic}", "type": "link", "context": "search results dropdown item, not the breadcrumb" } }
  ]
}
`;

    const jsonSchema = {
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
    };

    let result;
    let attempts = 0;
    const maxAttempts = 3;
    let delay = 15000;

    while (attempts < maxAttempts) {
      try {
        result = await client.models.generateContent({
          model: 'gemini-3.7-flash',
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            responseSchema: jsonSchema
          }
        });
        if (result.usageMetadata) {
          console.log(`[Token Usage] Provider: vertex-ai, Model: gemini-3.7-flash, Input Tokens: ${result.usageMetadata.promptTokenCount}, Output Tokens: ${result.usageMetadata.candidatesTokenCount}, Total Tokens: ${result.usageMetadata.totalTokenCount}, Timestamp: ${new Date().toISOString()}`);
        }
        break;
      } catch (err) {
        attempts++;
        if (attempts >= maxAttempts) throw err;

        console.warn(`[AWS Script Gen] Attempt ${attempts} failed: ${err.message}. Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 1.5;
      }
    }

    let text = result.text;
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

    const candidateVoiceId = req.body.voiceId !== undefined ? req.body.voiceId : savedVoiceId;
    const isCustomVoice = candidateVoiceId && typeof candidateVoiceId === 'string' && candidateVoiceId.trim() !== '' && candidateVoiceId !== 'default-computer' && candidateVoiceId !== 'default';
    const resolvedVoiceId = isCustomVoice ? candidateVoiceId.trim() : null;

    for (let i = 0; i < langSlides.length; i++) {
      const slide = langSlides[i];
      // Always translate original English narration to mixed-language conversational style for audio
      const translatedNarration = await translationService.translateText(originalSlides[i].narration || ' ', langConfig.name);
      const rawChunkPath = path.join(outputDir, `${id}_rawchunk_${i}_${lang}.mp3`);
      await audioService.generateAudio(translatedNarration, rawChunkPath, langConfig.code, resolvedVoiceId);
      
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