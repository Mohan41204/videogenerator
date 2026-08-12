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
        'React is a JavaScript library that helps developers build modern user interfaces. It makes building interactive UIs painless by using [red]components[/red].',
        'Instead of refreshing the entire page, React updates only the parts that change. This makes [red]applications[/red] faster and easier to maintain.',
        '[callout]OOP models real-world entities into modular, reusable software components. [/callout]',
        'This paragraph should wrap naturally inside the simulated Notepad window. We will type enough text so that it overflows the viewport height, which will trigger our new auto-scrolling LERP engine and verify it works seamlessly.'
      ],
      isCode: false,
      isDiagram: false,
      mermaid: ''
    },
    {
      heading: 'Object-Oriented Programming Structure',
      subheading: 'Diagram with complex programming labels',
      bullets: [],
      isCode: false,
      isDiagram: true,
      mermaid: 'graph TD\n  Class[Class: Dog]\n  Attr[Attributes: name: str, age: int]\n  Meth[Methods: bark(), __init__()]\n  Obj[Objects: Fido, Spot]\n  User[User -> Database]\n  API[POST /api/login]\n  \n  Class --> Attr\n  Class --> Meth\n  Class --> Obj\n  Obj --> User\n  User --> API'
    }
  ];

  const durations = [10.0, 10.0]; // 10 seconds per slide

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
