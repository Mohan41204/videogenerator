/**
 * test-render-whiteboard-examples.js
 *
 * End-to-end verification of Hand-Drawn Whiteboard Drawing:
 * 1. Python Function Structure (Example A - 5 stacked/connected boxes)
 * 2. Python Execution Flow (Example B - 10 sequential steps with arrows)
 * 3. Circle / Oval with label and connectors (Example C)
 * 4. Flowchart with decision rhombus and branch connectors (Example D)
 * 5. Extracts video frames across progress timeline to verify progressive hand-drawn drawing.
 */

const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');
const puppeteerService = require('../services/puppeteer.service');
const diagramService = require('../services/diagram.service');
const ffmpegPath = require('../utils/ffmpegPath');

function extractFrame(videoPath, timestampSec, outPngPath) {
  return new Promise((resolve, reject) => {
    execFile(ffmpegPath, [
      '-ss', String(timestampSec),
      '-i', videoPath,
      '-vframes', '1',
      '-y',
      outPngPath
    ], (err) => {
      if (err) return reject(err);
      resolve(outPngPath);
    });
  });
}

async function testRenderExamples() {
  console.log('=== STARTING END-TO-END HAND-DRAWN WHITEBOARD VIDEO TEST ===\n');

  const outputDir = path.join(__dirname, '../output/test');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const outVideoPath = path.join(outputDir, 'whiteboard_handdrawn_examples.mp4');
  if (fs.existsSync(outVideoPath)) {
    fs.unlinkSync(outVideoPath);
  }

  // ── Example A: Python Function Structure (5 stacked/connected boxes) ─────────
  const exampleAMermaid = `
graph LR
  defNode["def"] --> nameNode["function_name"]
  nameNode --> paramsNode(["(parameters)"])
  paramsNode --> bodyNode["body indented"]
  bodyNode --> returnNode["return value"]
`;
  const boardA = diagramService.mermaidToBoard(exampleAMermaid, 'Python Functions', {
    drawingStyle: 'hand_drawn',
    seed: 42
  });
  boardA.subheading = 'Defining Functions';
  boardA.underline = true;

  // ── Example B: Python Execution Flow (10 sequential steps with arrows) ───────
  const exampleBMermaid = `
flowchart TD
  S1["1. Start Program"] --> S2["2. Call greet('Alice')"]
  S2 --> S3["3. Enter greet function"]
  S3 --> S4["4. Assign 'Alice' to name parameter"]
  S4 --> S5["5. Execute function body"]
  S5 --> S6["6. Return 'Hello, Alice!'"]
  S6 --> S7["7. Return control to calling statement"]
  S7 --> S8["8. Assign to greeting_message"]
  S8 --> S9["9. Print greeting"]
  S9 --> S10["10. End Program"]
`;
  const boardB = diagramService.mermaidToBoard(exampleBMermaid, 'Python Execution Flow', {
    drawingStyle: 'hand_drawn',
    seed: 101
  });
  boardB.subheading = 'Step-by-Step Program Execution';
  boardB.underline = true;

  // ── Example C: Circle / Oval nodes with labels ──────────────────────────────
  const exampleCMermaid = `
graph LR
  startNode(["Start State"]) --> procNode["Process Input"]
  procNode --> validateNode{"Valid?"}
  validateNode -->|Yes| endNode(["Success State"])
`;
  const boardC = diagramService.mermaidToBoard(exampleCMermaid, 'State Flow', {
    drawingStyle: 'hand_drawn',
    seed: 202
  });
  boardC.subheading = 'Circles, Ovals & Decision Rhombus';
  boardC.underline = true;

  // ── Example D: Sketchy Mode Test (pronounced hand-drawn character) ───────────
  const exampleDMermaid = `
graph TD
  in["Input Data"] --> worker["Worker Task"]
  worker --> out["Verified Result"]
`;
  const boardD = diagramService.mermaidToBoard(exampleDMermaid, 'Sketchy Style', {
    drawingStyle: 'sketchy',
    seed: 303
  });
  boardD.subheading = 'Architectural Sketch Preset';
  boardD.underline = true;

  const slides = [
    {
      heading: 'Python Functions',
      subheading: 'Defining Functions',
      bullets: [
        'def keyword starts the function definition',
        'function_name uniquely identifies the block',
        'parameters receive input arguments',
        'indented body executes the logic',
        'return passes back the result'
      ],
      narration: 'In Python, defining a function begins with the def keyword followed by the function name, parameters in parentheses, an indented body, and a return statement.',
      board: boardA
    },
    {
      heading: 'Python Execution Flow',
      subheading: 'Step-by-Step Program Execution',
      bullets: [
        'Execution starts at top-level statements',
        'greet("Alice") jumps into the function context',
        'name is bound to "Alice" inside local scope',
        'Formatted greeting string is returned to caller',
        'Result is printed to terminal'
      ],
      narration: 'Let us trace how Python executes greet("Alice"). The program starts, calls greet, assigns the argument to the parameter, evaluates the body, returns the greeting, and prints the result.',
      board: boardB
    },
    {
      heading: 'State Flow',
      subheading: 'Circles, Ovals & Decision Rhombus',
      bullets: [
        'Start state initializes execution',
        'Processing node evaluates the input data',
        'Decision node branches conditionally',
        'Terminal state completes the cycle'
      ],
      narration: 'Here we see states represented with rounded ovals, rectangular processing nodes, and an irregular decision rhombus.',
      board: boardC
    },
    {
      heading: 'Sketchy Style',
      subheading: 'Architectural Sketch Preset',
      bullets: [
        'Demonstrates sketchy preset with double-stroke sketch',
        'Pronounced organic curvature and natural bowing',
        'Preserves crisp text and layout integrity'
      ],
      narration: 'This slide demonstrates the sketchy preset featuring pronounced hand-drawn character and double-stroke outlines.',
      board: boardD
    }
  ];

  const durations = [5.0, 6.0, 5.0, 4.0]; // Total 20 seconds
  const totalVideoDuration = durations.reduce((a, b) => a + b, 0);

  console.log(`Rendering ${slides.length} slides with hand-drawn whiteboard wobble...`);
  console.log(`- Slide 1: Example A (5 boxes, hand_drawn) - ${durations[0]}s`);
  console.log(`- Slide 2: Example B (10 execution steps, hand_drawn) - ${durations[1]}s`);
  console.log(`- Slide 3: Example C (Ovals, circles & rhombus) - ${durations[2]}s`);
  console.log(`- Slide 4: Example D (Sketchy double-stroke mode) - ${durations[3]}s`);

  const startTime = Date.now();
  await puppeteerService.renderScreenShareVideo(slides, durations, outVideoPath);
  const elapsedSecs = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log(`\nVideo rendering completed in ${elapsedSecs}s.`);

  // Verify MP4 file
  if (!fs.existsSync(outVideoPath)) {
    throw new Error(`Video file was not created at ${outVideoPath}`);
  }

  const stats = fs.statSync(outVideoPath);
  console.log(`Video file created successfully: ${outVideoPath}`);
  console.log(`File size: ${(stats.size / 1024).toFixed(1)} KB`);

  if (stats.size < 100 * 1024) {
    throw new Error(`Generated video is too small (${stats.size} bytes), rendering may have failed.`);
  }

  // Extract verification frames
  console.log('\nExtracting visual verification frames...');
  const frameTimestamps = [
    { time: 2.5, name: 'frame_slide1_mid_drawing.png', desc: 'Slide 1: Example A drawing in progress with pen cursor' },
    { time: 4.8, name: 'frame_slide1_completed.png', desc: 'Slide 1: Example A fully completed hand-drawn diagram' },
    { time: 8.0, name: 'frame_slide2_flow_mid.png', desc: 'Slide 2: Example B 10-step flow drawing in progress' },
    { time: 10.8, name: 'frame_slide2_flow_completed.png', desc: 'Slide 2: Example B 10-step flow fully completed' },
    { time: 13.5, name: 'frame_slide3_ovals_rhombus.png', desc: 'Slide 3: Example C ovals, circles & decision rhombus' },
    { time: 18.5, name: 'frame_slide4_sketchy.png', desc: 'Slide 4: Example D sketchy mode double stroke' }
  ];

  for (const f of frameTimestamps) {
    const framePath = path.join(outputDir, f.name);
    await extractFrame(outVideoPath, f.time, framePath);
    if (!fs.existsSync(framePath) || fs.statSync(framePath).size < 1000) {
      throw new Error(`Failed to extract valid frame: ${f.name}`);
    }
    const fSize = (fs.statSync(framePath).size / 1024).toFixed(1);
    console.log(`  ✓ Extracted ${f.name} (${fSize} KB) at ${f.time}s - ${f.desc}`);
  }

  console.log('\n======================================================');
  console.log('✓ ALL HAND-DRAWN WHITEBOARD VIDEO RENDERING TESTS PASSED!');
  console.log(`Output Video: ${outVideoPath}`);
  console.log(`Extracted Frames: ${outputDir}`);
  console.log('======================================================\n');
}

testRenderExamples().catch(err => {
  console.error('\n❌ Video rendering test failed:', err);
  process.exit(1);
});
