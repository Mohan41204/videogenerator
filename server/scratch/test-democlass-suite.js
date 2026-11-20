const assert = require('assert');
const teachingEngine = require('../services/teachingEngine.service');

console.log('====================================================');
console.log('RUNNING DEMO CLASS TEST SUITE');
console.log('====================================================');

// Test 1: createBatchSyllabus with Demo Class
console.log('\n--- Test 1: createBatchSyllabus Syllabus Generation for Data Analyst Demo Class ---');
const syllabus5m = teachingEngine.createBatchSyllabus('Data Analyst demo class', [], 6, 140, 'PROGRAMMING', true);
assert.strictEqual(syllabus5m.length, 6, 'Should generate exactly 6 scenes for 5m demo class');

// Scene 1 assertions
console.log('Checking Scene 1 (Instructor Intro)...');
assert.strictEqual(syllabus5m[0].heading, 'Data Analyst', 'Heading should be cleaned of "demo class"');
assert.strictEqual(syllabus5m[0].subheading, 'Welcome & Instructor Introduction');
assert.strictEqual(syllabus5m[0].teachingStage, 'introduction');
assert(syllabus5m[0].guidance.includes('Instructor Mohan'), 'Scene 1 guidance must mention Instructor Mohan');
assert(syllabus5m[0].guidance.includes('Skyvers Technology'), 'Scene 1 guidance must mention Skyvers Technology');

// Scene 2 assertions
console.log('Checking Scene 2 (Curriculum Roadmap)...');
assert.strictEqual(syllabus5m[1].heading, 'Data Analyst');
assert.strictEqual(syllabus5m[1].subheading, 'Domain Overview & Core Curriculum Roadmap');
assert(syllabus5m[1].guidance.includes('major pillars'), 'Scene 2 guidance must present curriculum roadmap');

// Scene 3 assertions
console.log('Checking Scene 3 (Programming Concept Deep-Dive)...');
assert.strictEqual(syllabus5m[2].teachingStage, 'concept_explanation');
assert(syllabus5m[2].guidance.includes('Indian cinema'), 'Scene 3 guidance must mandate Indian cinema analogy in audio');

// Scene 4 assertions
console.log('Checking Scene 4 (Hands-On VS Code Code)...');
assert.strictEqual(syllabus5m[3].sceneType, 'code');
assert.strictEqual(syllabus5m[3].teachingStage, 'example');
assert(syllabus5m[3].guidance.includes('VS Code'), 'Scene 4 guidance must mandate VS Code execution');

// Scene 5 assertions
console.log('Checking Scene 5 (Real-World System Case Study)...');
assert.strictEqual(syllabus5m[4].teachingStage, 'real_world_application');
assert(syllabus5m[4].guidance.includes('realWorldVisual.enabled = true'), 'Scene 5 must enable realWorldVisual');

// Scene 6 assertions
console.log('Checking Scene 6 (Conclusion)...');
assert.strictEqual(syllabus5m[5].teachingStage, 'recap');
assert(/instructor\s*mohan/i.test(syllabus5m[5].guidance), 'Scene 6 guidance must conclude with Mohan');
console.log('✓ Test 1 Passed: 6-scene syllabus perfectly structured!');

// Test 2: postProcessSlides Guarantees Mohan Intro & VS Code Code
console.log('\n--- Test 2: postProcessSlides Guardrails for Demo Class ---');
const rawDummySlides = [
  { heading: 'Raw Topic', subheading: 'Some intro', bullets: ['A', 'B'], narration: 'Generic intro' },
  { heading: 'Raw Topic', subheading: 'Roadmap', bullets: ['Pillar 1', 'Pillar 2'], narration: 'Roadmap explanation' },
  { heading: 'Raw Topic', subheading: 'Deep Dive', bullets: ['Rules'], narration: 'Concept explanation' },
  { heading: 'Raw Topic', subheading: 'Code', bullets: ['code text'], narration: 'Code explanation' },
  { heading: 'Raw Topic', subheading: 'Real world', bullets: ['Case study'], narration: 'Real world incident', realWorldVisual: { enabled: true } },
  { heading: 'Raw Topic', subheading: 'Recap', bullets: ['Summary'], narration: 'Wrap up' }
];

const processed = teachingEngine.postProcessSlides(
  rawDummySlides,
  { mins: 5, sceneCount: 6 },
  'PROGRAMMING',
  'Data Analyst demo class',
  'demo class',
  true
);

console.log('Checking processed Scene 0...');
assert.strictEqual(processed[0].heading, 'Data Analyst', 'Heading must be cleaned');
assert.strictEqual(processed[0].subheading, 'Welcome & Instructor Introduction');
assert(processed[0].narration.includes('My name is Mohan'), 'Narration must be Mohan intro');
assert(processed[0].narration.includes('Skyvers Technology'), 'Narration must include Skyvers Technology');
assert(processed[0].narration.includes('4 years of professional experience'), 'Narration must include 4 years experience');
assert(processed[0].narration.includes('10 real-world applications'), 'Narration must include 10 real-world applications');
assert.strictEqual(processed[0].bullets.length, 4, 'Must have 4 credentials bullets');
assert(processed[0].bullets[0].includes('Mohan') && processed[0].bullets[0].includes('Skyvers Technology'));
assert.strictEqual(processed[0].isCode, false);
assert.strictEqual(processed[0].isDiagram, false);

console.log('Checking processed Code Scene (VS Code)...');
const codeSlide = processed.find(s => s.isCode);
assert(codeSlide, 'Must have at least one code slide with isCode=true');
assert.strictEqual(codeSlide.isCode, true);
assert(codeSlide.code && codeSlide.code.length > 10, 'Must have generated runnable code snippet');
assert(codeSlide.fileName, 'Must have fileName for VS Code');

console.log('✓ Test 2 Passed: Guardrails guarantee Mohan intro and VS Code code!');

// Test 3: Scaling across durations (15m, 30m, 60m)
console.log('\n--- Test 3: Demo Class Scaling for 15m, 30m, 60m ---');
[15, 30, 60].forEach(mins => {
  const plan = teachingEngine.getDurationPlan(mins, 0);
  const syl = teachingEngine.createBatchSyllabus('Python demo class', [], plan.sceneCount, plan.avgWordsPerScene, 'PROGRAMMING', true);
  assert.strictEqual(syl[0].subheading, 'Welcome & Instructor Introduction');
  assert.strictEqual(syl[1].subheading, 'Domain Overview & Core Curriculum Roadmap');
  assert.strictEqual(syl[syl.length - 1].teachingStage, 'recap');
  const codeScenes = syl.filter(s => s.sceneType === 'code');
  assert(codeScenes.length >= 1, `Duration ${mins}m must include code scene(s)`);
  console.log(`✓ ${mins}m demo class: ${syl.length} scenes, ${codeScenes.length} hands-on code scene(s).`);
});

console.log('\n====================================================');
console.log('ALL DEMO CLASS TESTS PASSED SUCCESSFULLY! (3/3)');
console.log('====================================================');
