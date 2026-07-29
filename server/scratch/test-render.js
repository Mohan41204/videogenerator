const path = require('path');
const fs = require('fs');
const { renderScreenShareVideo } = require('../services/puppeteer.service');

// Load environment variables for safety, although renderScreenShareVideo doesn't need them
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const runTestRender = async () => {
  const outputDir = path.join(__dirname, '../output');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const testVideoPath = path.join(outputDir, 'test_notepad_typing.mp4');

  const mockSlides = [
    {
      heading: 'Introduction to React',
      subheading: 'Modern UI library concepts',
      bullets: [
        'React is a JavaScript library that helps developers build modern user interfaces. It makes building interactive UIs painless by using components.',
        'Instead of refreshing the entire page, React updates only the parts that change. This makes applications faster and easier to maintain.',
        'This paragraph should wrap naturally inside the simulated Notepad window. We will type enough text so that it overflows the viewport height, which will trigger our new auto-scrolling LERP engine and verify it works seamlessly.'
      ],
      isCode: false,
      isDiagram: false,
      mermaid: ''
    }
  ];

  const durations = [15.0]; // 15 seconds narration

  console.log('Starting test render of Notepad typing...');
  console.log(`Output path: ${testVideoPath}`);

  try {
    await renderScreenShareVideo(mockSlides, durations, testVideoPath);
    console.log('\nTest render completed successfully!');
    console.log(`Video saved at: ${testVideoPath}`);
  } catch (err) {
    console.error('Error during test render:', err);
  }
};

runTestRender().catch(console.error);
