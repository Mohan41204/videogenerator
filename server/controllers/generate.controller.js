const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const audioService = require('../services/audio.service');
const ffmpegService = require('../services/ffmpeg.service');
const teachingEngine = require('../services/teachingEngine.service');

// Robust JSON extraction (same as video.controller.js)
const cleanJsonString = (str) => {
  if (!str) return '';
  const arrayMatch = str.match(/\[\s*\{[\s\S]*\}\s*\]/);
  if (arrayMatch) {
    str = arrayMatch[0];
  } else {
    const objectMatch = str.match(/\{[\s\S]*\}/);
    if (objectMatch) {
      str = objectMatch[0];
    }
  }
  str = str.replace(/^```json\s*/gi, '').replace(/\s*```$/gi, '');
  str = str.replace(/\\(?!["\\/bfnrt]|u[0-9a-fA-F]{4})/g, '\\\\');
  return str.trim();
};

/**
 * One-shot video generation: script generation + video rendering in a single API call.
 * Accepts JSON body: { topic, subTopic, durationMinutes, languages, voiceId }
 * Returns the final video URL(s) on completion.
 */
const generateOneShot = async (req, res) => {
  try {
    const {
      topic,
      subTopic,
      durationMinutes = 5,
      languages,
      voiceId
    } = req.body;

    if (!topic) {
      return res.status(400).json({ success: false, message: 'Topic is required' });
    }

    console.log(`[ONE-SHOT] Starting full pipeline for topic: "${topic}", subTopic: "${subTopic || 'N/A'}", duration: ${durationMinutes}min`);

    // --- PHASE 1: Generate script via teaching engine ---
    console.log('[ONE-SHOT] Phase 1: Generating teaching script...');
    const scriptResult = await teachingEngine.generateTeachingScript({
      topic,
      subTopic,
      durationMinutes: parseInt(durationMinutes, 10) || 5
    });

    if (!scriptResult || !scriptResult.text) {
      return res.status(500).json({ success: false, message: 'Script generation failed — empty result' });
    }

    console.log(`[ONE-SHOT] Script generated. Domain: ${scriptResult.domain}`);

    // --- PHASE 2: Parse slides from generated script ---
    console.log('[ONE-SHOT] Phase 2: Parsing slides...');
    let slides;
    try {
      const cleaned = cleanJsonString(scriptResult.text);
      slides = JSON.parse(cleaned);

      if (Array.isArray(slides) && slides.length > 0 && slides[0].action) {
        slides = [{
          type: 'aws',
          service: 'AWS Service',
          title: 'AWS Tutorial',
          narration: 'Please follow along with the screen recording.',
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
      console.error('[ONE-SHOT] JSON parsing error:', e.message);
      return res.status(500).json({ success: false, message: `Script parsing failed: ${e.message}` });
    }

    console.log(`[ONE-SHOT] Parsed ${slides.length} slides successfully.`);

    // --- PHASE 3: Generate audio, render video, merge ---
    const uniqueId = uuidv4();
    const outputDir = path.join(__dirname, '../output');
    const videoDir = path.join(outputDir, 'video');
    const audioDir = path.join(outputDir, 'audio');
    if (!fs.existsSync(videoDir)) fs.mkdirSync(videoDir, { recursive: true });
    if (!fs.existsSync(audioDir)) fs.mkdirSync(audioDir, { recursive: true });

    const finalVideoPath = path.join(videoDir, `${uniqueId}.mp4`);
    const screenVideoPath = path.join(outputDir, `${uniqueId}_screen.mp4`);

    // Resolve voice
    const isCustomVoice = voiceId && typeof voiceId === 'string' && voiceId.trim() !== '' && voiceId !== 'default-computer' && voiceId !== 'default';
    const resolvedVoiceId = isCustomVoice ? voiceId.trim() : null;

    // Parse selected languages
    let selectedLanguages = null;
    if (languages) {
      try {
        selectedLanguages = typeof languages === 'string' ? JSON.parse(languages) : languages;
      } catch (e) {
        console.error('[ONE-SHOT] Failed to parse languages');
      }
    }

    // STEP 1: Generate English audio
    console.log(`[ONE-SHOT] Phase 3a: Generating English audio for ${slides.length} slides...`);
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

    // STEP 1b: Generate images for real-world visuals
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
            slide.realWorldVisual.enabled = false;
          }
        } catch (imgErr) {
          slide.realWorldVisual.enabled = false;
        }
      }
    }

    // STEP 2: Render animated silent video
    console.log('[ONE-SHOT] Phase 3b: Rendering video frames...');
    const rendererFactory = require('../renderer/rendererFactory');
    const type = (slides.length > 0 && slides[0].type) ? slides[0].type : 'programming';
    const renderer = rendererFactory.getRenderer(type);
    await renderer.renderVideo(slides, englishDurations, screenVideoPath);

    // STEP 3: Merge silent video + English audio
    console.log('[ONE-SHOT] Phase 3c: Merging video + audio...');
    await ffmpegService.mergeVideoAndAudio(screenVideoPath, englishMasterPath, finalVideoPath);

    // STEP 4: Generate multilingual videos
    const SUPPORTED_LANGUAGES = require('../config/languages');
    const translationService = require('../services/translation.service');
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
      console.log('[ONE-SHOT] Phase 4: Generating multilingual videos...');
      let langCodes = Object.keys(SUPPORTED_LANGUAGES).filter(k => k !== 'en');
      if (selectedLanguages && Array.isArray(selectedLanguages)) {
        langCodes = langCodes.filter(k => selectedLanguages.includes(k));
      }

      for (const lang of langCodes) {
        const langConfig = SUPPORTED_LANGUAGES[lang];
        const langVideoFileName = `${uniqueId}_${langConfig.code}.mp4`;
        const langVideoPath = path.join(videoDir, langVideoFileName);
        const masterLangAudioPath = path.join(audioDir, `${uniqueId}_${langConfig.fileName}`);
        const langScreenVideoPath = path.join(outputDir, `${uniqueId}_screen_${lang}.mp4`);

        try {
          console.log(`[ONE-SHOT] Translating slides for ${langConfig.name}...`);
          const langSlides = await translationService.translateSlides(slides, langConfig.name);

          const langChunks = [];
          for (let i = 0; i < langSlides.length; i++) {
            const translatedNarration = await translationService.translateText(slides[i].narration || ' ', langConfig.name);
            const rawChunkPath = path.join(outputDir, `${uniqueId}_rawchunk_${i}_${lang}.mp3`);
            await audioService.generateAudio(translatedNarration, rawChunkPath, langConfig.code, resolvedVoiceId);

            const adjustedChunkPath = path.join(outputDir, `${uniqueId}_chunk_${i}_${lang}.mp3`);
            await audioService.adjustAudioDuration(rawChunkPath, adjustedChunkPath, englishDurations[i]);
            langChunks.push(adjustedChunkPath);
            fs.unlink(rawChunkPath, () => {});
          }
          await audioService.mergeAudioFiles(langChunks, masterLangAudioPath);

          console.log(`[ONE-SHOT] Rendering localized video for ${langConfig.name}...`);
          await renderer.renderVideo(langSlides, englishDurations, langScreenVideoPath);

          await ffmpegService.mergeVideoAndAudio(langScreenVideoPath, masterLangAudioPath, langVideoPath);

          videos[lang] = {
            url: `/output/video/${langVideoFileName}`,
            language: langConfig.name,
            code: langConfig.code,
            slides: langSlides
          };

          langChunks.forEach(p => fs.unlink(p, () => {}));
          fs.unlink(masterLangAudioPath, () => {});
          fs.unlink(langScreenVideoPath, () => {});
        } catch (err) {
          console.error(`[ONE-SHOT] Failed for ${lang}:`, err);
          status = 'partial';
          failedLanguages.push({ code: lang, error: err.message });
        }
      }
    }

    // Save metadata
    const metadataPath = path.join(outputDir, `${uniqueId}_metadata.json`);
    fs.writeFileSync(metadataPath, JSON.stringify({
      slides,
      englishDurations,
      languages: videos,
      voiceId: resolvedVoiceId
    }, null, 2));

    // Cleanup temp files
    fs.unlink(screenVideoPath, () => {});
    englishAudioPaths.forEach(p => fs.unlink(p, () => {}));
    fs.unlink(englishMasterPath, () => {});

    console.log(`[ONE-SHOT] ✅ Complete! Video ID: ${uniqueId}`);

    res.status(200).json({
      success: true,
      status,
      message: status === 'partial' ? 'Video generated with some language failures' : 'Video generated successfully',
      failedLanguages: failedLanguages.length > 0 ? failedLanguages : undefined,
      data: {
        videoUrl: `/output/video/${uniqueId}.mp4`,
        id: uniqueId,
        videos
      }
    });

  } catch (error) {
    console.error('[ONE-SHOT] Fatal error:', error);
    res.status(500).json({ success: false, message: 'Video generation failed', error: error.message });
  }
};

module.exports = {
  generateOneShot
};
