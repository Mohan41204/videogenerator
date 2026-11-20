require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const path = require('path');
const fs = require('fs');
const audioService = require('../services/audio.service');
const translationService = require('../services/translation.service');
const ffmpegService = require('../services/ffmpeg.service');
const rendererFactory = require('../renderer/rendererFactory');

const jobId = '3be96015-8a56-464b-8744-911f8c0f7902';
const outputDir = path.resolve('D:/Project/videogenerator/server/output');
const jobJsonPath = path.join(outputDir, 'jobs', `${jobId}.json`);
const translatedJsonPath = fs.existsSync(path.join(outputDir, 'jobs', `${jobId}_translated_ta.json`))
  ? path.join(outputDir, 'jobs', `${jobId}_translated_ta.json`)
  : path.join(outputDir, 'jobs', '3be96015_translated_ta.json');

const workDir = path.join(outputDir, `temp_ta_${jobId}`);
const audioDir = path.join(outputDir, 'audio');
const videoDir = path.join(outputDir, 'video');
const imagesDir = path.join(outputDir, 'images');

[workDir, audioDir, videoDir].forEach(d => {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
});

async function run() {
  console.log(`[TamilPipeline] Starting Tamil video build for Job ID: ${jobId}`);

  if (!fs.existsSync(jobJsonPath)) {
    throw new Error(`Job JSON not found: ${jobJsonPath}`);
  }
  if (!fs.existsSync(translatedJsonPath)) {
    throw new Error(`Translated JSON not found: ${translatedJsonPath}`);
  }

  const job = JSON.parse(fs.readFileSync(jobJsonPath, 'utf8'));
  const langSlides = JSON.parse(fs.readFileSync(translatedJsonPath, 'utf8'));
  const originalSlides = job.data?.videos?.en?.slides || [];

  const durations = originalSlides.map(s => s.duration || s.estimatedDurationSeconds || 60);
  console.log(`[TamilPipeline] Total slides: ${langSlides.length}, Total estimated runtime: ~${Math.round(durations.reduce((a, b) => a + b, 0) / 60)} mins`);

  const voiceId = job.requestPayload?.voiceId || 'voice_74080a81-5951-4b5f-972b-72b4064d116a';
  console.log(`[TamilPipeline] Voice ID: ${voiceId}`);

  // Link scenario images
  for (let i = 0; i < langSlides.length; i++) {
    const slide = langSlides[i];
    if (slide.realWorldVisual && slide.realWorldVisual.enabled) {
      const imgName = `${jobId}_scene_${i}_scenario.jpg`;
      const localImgPath = path.join(imagesDir, imgName);
      if (fs.existsSync(localImgPath)) {
        slide.imagePath = localImgPath;
        slide.imageUrl = `/output/images/${imgName}`;
        console.log(`[TamilPipeline] Linked scenario image for scene ${i + 1}: ${localImgPath}`);
      }
    }
    // Ensure code slides keep code integrity
    if (originalSlides[i] && originalSlides[i].isCode) {
      slide.isCode = true;
      slide.code = originalSlides[i].code;
      slide.codeOutput = originalSlides[i].codeOutput;
      slide.bullets = originalSlides[i].bullets;
      slide.fileName = originalSlides[i].fileName;
      slide.runCommand = originalSlides[i].runCommand;
    }
  }

  // --- STAGE 1: TTS Generation ---
  console.log(`\n[TamilPipeline] Stage 1: Synthesizing Tamil Audio (${langSlides.length} chunks)...`);
  const masterLangAudioPath = path.join(audioDir, `${jobId}_tamil.mp3`);
  const langChunks = [];

  for (let i = 0; i < langSlides.length; i++) {
    const slide = langSlides[i];
    const targetDur = durations[i] || 60;
    const cleanNarration = translationService.cleanTextForTTS(slide.narration || ' ');
    const rawChunkPath = path.join(workDir, `chunk_${i}_raw.mp3`);
    const adjustedChunkPath = path.join(workDir, `chunk_${i}_adjusted.mp3`);

    console.log(`[TamilPipeline] TTS Chunk ${i + 1}/${langSlides.length} (${cleanNarration.length} chars, Target: ${targetDur}s)...`);
    await audioService.generateAudio(cleanNarration, rawChunkPath, 'ta', voiceId);
    await audioService.adjustAudioDuration(rawChunkPath, adjustedChunkPath, targetDur);
    langChunks.push(adjustedChunkPath);

    if (fs.existsSync(rawChunkPath)) fs.unlinkSync(rawChunkPath);
  }

  console.log(`[TamilPipeline] Merging all ${langChunks.length} Tamil audio chunks...`);
  await audioService.mergeAudioFiles(langChunks, masterLangAudioPath);
  console.log(`✓ Master Tamil audio saved to ${masterLangAudioPath}`);

  // --- STAGE 2: Puppeteer Video Rendering ---
  console.log(`\n[TamilPipeline] Stage 2: Rendering Tamil Video with Puppeteer...`);
  const screenVideoPath = path.join(workDir, `${jobId}_screen_ta.mp4`);
  const renderer = rendererFactory.getRenderer('programming');
  await renderer.renderVideo(langSlides, durations, screenVideoPath);
  console.log(`✓ Tamil screen recording completed: ${screenVideoPath}`);

  // --- STAGE 3: FFmpeg Merge ---
  console.log(`\n[TamilPipeline] Stage 3: Merging video and audio...`);
  const finalTamilVideoPath = path.join(videoDir, `${jobId}_ta.mp4`);
  await ffmpegService.mergeVideoAndAudio(screenVideoPath, masterLangAudioPath, finalTamilVideoPath);
  console.log(`✓ Final localized Tamil video created: ${finalTamilVideoPath}`);

  // --- STAGE 4: Update Job Record ---
  console.log(`\n[TamilPipeline] Updating job record...`);
  if (!job.data) job.data = {};
  if (!job.data.videos) job.data.videos = {};

  job.data.videos.ta = {
    url: `/output/video/${jobId}_ta.mp4`,
    language: 'Tamil',
    code: 'ta',
    slides: langSlides,
    stages: { translation: 'completed', tts: 'completed', rendering: 'completed', upload: 'completed' }
  };
  job.failedLanguages = (job.failedLanguages || []).filter(fl => fl.code !== 'ta');
  fs.writeFileSync(jobJsonPath, JSON.stringify(job, null, 2));

  // Clean up temp chunks
  try {
    fs.rmSync(workDir, { recursive: true, force: true });
  } catch (e) {}

  console.log(`\n=======================================================`);
  console.log(`🎉 SUCCESS! Tamil video generated successfully:`);
  console.log(`   ${finalTamilVideoPath}`);
  console.log(`=======================================================`);
}

run().catch(err => {
  console.error('[TamilPipeline] Error during Tamil video generation:', err);
  process.exit(1);
});
