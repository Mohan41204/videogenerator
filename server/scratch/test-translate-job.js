require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const fs = require('fs');
const translationService = require('../services/translation.service');

async function testTamilTranslation() {
  console.log('Loading job 3be96015 slides...');
  const job = JSON.parse(fs.readFileSync('D:/Project/videogenerator/server/output/jobs/3be96015-8a56-464b-8744-911f8c0f7902.json', 'utf8'));
  const slides = job.data.videos.en.slides;
  console.log(`Found ${slides.length} slides.`);

  console.log('Translating slides to Tamil with sanitizeJsonControlChars fix...');
  const startTime = Date.now();
  const translated = await translationService.translateSlides(slides, 'Tamil');
  console.log(`✓ Translation succeeded in ${((Date.now() - startTime)/1000).toFixed(1)}s!`);
  console.log(`Translated ${translated.length} slides successfully.`);
  console.log('Slide 0 heading:', translated[0].heading);
  console.log('Slide 0 subheading:', translated[0].subheading);
  console.log('Slide 0 bullets:', translated[0].bullets);
  console.log('Slide 0 narration (sample):', translated[0].narration ? translated[0].narration.slice(0, 100) : 'none');

  fs.writeFileSync('D:/Project/videogenerator/server/output/jobs/3be96015_translated_ta.json', JSON.stringify(translated, null, 2));
  console.log('Saved translated slides to D:/Project/videogenerator/server/output/jobs/3be96015_translated_ta.json');
}

testTamilTranslation().catch(err => {
  console.error('Translation failed:', err);
  process.exit(1);
});

