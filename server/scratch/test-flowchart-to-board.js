/**
 * test-flowchart-to-board.js
 *
 * Verifies:
 * 1. mermaidToBoard converts Example A (Python Function Structure) correctly.
 * 2. mermaidToBoard converts Example B (Python Execution Flow) correctly.
 * 3. visualToBoard converts structured visual data correctly.
 * 4. teachingEngine.postProcessSlides adapts diagrams to whiteboard slides when feature flag is active.
 * 5. Feature flag USE_WHITEBOARD_FLOWCHARTS=false preserves legacy diagram output.
 */

const assert = require('assert');
const diagramService = require('../services/diagram.service');
const teachingEngine = require('../services/teachingEngine.service');

async function runTests() {
  console.log('=== TEST SUITE: Flowchart to Animated Whiteboard Adapter ===\n');

  // ── TEST 1: Example A - Python Function Structure ──────────────────────────
  console.log('[Test 1] Testing Example A: Python Function Structure Mermaid parsing...');
  const pythonFunctionMermaid = `
graph LR
  defNode["def"] --> nameNode["function_name"]
  nameNode --> paramsNode(["(parameters)"])
  paramsNode --> bodyNode["body indented"]
  bodyNode --> returnNode["return value"]
`;

  const boardA = diagramService.mermaidToBoard(pythonFunctionMermaid, 'Python Functions');
  assert(boardA, 'boardA should not be null');
  assert.strictEqual(boardA.layout, 'horizontal', 'Example A should detect horizontal layout from graph LR');
  assert.strictEqual(boardA.nodes.length, 5, 'Example A should have 5 nodes');
  assert.strictEqual(boardA.nodes[0].label, 'def', 'First node should be def');
  assert.strictEqual(boardA.nodes[1].label, 'function_name', 'Second node should be function_name');
  assert.strictEqual(boardA.nodes[2].label, '(parameters)', 'Third node should be (parameters)');
  assert.strictEqual(boardA.nodes[3].label, 'body indented', 'Fourth node should be body indented');
  assert.strictEqual(boardA.nodes[4].label, 'return value', 'Fifth node should be return value');
  assert.strictEqual(boardA.edges.length, 4, 'Example A should have 4 edges');
  assert.strictEqual(boardA.showCursor, true, 'Cursor should be enabled by default');
  console.log('  ✓ Example A successfully converted to Board structure with 5 nodes and 4 edges.');

  // ── TEST 2: Example B - Python Execution Flow ──────────────────────────────
  console.log('\n[Test 2] Testing Example B: Python Execution Flow Mermaid parsing...');
  const pythonExecutionMermaid = `
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

  const boardB = diagramService.mermaidToBoard(pythonExecutionMermaid, 'Python Execution Flow');
  assert(boardB, 'boardB should not be null');
  assert(boardB.layout === 'flowchart' || boardB.layout === 'vertical', 'Example B should have vertical or flowchart layout');
  assert.strictEqual(boardB.nodes.length, 10, 'Example B should have 10 sequential execution steps');
  assert.strictEqual(boardB.nodes[0].label, "1. Start Program");
  assert.strictEqual(boardB.nodes[9].label, "10. End Program");
  assert.strictEqual(boardB.edges.length, 9, 'Example B should have 9 connector edges');
  console.log('  ✓ Example B successfully converted to Board structure with 10 steps and 9 edges.');

  // ── TEST 3: visualToBoard conversion ───────────────────────────────────────
  console.log('\n[Test 3] Testing visualToBoard conversion from structured Gemini visual...');
  const sampleVisual = {
    type: 'flowchart',
    title: 'Data Pipeline',
    nodes: [
      { id: 'in', label: 'Raw Input', shape: 'rect' },
      { id: 'check', label: 'Validate Data?', shape: 'diamond' },
      { id: 'store', label: 'Save to DB', shape: 'circle' }
    ],
    connections: [
      { from: 'in', to: 'check' },
      { from: 'check', to: 'store', label: 'Valid' }
    ]
  };

  const boardVisual = diagramService.visualToBoard(sampleVisual, 'Data Pipeline');
  assert(boardVisual, 'boardVisual should not be null');
  assert.strictEqual(boardVisual.nodes.length, 3);
  assert.strictEqual(boardVisual.nodes[1].shape, 'rhombus', 'Diamond shape should map to rhombus');
  assert.strictEqual(boardVisual.nodes[2].shape, 'round', 'Circle shape should map to round');
  assert.strictEqual(boardVisual.edges.length, 2);
  assert.strictEqual(boardVisual.edges[1].label, 'Valid');
  console.log('  ✓ Structured visual successfully mapped to Board with diamond -> rhombus handling.');

  // ── TEST 4: Teaching Engine postProcessSlides with USE_WHITEBOARD_FLOWCHARTS ─
  console.log('\n[Test 4] Testing teachingEngine postProcessSlides automatic conversion...');
  const mockPlan = { sceneCount: 3, mins: 1, avgWordsPerScene: 50 };
  const mockSlides = [
    {
      heading: 'Python Functions',
      subheading: 'Introduction',
      narration: 'Welcome to this lesson on Python functions.'
    },
    {
      heading: 'Python Functions',
      subheading: 'Function Structure',
      mermaid: pythonFunctionMermaid,
      isDiagram: true,
      narration: 'Functions in Python are defined with the def keyword followed by the function name.'
    },
    {
      heading: 'Python Functions',
      subheading: 'Summary',
      narration: 'To wrap up, functions are modular blocks of reusable code.'
    }
  ];

  process.env.USE_WHITEBOARD_FLOWCHARTS = 'true';
  const processedWithBoard = teachingEngine.postProcessSlides(mockSlides, mockPlan, 'PROGRAMMING', 'Python Functions', 'Structure');
  const slideRes = processedWithBoard[1]; // Technical diagram is scene 1
  assert(slideRes.board, 'Slide 1 should have board populated');
  assert.strictEqual(slideRes.isDiagram, false, 'isDiagram should be false when board is active');
  assert.strictEqual(slideRes.mermaid, '', 'mermaid string should be cleared to prevent static SVG rendering');
  assert.strictEqual(slideRes.board.nodes.length, 5, 'Converted board should have 5 nodes');
  console.log('  ✓ postProcessSlides automatically adapted Mermaid flowchart to slide.board.');

  // ── TEST 5: Feature flag fallback ──────────────────────────────────────────
  console.log('\n[Test 5] Testing backward compatibility with USE_WHITEBOARD_FLOWCHARTS=false...');
  process.env.USE_WHITEBOARD_FLOWCHARTS = 'false';
  const mockSlidesLegacy = [
    {
      heading: 'Python Functions',
      subheading: 'Introduction',
      narration: 'Welcome to this lesson on Python functions.'
    },
    {
      heading: 'Python Functions',
      subheading: 'Function Structure',
      mermaid: pythonFunctionMermaid,
      isDiagram: true,
      narration: 'Functions in Python are defined with the def keyword followed by the function name.'
    },
    {
      heading: 'Python Functions',
      subheading: 'Summary',
      narration: 'To wrap up, functions are modular blocks of reusable code.'
    }
  ];

  const processedLegacy = teachingEngine.postProcessSlides(mockSlidesLegacy, mockPlan, 'PROGRAMMING', 'Python Functions', 'Structure');
  const legacyRes = processedLegacy[1];
  assert(!legacyRes.board, 'Slide 1 should not have board when feature flag is disabled');
  assert.strictEqual(legacyRes.isDiagram, true, 'isDiagram should remain true for legacy renderer');
  assert(legacyRes.mermaid.length > 0, 'mermaid code should be preserved for legacy renderer');
  console.log('  ✓ Backward compatibility verified: USE_WHITEBOARD_FLOWCHARTS=false preserves legacy Mermaid output.');

  // Reset feature flag
  process.env.USE_WHITEBOARD_FLOWCHARTS = 'true';

  console.log('\n======================================================');
  console.log('✓ ALL FLOWCHART-TO-WHITEBOARD ADAPTER TESTS PASSED!');
  console.log('======================================================\n');
}

runTests().catch(err => {
  console.error('\n❌ Test failed:', err);
  process.exit(1);
});
