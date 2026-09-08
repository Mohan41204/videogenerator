/**
 * videoGeneration.job.js
 *
 * Cloud Run Job Entrypoint for Long-Running Video Generation.
 *
 * Execution Flow:
 * 1. Read VIDEO_JOB_ID from environment variable process.env.VIDEO_JOB_ID or process.argv
 * 2. Retrieve job request record from GCS / Persistent Storage
 * 3. Update job status to 'processing'
 * 4. Execute video generation pipeline (Gemini script parsing / TTS audio / visuals / Puppeteer / FFmpeg / GCS upload)
 * 5. Update job status to 'completed' with final output URLs
 * 6. Gracefully cleanup isolated temporary directory (/tmp/video-jobs/<jobId>/)
 * 7. Exit process with code 0 on success, code 1 on fatal error
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

// Robust JSON extraction and cleaning utility
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
  const jobId = process.env.VIDEO_JOB_ID || process.argv[2];
  if (!jobId) {
    console.error('[VideoJob] ERROR: VIDEO_JOB_ID environment variable or CLI argument is missing.');
    process.exit(1);
  }

  currentJobId = jobId;
  console.log(`[VideoJob] Starting execution for jobId: ${jobId}`);

  // Retrieve job record from GCS / memory storage
  const jobRecord = await storageService.getJob(jobId);
  if (!jobRecord) {
    console.error(`[VideoJob] ERROR: Job request record for ${jobId} not found in storage.`);
    process.exit(1);
  }

  // Idempotency check: If job is already completed, exit safely with 0
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

    const isCustomVoice = voiceId && typeof voiceId === 'string' && voiceId.trim() !== '' && voiceId !== 'default-computer' && voiceId !== 'default';
    const resolvedVoiceId = isCustomVoice ? voiceId.trim() : null;

    // --- STAGE 2: Audio Generation ---
    console.log(`[VideoJob] [${jobId}] Stage: Generating English audio for ${slides.length} slides...`);
    await storageService.saveJob(jobId, { status: 'processing', stage: 'audio_generating', progress: 20 });

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

    // --- STAGE 3: Real-World Scenario Image Generation ---
    console.log(`[VideoJob] [${jobId}] Stage: Visual scenario generation...`);
    await storageService.saveJob(jobId, { status: 'processing', stage: 'visual_generating', progress: 40 });

    const createdImagePaths = [];
    for (let i = 0; i < slides.length; i++) {
      const slide = slides[i];
      if (slide.realWorldVisual && slide.realWorldVisual.enabled && slide.realWorldVisual.imagePrompt && !slide.imagePath) {
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
      }
    }

    // --- STAGE 4: Puppeteer Video Rendering ---
    console.log(`[VideoJob] [${jobId}] Stage: Puppeteer screen rendering...`);
    await storageService.saveJob(jobId, { status: 'processing', stage: 'rendering', progress: 60 });

    const type = (slides.length > 0 && slides[0].type) ? slides[0].type : 'programming';
    const renderer = rendererFactory.getRenderer(type);
    await renderer.renderVideo(slides, englishDurations, screenVideoPath);

    // --- STAGE 5: FFmpeg Audio/Video Merge ---
    console.log(`[VideoJob] [${jobId}] Stage: Merging video and audio with FFmpeg...`);
    await ffmpegService.mergeVideoAndAudio(screenVideoPath, englishMasterPath, finalVideoPath);

    // --- STAGE 6: GCS Upload ---
    console.log(`[VideoJob] [${jobId}] Stage: Uploading output to GCS...`);
    await storageService.saveJob(jobId, { status: 'processing', stage: 'uploading', progress: 80 });

    let masterVideoUrl = `/output/video/${jobId}.mp4`;
    let masterVideoObject = `videos/${jobId}/english.mp4`;

    if (storageService.isStorageConfigured()) {
      const uploadRes = await storageService.uploadFile(finalVideoPath, masterVideoObject);
      if (uploadRes) {
        masterVideoUrl = uploadRes.url;
        masterVideoObject = uploadRes.objectName;
      }

      // Upload scenario images to GCS
      for (const item of createdImagePaths) {
        const imgGcsObject = `videos/${jobId}/images/${item.imageFileName}`;
        const imgUpload = await storageService.uploadFile(item.imageFilePath, imgGcsObject);
        if (imgUpload) {
          slides[item.i].imageObject = imgUpload.objectName;
          slides[item.i].imageUrl = imgUpload.url;
        }
      }
    }

    // --- STAGE 7: Multilingual Video Generation ---
    const enableMultilingual = process.env.ENABLE_MULTILINGUAL_AUDIO === 'true';
    const videos = {
      en: {
        url: masterVideoUrl,
        objectName: masterVideoObject,
        language: 'English',
        code: 'en',
        slides: slides
      }
    };
    const failedLanguages = [];
    let jobResultStatus = 'success';

    if (enableMultilingual) {
      console.log(`[VideoJob] [${jobId}] Stage: Generating multilingual videos...`);
      let langCodes = Object.keys(SUPPORTED_LANGUAGES).filter(k => k !== 'en');
      if (selectedLanguages && Array.isArray(selectedLanguages)) {
        langCodes = langCodes.filter(k => selectedLanguages.includes(k));
      }

      for (const lang of langCodes) {
        const langConfig = SUPPORTED_LANGUAGES[lang];
        const langVideoFileName = `${jobId}_${langConfig.code}.mp4`;
        const langVideoPath = path.join(videoDir, langVideoFileName);
        const masterLangAudioPath = path.join(audioDir, `${jobId}_${langConfig.fileName}`);
        const langScreenVideoPath = path.join(currentTempDir, `${jobId}_screen_${lang}.mp4`);

        try {
          console.log(`[VideoJob] Translating slides for ${langConfig.name}...`);
          const langSlides = await translationService.translateSlides(slides, langConfig.name);

          const langChunks = [];
          for (let i = 0; i < langSlides.length; i++) {
            const translatedNarration = await translationService.translateText(slides[i].narration || ' ', langConfig.name);
            const rawChunkPath = path.join(currentTempDir, `${jobId}_rawchunk_${i}_${lang}.mp3`);
            await audioService.generateAudio(translatedNarration, rawChunkPath, langConfig.code, resolvedVoiceId);

            const adjustedChunkPath = path.join(currentTempDir, `${jobId}_chunk_${i}_${lang}.mp3`);
            await audioService.adjustAudioDuration(rawChunkPath, adjustedChunkPath, englishDurations[i]);
            langChunks.push(adjustedChunkPath);
            if (fs.existsSync(rawChunkPath)) fs.unlinkSync(rawChunkPath);
          }
          await audioService.mergeAudioFiles(langChunks, masterLangAudioPath);

          console.log(`[VideoJob] Rendering localized video for ${langConfig.name}...`);
          await renderer.renderVideo(langSlides, englishDurations, langScreenVideoPath);
          await ffmpegService.mergeVideoAndAudio(langScreenVideoPath, masterLangAudioPath, langVideoPath);

          let langVideoUrl = `/output/video/${langVideoFileName}`;
          let langVideoObject = `videos/${jobId}/languages/${langConfig.code}.mp4`;

          if (storageService.isStorageConfigured()) {
            const langUpload = await storageService.uploadFile(langVideoPath, langVideoObject);
            if (langUpload) {
              langVideoUrl = langUpload.url;
              langVideoObject = langUpload.objectName;
            }
          }

          videos[lang] = {
            url: langVideoUrl,
            objectName: langVideoObject,
            language: langConfig.name,
            code: langConfig.code,
            slides: langSlides
          };
        } catch (err) {
          console.error(`[VideoJob] Failed to generate localized video for ${lang}:`, err.message);
          jobResultStatus = 'partial';
          failedLanguages.push({ code: lang, error: err.message });
        }
      }
    }

    // --- STAGE 8: Save Metadata JSON & Update Job Record ---
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

    console.log(`[VideoJob] Video generation job ${jobId} completed successfully!`);
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
