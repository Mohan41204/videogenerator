/**
 * test-realworld-generation.js
 *
 * Verifies that Gemini dynamically plans real-world visual scenarios,
 * selects intuitive analogies, generates structured realWorldVisual and
 * realWorldVisualTiming objects, writes synchronized narration, and
 * coexists with the existing diagram system.
 */

const teachingEngine = require('../services/teachingEngine.service');

async function testTopic(topic, subTopic) {
  console.log(`\n=============================================================`);
  console.log(`TESTING TOPIC: "${topic}" - "${subTopic}"`);
  console.log(`=============================================================`);

  const result = await teachingEngine.generateTeachingScript({
    topic,
    subTopic,
    durationMinutes: 5
  });

  const slides = JSON.parse(result.text);
  console.log(`Generated ${slides.length} scenes.`);

  let realWorldCount = 0;
  let diagramCount = 0;

  slides.forEach((s, idx) => {
    const hasRW = s.realWorldVisual && s.realWorldVisual.enabled;
    const hasDiag = s.isDiagram || (s.visual && s.visual.enabled);

    if (hasRW) realWorldCount++;
    if (hasDiag) diagramCount++;

    console.log(`\n[Scene ${idx + 1}] "${s.heading}"`);
    console.log(`  SceneType: ${s.sceneType} | VisualType: ${s.visualType}`);
    console.log(`  RealWorld Visual: ${hasRW} | Diagram: ${hasDiag} | Code: ${s.isCode}`);

    if (hasRW) {
      console.log(`  → Scenario: "${s.realWorldVisual.scenario}"`);
      console.log(`  → Purpose: "${s.realWorldVisual.purpose}"`);
      console.log(`  → Image Prompt: "${s.realWorldVisual.imagePrompt?.substring(0, 90)}..."`);
      console.log(`  → Timing: appearAtSecond = ${s.realWorldVisualTiming?.appearAtSecond}s (trigger: "${s.realWorldVisualTiming?.triggerPhrase}")`);
      if (s.realWorldVisual.conceptMapping?.length > 0) {
        console.log(`  → Concept Mappings:`, s.realWorldVisual.conceptMapping.map(m => `${m.realWorldElement} ➔ ${m.concept}`).join(' | '));
      }
      console.log(`  → Narration Excerpt: "${s.narration?.substring(0, 120)}..."`);
    }

    if (hasDiag) {
      console.log(`  → Diagram Type: ${s.visual?.type || 'flowchart'}`);
      console.log(`  → Diagram Title: "${s.visual?.title || s.heading}"`);
      console.log(`  → Diagram Timing: appearAtSecond = ${s.visualTiming?.appearAtSecond}s`);
    }
  });

  console.log(`\nSummary for "${topic}":`);
  console.log(`  Real-World Scenarios: ${realWorldCount}`);
  console.log(`  Diagrams: ${diagramCount}`);
  console.log(`  Both Coexisting: ${realWorldCount > 0 && diagramCount > 0}`);

  return { realWorldCount, diagramCount };
}

async function runAll() {
  console.log('--- STARTING REAL-WORLD SCENARIO AI GENERATION VERIFICATION ---');
  
  // Test 1: Programming - Classes & Objects
  const r1 = await testTopic('Python', 'Classes and Objects');

  // Test 2: Networking - HTTP Protocol
  const r2 = await testTopic('Networking', 'HTTP Request and Response');

  console.log('\n=============================================================');
  console.log('ALL GENERATION TESTS COMPLETED');
  console.log(`Test 1 (Python Classes): RealWorld=${r1.realWorldCount}, Diagrams=${r1.diagramCount}`);
  console.log(`Test 2 (Networking HTTP): RealWorld=${r2.realWorldCount}, Diagrams=${r2.diagramCount}`);
  console.log('=============================================================\n');
}

runAll().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
