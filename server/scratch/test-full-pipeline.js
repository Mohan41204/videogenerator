const teachingEngine = require('../services/teachingEngine.service');
const translationService = require('../services/translation.service');
const imageGenService = require('../services/imageGeneration.service');
const audioService = require('../services/audio.service');
const ffmpegService = require('../services/ffmpeg.service');
const puppeteerService = require('../services/puppeteer.service');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function runFullPipelineTest() {
  console.log('===============================================================');
  console.log('STARTING FULL END-TO-END VIDEO PIPELINE TEST');
  console.log('===============================================================\n');

  const topic = 'Python';
  const subTopic = 'Variables';
  const durationMinutes = 2;
  const targetLanguage = 'English';

  console.log(`Step 1: Generating script with gemini-3.7-flash for "${topic} - ${subTopic}"...`);
  const scriptResult = await teachingEngine.generateTeachingScript({
    topic,
    subTopic,
    durationMinutes
  });
  console.log('✓ Script generated. Scene count:', scriptResult.slideCount);

  let slides = JSON.parse(scriptResult.text);

  console.log(`\nStep 2: Testing Translation service for target language "${targetLanguage}"...`);
  slides = await translationService.translateSlides(slides, targetLanguage);
  console.log('✓ Translation completed.');

  console.log('\nStep 3: Generating Puppeteer slide snapshots & images...');
  const renderDir = path.join(__dirname, '../output/pipeline_test_' + Date.now());
  fs.mkdirSync(renderDir, { recursive: true });

  for (let i = 0; i < slides.length; i++) {
    const slide = slides[i];
    if (slide.realWorldVisual && slide.realWorldVisual.enabled && slide.realWorldVisual.imagePrompt) {
      const imgPath = path.join(renderDir, `realworld_${i}.jpg`);
      console.log(`  Generating image for Scene ${i + 1}...`);
      await imageGenService.generateScenarioImage(slide.realWorldVisual.imagePrompt, imgPath);
    }
  }

  const slideImages = await puppeteerService.renderSlidesToImages(slides, renderDir);
  console.log('✓ Rendered slide images:', slideImages.length);

  console.log('\nStep 4: Generating TTS audio clips for narration...');
  const audioFiles = [];
  for (let i = 0; i < slides.length; i++) {
    const audioPath = path.join(renderDir, `audio_${i}.mp3`);
    console.log(`  Generating audio for Scene ${i + 1}...`);
    await audioService.generateSingleAudio(slides[i].narration, audioPath, 'en');
    audioFiles.push(audioPath);
  }
  console.log('✓ TTS audio clips generated:', audioFiles.length);

  console.log('\nStep 5: Stitching video slides and audio with FFmpeg...');
  const finalVideoPath = path.join(renderDir, 'final_lesson.mp4');
  await ffmpegService.stitchSlidesAndAudio(slideImages, audioFiles, finalVideoPath);

  console.log('✓ FFmpeg stitching complete.');
  if (fs.existsSync(finalVideoPath) && fs.statSync(finalVideoPath).size > 10000) {
    console.log(`\n===============================================================`);
    console.log(`SUCCESS! Full video produced at: ${finalVideoPath}`);
    console.log(`File size: ${(fs.statSync(finalVideoPath).size / 1024 / 1024).toFixed(2)} MB`);
    console.log(`===============================================================`);
  } else {
    throw new Error('Final MP4 file was not generated or is corrupted.');
  }
}

runFullPipelineTest().catch(err => {
  console.error('Full pipeline test failed:', err);
  process.exit(1);
});
