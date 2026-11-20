require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const path = require('path');
const fs = require('fs');
const audioService = require('../services/audio.service');
const translationService = require('../services/translation.service');
const ffmpegService = require('../services/ffmpeg.service');
const rendererFactory = require('../renderer/rendererFactory');

const jobId = 'c2d01232-e194-406d-b808-c65f659c5485';
const outputDir = path.resolve('D:/Project/videogenerator/server/output');
const jobJsonPath = path.join(outputDir, 'jobs', `${jobId}.json`);

const workDir = path.join(outputDir, `temp_ta_${jobId}`);
const audioDir = path.join(outputDir, 'audio');
const videoDir = path.join(outputDir, 'video');
const imagesDir = path.join(outputDir, 'images');

[workDir, audioDir, videoDir].forEach(d => {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
});

async function run() {
  console.log(`[TamilBuild] Starting Tamil build for ${jobId}...`);
  const job = JSON.parse(fs.readFileSync(jobJsonPath, 'utf8'));
  const originalSlides = job.data?.videos?.en?.slides || [];
  const voiceId = job.requestPayload?.voiceId || 'voice_74080a81-5951-4b5f-972b-72b4064d116a';
  const durations = originalSlides.map(s => s.duration || s.estimatedDurationSeconds || 60);

  const translatedCachePath = path.join(outputDir, 'jobs', `${jobId}_translated_ta.json`);
  let langSlides;
  if (fs.existsSync(translatedCachePath)) {
    console.log(`Loading cached translated slides from ${translatedCachePath}...`);
    langSlides = JSON.parse(fs.readFileSync(translatedCachePath, 'utf8'));
  } else {
    console.log(`Found ${originalSlides.length} slides. Translating slides to Tamil...`);
    langSlides = await translationService.translateSlides(originalSlides, 'Tamil');
    fs.writeFileSync(translatedCachePath, JSON.stringify(langSlides, null, 2));
    console.log(`✓ Translated ${langSlides.length} slides and cached to ${translatedCachePath}.`);
  }

  // Link code and images
  for (let i = 0; i < langSlides.length; i++) {
    const slide = langSlides[i];
    if (slide.realWorldVisual && slide.realWorldVisual.enabled) {
      const imgName = `${jobId}_scene_${i}_scenario.jpg`;
      const localImgPath = path.join(imagesDir, imgName);
      if (fs.existsSync(localImgPath)) {
        slide.imagePath = localImgPath;
        slide.imageUrl = `/output/images/${imgName}`;
        console.log(`Linked scenario image for scene ${i + 1}: ${localImgPath}`);
      }
    }
    if (originalSlides[i] && originalSlides[i].isCode) {
      slide.isCode = true;
      slide.code = originalSlides[i].code;
      slide.codeOutput = originalSlides[i].codeOutput;
      slide.bullets = originalSlides[i].bullets;
      slide.fileName = originalSlides[i].fileName;
      slide.runCommand = originalSlides[i].runCommand;
    }
  }

  // Stage 1: Audio synthesis using already-translated slide.narration directly (NO redundant translateText!)
  console.log(`\nSynthesizing Tamil speech for ${langSlides.length} slides...`);
  const masterAudioPath = path.join(audioDir, `${jobId}_tamil.mp3`);
  const langChunks = [];

  for (let i = 0; i < langSlides.length; i++) {
    const slide = langSlides[i];
    const targetDur = durations[i] || 60;
    const cleanNarration = translationService.cleanTextForTTS(slide.narration || ' ');
    const rawChunkPath = path.join(workDir, `chunk_${i}_raw.mp3`);
    const adjustedChunkPath = path.join(workDir, `chunk_${i}_adjusted.mp3`);

    console.log(`TTS Chunk ${i + 1}/${langSlides.length} (${cleanNarration.length} chars, Target: ${targetDur}s)...`);
    await audioService.generateAudio(cleanNarration, rawChunkPath, 'ta', voiceId);
    await audioService.adjustAudioDuration(rawChunkPath, adjustedChunkPath, targetDur);
    langChunks.push(adjustedChunkPath);

    if (fs.existsSync(rawChunkPath)) fs.unlinkSync(rawChunkPath);
  }

  console.log(`Merging ${langChunks.length} audio chunks...`);
  await audioService.mergeAudioFiles(langChunks, masterAudioPath);
  console.log(`✓ Master Tamil audio saved: ${masterAudioPath}`);

  // Stage 2: Video render
  console.log(`\nRendering video with Puppeteer...`);
  const screenVideoPath = path.join(workDir, `${jobId}_screen_ta.mp4`);
  const renderer = rendererFactory.getRenderer('programming');
  await renderer.renderVideo(langSlides, durations, screenVideoPath);
  console.log(`✓ Video frames rendered: ${screenVideoPath}`);

  // Stage 3: Merge with FFmpeg
  console.log(`\nMerging audio and video...`);
  const finalVideoPath = path.join(videoDir, `${jobId}_ta.mp4`);
  await ffmpegService.mergeVideoAndAudio(screenVideoPath, masterAudioPath, finalVideoPath);
  console.log(`✓ Final Tamil video created: ${finalVideoPath}`);

  // Update job record
  job.data.videos.ta = {
    url: `/output/video/${jobId}_ta.mp4`,
    language: 'Tamil',
    code: 'ta',
    slides: langSlides,
    stages: { translation: 'completed', tts: 'completed', rendering: 'completed', upload: 'completed' }
  };
  job.failedLanguages = (job.failedLanguages || []).filter(fl => fl.code !== 'ta');
  fs.writeFileSync(jobJsonPath, JSON.stringify(job, null, 2));

  try {
    fs.rmSync(workDir, { recursive: true, force: true });
  } catch (e) {}

  console.log(`\n🎉 SUCCESS! Tamil video for ${jobId} is ready!`);
}

run().catch(err => {
  console.error('Failed to build Tamil video:', err);
  process.exit(1);
});

