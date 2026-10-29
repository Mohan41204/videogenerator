const path = require('path');
const fs = require('fs');
const puppeteerService = require('../services/puppeteer.service');

async function testVideoRender() {
  console.log('Testing full video rendering pipeline with board slide...');
  const mockSlide = JSON.parse(fs.readFileSync(path.join(__dirname, '../scripts/mock/mock-binary-search.json'), 'utf8'));

  const slides = [mockSlide];
  const durations = [5.0]; // 5 seconds
  const outVideo = path.join(__dirname, '../output/test_board_video.mp4');

  if (fs.existsSync(outVideo)) fs.unlinkSync(outVideo);

  const res = await puppeteerService.renderScreenShareVideo(slides, durations, outVideo);
  console.log('Video render result:', res);
  console.log('File exists:', fs.existsSync(outVideo), 'Size:', fs.statSync(outVideo).size, 'bytes');

  if (!fs.existsSync(outVideo) || fs.statSync(outVideo).size === 0) {
    throw new Error('Video generation failed or empty!');
  }

  console.log('\nFULL PIPELINE VIDEO TEST PASSED!');
}

testVideoRender().catch(err => {
  console.error('Video render test failed:', err);
  process.exit(1);
});
