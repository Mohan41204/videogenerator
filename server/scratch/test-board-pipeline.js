const teachingEngine = require('../services/teachingEngine.service');

async function testPipeline() {
  console.log('Testing board sanitization & mutual exclusivity...');
  const mockPlan = { sceneCount: 1, mins: 1, avgWordsPerScene: 50 };
  const mockSlides = [
    {
      heading: 'JavaScript Loops',
      subheading: 'Loop Structure & Control',
      isCode: false,
      isDiagram: true,
      mermaid: 'graph TD; A-->B;',
      visual: { enabled: true, type: 'flowchart', title: 'Flow', nodes: [{ id: 'A', label: 'Start' }], connections: [] },
      realWorldVisual: { enabled: true, scenario: 'Clock ticking' },
      bullets: ['Initialization', 'Condition', 'Increment'],
      narration: 'Loops allow us to repeat code efficiently.',
      board: {
        heading: 'Loop Execution Flow',
        layout: 'flowchart',
        nodes: [
          { id: '1', label: 'Init' },
          { id: '2', label: 'Condition' },
          { id: '3', label: 'Body' }
        ],
        edges: [
          { from: '1', to: '2' },
          { from: '2', to: '3' }
        ],
        notes: [{ text: 'Exits when false' }]
      }
    }
  ];

  const processed = teachingEngine.postProcessSlides(mockSlides, mockPlan, 'PROGRAMMING', 'JavaScript Loops', 'Loop Structure');
  const slide = processed[0];

  console.log('Processed slide results:');
  console.log('- isDiagram:', slide.isDiagram, '(expected: false)');
  console.log('- visual.enabled:', slide.visual?.enabled, '(expected: false)');
  console.log('- realWorldVisual.enabled:', slide.realWorldVisual?.enabled, '(expected: false)');
  console.log('- has board:', !!slide.board, '(expected: true)');
  console.log('- board nodes:', slide.board?.nodes?.length, '(expected: 3)');
  console.log('- board heading:', slide.board?.heading);

  if (slide.isDiagram !== false || slide.visual?.enabled !== false || slide.realWorldVisual?.enabled !== false) {
    throw new Error('Mutual exclusivity failed!');
  }

  console.log('\nAll pipeline checks PASSED successfully!');
}

testPipeline().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
