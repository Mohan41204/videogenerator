/**
 * videoGeneration.job.js
 *
 * Cloud Run Job Entrypoint for Long-Running Video Generation.
 *
 * Features:
 * - Controlled concurrency for Translation, TTS, Image Gen, and Puppeteer Rendering.
 * - Stage-level caching/checkpointing via GCS job state.
 * - Detailed performance timing instrumentation ([PERF]).
 * - Language-level fault isolation.
 * - Isolated temporary directories per language.
 */

const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

// Initialize env
dotenv.config();
if (!process.env.GOOGLE_CLOUD_PROJECT) {
  dotenv.config({ path: path.join(__dirname, '../../../.env') });
  dotenv.config({ path: path.join(__dirname, '../../.env') });
}

// Auto-detect Google Cloud Credentials if JSON env present
if (process.env.GOOGLE_CREDENTIALS_JSON && (!process.env.GOOGLE_APPLICATION_CREDENTIALS || !fs.existsSync(process.env.GOOGLE_APPLICATION_CREDENTIALS))) {
  try {
    const credPath = path.join(require('os').tmpdir(), 'google-credentials.json');
    fs.writeFileSync(credPath, process.env.GOOGLE_CREDENTIALS_JSON);
    process.env.GOOGLE_APPLICATION_CREDENTIALS = credPath;
  } catch (e) {
    console.error('[VideoJobInit] Error writing GOOGLE_CREDENTIALS_JSON:', e);
  }
}

const audioService = require('../services/audio.service');
const ffmpegService = require('../services/ffmpeg.service');
const storageService = require('../services/storage.service');
const imageGenService = require('../services/imageGeneration.service');
const rendererFactory = require('../renderer/rendererFactory');
const translationService = require('../services/translation.service');
const SUPPORTED_LANGUAGES = require('../config/languages');
const { mapConcurrent } = require('../utils/promisePool');

// Concurrency Controls with sensible defaults
const TRANSLATION_CONCURRENCY = parseInt(process.env.TRANSLATION_CONCURRENCY, 10) || 3;
const TTS_CONCURRENCY = parseInt(process.env.TTS_CONCURRENCY, 10) || 2;
const IMAGE_GENERATION_CONCURRENCY = parseInt(process.env.IMAGE_GENERATION_CONCURRENCY, 10) || 2;
const RENDER_CONCURRENCY = parseInt(process.env.RENDER_CONCURRENCY, 10) || 2;

// Robust JSON extraction utility
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

let currentJobId = null;
let currentTempDir = null;

// Graceful termination handling
const cleanupAndExit = async (exitCode, errorMessage = null) => {
  console.log(`[VideoJob] Exiting job ${currentJobId || 'unknown'} with code ${exitCode}...`);
  if (currentJobId && errorMessage) {
    try {
      await storageService.saveJob(currentJobId, {
        status: 'failed',
        error: errorMessage
      });
    } catch (err) {
      console.error('[VideoJob] Failed to mark job as failed in storage:', err.message);
    }
  }

  // Clean temporary folder in /tmp/video-jobs/<jobId>
  if (currentTempDir && fs.existsSync(currentTempDir)) {
    try {
      fs.rmSync(currentTempDir, { recursive: true, force: true });
      console.log(`[VideoJob] Cleaned up temporary directory: ${currentTempDir}`);
    } catch (e) {
      console.warn(`[VideoJob] Error deleting temporary directory ${currentTempDir}:`, e.message);
    }
  }

  process.exit(exitCode);
};

process.on('SIGTERM', async () => {
  console.error('[VideoJob] SIGTERM received - terminating graceful worker execution');
  await cleanupAndExit(1, 'Cloud Run Job execution terminated via SIGTERM');
});

process.on('SIGINT', async () => {
  console.error('[VideoJob] SIGINT received - terminating worker execution');
  await cleanupAndExit(1, 'Cloud Run Job execution interrupted');
});

async function main() {
  const jobStartTime = Date.now();
  const jobId = process.env.VIDEO_JOB_ID || process.argv[2];
  if (!jobId) {
    console.error('[VideoJob] ERROR: VIDEO_JOB_ID environment variable or CLI argument is missing.');
    process.exit(1);
  }

  currentJobId = jobId;
  console.log(`[VideoJob] Starting execution for jobId: ${jobId}`);
  console.log(`[PERF] Translation concurrency: ${TRANSLATION_CONCURRENCY}`);
  console.log(`[PERF] TTS concurrency: ${TTS_CONCURRENCY}`);
  console.log(`[PERF] Image concurrency: ${IMAGE_GENERATION_CONCURRENCY}`);
  console.log(`[PERF] Render concurrency: ${RENDER_CONCURRENCY}`);

  // Retrieve job record from GCS / memory storage
  const jobRecord = await storageService.getJob(jobId);
  if (!jobRecord) {
    console.error(`[VideoJob] ERROR: Job request record for ${jobId} not found in storage.`);
    process.exit(1);
  }

  // Idempotency check: If job is already completed, exit safely
  if (jobRecord.status === 'completed') {
    console.log(`[VideoJob] Job ${jobId} is already marked as 'completed'. Exiting idempotently.`);
    process.exit(0);
  }

  // Retrieve input parameters from job record payload
  const requestData = jobRecord.requestPayload || jobRecord.data || {};
  const { text, voiceId, selectedLanguages } = requestData;

  if (!text) {
    console.error(`[VideoJob] ERROR: No text/script found in job request record ${jobId}`);
    await cleanupAndExit(1, 'Missing text payload in video job record');
    return;
  }

  // Update status to processing
  await storageService.saveJob(jobId, {
    ...jobRecord,
    status: 'processing',
    progress: 5,
    message: 'Starting Cloud Run Job pipeline...'
  });

  // Isolated workspace directory inside /tmp
  currentTempDir = path.join('/tmp', 'video-jobs', jobId);
  const videoDir = path.join(currentTempDir, 'video');
  const audioDir = path.join(currentTempDir, 'audio');
  const imagesDir = path.join(currentTempDir, 'images');

  fs.mkdirSync(videoDir, { recursive: true });
  fs.mkdirSync(audioDir, { recursive: true });
  fs.mkdirSync(imagesDir, { recursive: true });

  const finalVideoPath = path.join(videoDir, `${jobId}.mp4`);
  const screenVideoPath = path.join(currentTempDir, `${jobId}_screen.mp4`);

  try {
    // --- STAGE 1: Parse slides JSON ---
    const scriptStartTime = Date.now();
    console.log(`[VideoJob] [${jobId}] Stage: Parsing script JSON...`);
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
      console.error(`[VideoJob] [${jobId}] JSON parsing error: ${e.message}`);
      await cleanupAndExit(1, `Invalid script JSON: ${e.message}`);
      return;
    }
    console.log(`[PERF] Script generation: ${((Date.now() - scriptStartTime) / 1000).toFixed(1)}s`);

    const isCustomVoice = voiceId && typeof voiceId === 'string' && voiceId.trim() !== '' && voiceId !== 'default-computer' && voiceId !== 'default';
    const resolvedVoiceId = isCustomVoice ? voiceId.trim() : null;

    // --- STAGE 2: Master English Audio Generation ---
    const englishAudioStartTime = Date.now();
    console.log(`[VideoJob] [${jobId}] Stage: Generating English audio for ${slides.length} slides...`);
    await storageService.saveJob(jobId, { status: 'processing', stage: 'audio_generating', progress: 15 });

    const englishAudioPaths = [];
    const englishDurations = [];
    const englishMasterPath = path.join(audioDir, `${jobId}_english.mp3`);

    for (let i = 0; i < slides.length; i++) {
      const slide = slides[i];
      const chunkPath = path.join(currentTempDir, `${jobId}_chunk_${i}_en.mp3`);
      await audioService.generateAudio(slide.narration || ' ', chunkPath, 'en', resolvedVoiceId);
      const duration = await audioService.getAudioDuration(chunkPath);
      englishAudioPaths.push(chunkPath);
      englishDurations.push(duration);
    }
    await audioService.mergeAudioFiles(englishAudioPaths, englishMasterPath);
    console.log(`[PERF] English TTS total: ${((Date.now() - englishAudioStartTime) / 1000).toFixed(1)}s`);

    // --- STAGE 3: Real-World Visual Scenario Image Generation ---
    const imageGenStartTime = Date.now();
    console.log(`[VideoJob] [${jobId}] Stage: Visual scenario generation...`);
    await storageService.saveJob(jobId, { status: 'processing', stage: 'visual_generating', progress: 30 });

    const slidesNeedingImages = [];
    for (let i = 0; i < slides.length; i++) {
      const slide = slides[i];
      if (slide.realWorldVisual && slide.realWorldVisual.enabled && slide.realWorldVisual.imagePrompt && !slide.imagePath) {
        slidesNeedingImages.push({ slide, i });
      }
    }

    const createdImagePaths = [];
    if (slidesNeedingImages.length > 0) {
      await mapConcurrent(slidesNeedingImages, IMAGE_GENERATION_CONCURRENCY, async ({ slide, i }) => {
        const imageFileName = `${jobId}_scene_${i}_scenario.jpg`;
        const imageFilePath = path.join(imagesDir, imageFileName);
        try {
          const genResult = await imageGenService.generateScenarioImage(slide.realWorldVisual.imagePrompt, imageFilePath);
          if (genResult.success) {
            slide.imagePath = imageFilePath;
            slide.imageUrl = `/output/images/${imageFileName}`;
            createdImagePaths.push({ i, imageFileName, imageFilePath });
          } else {
            console.warn(`[VideoJob] Real-world visual generation failed for scene ${i + 1}: ${genResult.error}`);
            slide.realWorldVisual.enabled = false;
          }
        } catch (imgErr) {
          console.warn(`[VideoJob] Error generating real-world image for scene ${i + 1}:`, imgErr.message);
          slide.realWorldVisual.enabled = false;
        }
      });
    }
    console.log(`[PERF] Image generation total: ${((Date.now() - imageGenStartTime) / 1000).toFixed(1)}s`);

    // --- STAGE 4: Master English Puppeteer Video Rendering ---
    const englishRenderStartTime = Date.now();
    console.log(`[VideoJob] [${jobId}] Stage: Master English video rendering...`);
    await storageService.saveJob(jobId, { status: 'processing', stage: 'rendering', progress: 45 });

    const type = (slides.length > 0 && slides[0].type) ? slides[0].type : 'programming';
    const renderer = rendererFactory.getRenderer(type);
    await renderer.renderVideo(slides, englishDurations, screenVideoPath);
    console.log(`[PERF] Rendering - en: ${((Date.now() - englishRenderStartTime) / 1000).toFixed(1)}s`);

    // --- STAGE 5: FFmpeg Audio/Video Merge (Master English) ---
    console.log(`[VideoJob] [${jobId}] Stage: Merging master English video and audio...`);
    await ffmpegService.mergeVideoAndAudio(screenVideoPath, englishMasterPath, finalVideoPath);

    // --- STAGE 6: Master English GCS Upload ---
    let masterVideoUrl = `/output/video/${jobId}.mp4`;
    let masterVideoObject = `videos/${jobId}/english.mp4`;

    if (storageService.isStorageConfigured()) {
      const uploadRes = await storageService.uploadFile(finalVideoPath, masterVideoObject);
      if (uploadRes) {
        masterVideoUrl = uploadRes.url;
        masterVideoObject = uploadRes.objectName;
      }

      for (const item of createdImagePaths) {
        const imgGcsObject = `videos/${jobId}/images/${item.imageFileName}`;
        const imgUpload = await storageService.uploadFile(item.imageFilePath, imgGcsObject);
        if (imgUpload) {
          slides[item.i].imageObject = imgUpload.objectName;
          slides[item.i].imageUrl = imgUpload.url;
        }
      }
    }

    // Existing languages state from storage (checkpoint support)
    const existingJobData = jobRecord.data || {};
    const existingVideos = (existingJobData.videos) || (jobRecord.languages) || {};
    
    const videos = {
      ...existingVideos,
      en: {
        url: masterVideoUrl,
        objectName: masterVideoObject,
        language: 'English',
        code: 'en',
        slides: slides,
        stages: { translation: 'completed', tts: 'completed', rendering: 'completed', upload: 'completed' }
      }
    };

    // --- STAGE 7: Parallel Multilingual Processing & Rendering ---
    const enableMultilingual = process.env.ENABLE_MULTILINGUAL_AUDIO === 'true';
    const failedLanguages = [];
    let jobResultStatus = 'success';

    if (enableMultilingual) {
      const multilingualStartTime = Date.now();
      console.log(`[VideoJob] [${jobId}] Stage: Parallel Multilingual pipeline initialization...`);
      let langCodes = Object.keys(SUPPORTED_LANGUAGES).filter(k => k !== 'en');
      if (selectedLanguages && Array.isArray(selectedLanguages)) {
        langCodes = langCodes.filter(k => selectedLanguages.includes(k));
      }

      // Checkpoint check: Filter out already completed languages
      const langsToProcess = langCodes.filter(lang => {
        const existingLang = videos[lang];
        if (existingLang && existingLang.stages && existingLang.stages.upload === 'completed' && existingLang.url) {
          console.log(`[Cache] ${SUPPORTED_LANGUAGES[lang]?.name || lang} video already fully completed. Skipping.`);
          return false;
        }
        return true;
      });

      if (langsToProcess.length > 0) {
        await storageService.saveJob(jobId, { status: 'processing', stage: 'multilingual_processing', progress: 60 });

        // Execute controlled parallel language pipelines
        await mapConcurrent(langsToProcess, RENDER_CONCURRENCY, async (lang) => {
          const langStartTime = Date.now();
          const langConfig = SUPPORTED_LANGUAGES[lang];
          const langName = langConfig.name;
          const langDir = path.join(currentTempDir, 'languages', lang);
          fs.mkdirSync(langDir, { recursive: true });

          const langVideoFileName = `${jobId}_${langConfig.code}.mp4`;
          const langVideoPath = path.join(videoDir, langVideoFileName);
          const masterLangAudioPath = path.join(audioDir, `${jobId}_${langConfig.fileName}`);
          const langScreenVideoPath = path.join(langDir, `${jobId}_screen_${lang}.mp4`);

          try {
            // Step A: Translation (Parallelized)
            const transStartTime = Date.now();
            console.log(`[VideoJob] Translating slides for ${langName}...`);
            const langSlides = await translationService.translateSlides(slides, langName);
            console.log(`[PERF] Translation - ${lang}: ${((Date.now() - transStartTime) / 1000).toFixed(1)}s`);

            // Step B: TTS Generation
            const ttsStartTime = Date.now();
            console.log(`[VideoJob] Generating TTS for ${langName}...`);
            const langChunks = [];

            // Perform controlled concurrent chunk TTS generation for this language
            await mapConcurrent(langSlides, TTS_CONCURRENCY, async (slide, i) => {
              const translatedNarration = await translationService.translateText(slide.narration || ' ', langName);
              const rawChunkPath = path.join(langDir, `${jobId}_rawchunk_${i}_${lang}.mp3`);
              await audioService.generateAudio(translatedNarration, rawChunkPath, langConfig.code, resolvedVoiceId);

              const adjustedChunkPath = path.join(langDir, `${jobId}_chunk_${i}_${lang}.mp3`);
              await audioService.adjustAudioDuration(rawChunkPath, adjustedChunkPath, englishDurations[i]);
              langChunks[i] = adjustedChunkPath;
              if (fs.existsSync(rawChunkPath)) fs.unlinkSync(rawChunkPath);
            });

            await audioService.mergeAudioFiles(langChunks, masterLangAudioPath);
            console.log(`[PERF] TTS - ${lang}: ${((Date.now() - ttsStartTime) / 1000).toFixed(1)}s`);

            // Step C: Isolated Puppeteer Video Rendering
            const renderStartTime = Date.now();
            console.log(`[VideoJob] Rendering localized video for ${langName}...`);
            await renderer.renderVideo(langSlides, englishDurations, langScreenVideoPath);
            console.log(`[PERF] Rendering - ${lang}: ${((Date.now() - renderStartTime) / 1000).toFixed(1)}s`);

            // Step D: FFmpeg Merge
            await ffmpegService.mergeVideoAndAudio(langScreenVideoPath, masterLangAudioPath, langVideoPath);

            // Step E: GCS Upload
            const uploadStartTime = Date.now();
            let langVideoUrl = `/output/video/${langVideoFileName}`;
            let langVideoObject = `videos/${jobId}/languages/${langConfig.code}.mp4`;

            if (storageService.isStorageConfigured()) {
              const langUpload = await storageService.uploadFile(langVideoPath, langVideoObject);
              if (langUpload) {
                langVideoUrl = langUpload.url;
                langVideoObject = langUpload.objectName;
              }
            }
            console.log(`[PERF] GCS upload - ${lang}: ${((Date.now() - uploadStartTime) / 1000).toFixed(1)}s`);

            // Store successful language entry
            videos[lang] = {
              url: langVideoUrl,
              objectName: langVideoObject,
              language: langName,
              code: langConfig.code,
              slides: langSlides,
              stages: { translation: 'completed', tts: 'completed', rendering: 'completed', upload: 'completed' }
            };

            const langTotalSec = ((Date.now() - langStartTime) / 1000).toFixed(1);
            console.log(`[PERF] Language generation - ${lang}: ${langTotalSec}s`);

            // Checkpoint intermediate success to storage
            await storageService.saveJob(jobId, {
              status: 'processing',
              data: {
                videoUrl: videos.en.url,
                videoObject: videos.en.objectName,
                id: jobId,
                videos
              }
            });

          } catch (err) {
            console.error(`[VideoJob] Failed localized video pipeline for ${lang}:`, err.message);
            jobResultStatus = 'partial';
            failedLanguages.push({ code: lang, error: err.message });
            videos[lang] = {
              code: langConfig.code,
              language: langName,
              stages: { translation: 'failed', tts: 'failed', rendering: 'failed', upload: 'failed' },
              error: err.message
            };
          }
        });
      }
      console.log(`[PERF] Multilingual total: ${((Date.now() - multilingualStartTime) / 1000).toFixed(1)}s`);
    }

    // --- STAGE 8: Save Metadata JSON & Finalize Job ---
    const metadataPath = path.join(currentTempDir, `${jobId}_metadata.json`);
    const metadataContent = JSON.stringify({
      id: jobId,
      slides,
      englishDurations,
      languages: videos,
      voiceId: resolvedVoiceId
    }, null, 2);
    fs.writeFileSync(metadataPath, metadataContent);

    if (storageService.isStorageConfigured()) {
      await storageService.uploadFile(metadataPath, `videos/${jobId}/metadata.json`);
    }

    const totalJobSec = ((Date.now() - jobStartTime) / 1000).toFixed(1);
    console.log(`[PERF] Total job duration: ${totalJobSec}s`);

    await storageService.saveJob(jobId, {
      status: 'completed',
      progress: 100,
      message: jobResultStatus === 'partial' ? 'Video generated with some language failures' : 'Video generated successfully',
      failedLanguages: failedLanguages.length > 0 ? failedLanguages : undefined,
      data: {
        videoUrl: videos.en.url,
        videoObject: videos.en.objectName || `videos/${jobId}/english.mp4`,
        id: jobId,
        videos
      }
    });

    console.log(`[VideoJob] Video generation job ${jobId} completed successfully in ${totalJobSec}s!`);
    await cleanupAndExit(0);
  } catch (error) {
    console.error(`[VideoJob] Fatal error in video generation job ${jobId}:`, error);
    await cleanupAndExit(1, error.message);
  }
}

main().catch(async (err) => {
  console.error('[VideoJob] Uncaught error in job main:', err);
  await cleanupAndExit(1, err.message);
});
