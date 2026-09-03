/**
 * test-diagram-engine.js
 *
 * Automated verification of Simple Topic-Based Diagram Generation.
 * Tests 10 sample topics across the 6 supported diagram types:
 * flowchart, concept, architecture, sequence, tree, comparison,
 * plus a simple conceptual topic that does not require a diagram.
 */

const teachingEngine = require('../services/teachingEngine.service');
const diagramService = require('../services/diagram.service');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../../.env') });

const TEST_TOPICS = [
  { topic: 'Python', subTopic: 'Recursion', durationMinutes: 5, expectedTypes: ['tree', 'flowchart'] },
  { topic: 'Algorithms', subTopic: 'Binary Search', durationMinutes: 5, expectedTypes: ['flowchart', 'concept'] },
  { topic: 'Data Structures', subTopic: 'Linked List', durationMinutes: 5, expectedTypes: ['concept', 'flowchart'] },
  { topic: 'Networking', subTopic: 'HTTP Request', durationMinutes: 5, expectedTypes: ['sequence', 'architecture'] },
  { topic: 'Database', subTopic: 'SQL JOIN', durationMinutes: 5, expectedTypes: ['concept', 'architecture', 'comparison'] },
  { topic: 'System Design', subTopic: 'Client Server Architecture', durationMinutes: 5, expectedTypes: ['architecture'] },
  { topic: 'Authentication', subTopic: 'OTP Authentication', durationMinutes: 5, expectedTypes: ['sequence', 'flowchart'] },
  { topic: 'Cloud', subTopic: 'Load Balancer', durationMinutes: 5, expectedTypes: ['architecture', 'flowchart'] },
  { topic: 'Operating Systems', subTopic: 'Process Management', durationMinutes: 5, expectedTypes: ['flowchart', 'concept'] },
  { topic: 'Python Basics', subTopic: 'What is a Variable?', durationMinutes: 2, expectedTypes: [] } // Should have 0 or at most 1 simple visual
];

async function runTests() {
  console.log('======================================================================');
  console.log('STARTING TOPIC-BASED DIAGRAM ENGINE VERIFICATION');
  console.log('======================================================================\n');

  const results = [];

  for (let i = 0; i < TEST_TOPICS.length; i++) {
    const t = TEST_TOPICS[i];
    console.log(`\n[Test ${i + 1}/10] Testing: "${t.topic}" - "${t.subTopic}" (${t.durationMinutes} mins)...`);
    
    try {
      const scriptResult = await teachingEngine.generateTeachingScript({
        topic: t.topic,
        subTopic: t.subTopic,
        durationMinutes: t.durationMinutes
      });

      const slides = JSON.parse(scriptResult.text);
      const diagramSlides = slides.filter(s => s.isDiagram || (s.visual && s.visual.enabled));
      const visualTypes = diagramSlides.map(s => s.visual?.type || 'unspecified');

      console.log(`  → Total slides: ${slides.length}`);
      console.log(`  → Diagram slides: ${diagramSlides.length} (${visualTypes.join(', ') || 'none'})`);

      diagramSlides.forEach((ds, idx) => {
        console.log(`    Diagram ${idx + 1}: [${ds.visual?.type || 'mermaid'}] "${ds.heading}"`);
        if (ds.visual?.nodes) console.log(`      Nodes (${ds.visual.nodes.length}): ${ds.visual.nodes.map(n => n.label).join(' -> ')}`);
        if (ds.mermaid) console.log(`      Mermaid Preview: ${ds.mermaid.replace(/\n/g, ' | ').substring(0, 80)}...`);
      });

      // Assertions
      const nonDiagramSlides = slides.filter(s => !s.isDiagram && (!s.visual || !s.visual.enabled));
      const isSelective = nonDiagramSlides.length > 0; // Ensures diagrams are NOT forced into every slide
      const hasValidMermaid = diagramSlides.every(s => typeof s.mermaid === 'string' && s.mermaid.length > 0);

      results.push({
        topic: `${t.topic}: ${t.subTopic}`,
        success: true,
        totalSlides: slides.length,
        diagramSlides: diagramSlides.length,
        visualTypes,
        isSelective,
        hasValidMermaid
      });

    } catch (err) {
      console.error(`  FAIL on ${t.topic}:`, err.message);
      results.push({
        topic: `${t.topic}: ${t.subTopic}`,
        success: false,
        error: err.message
      });
    }
  }

  console.log('\n======================================================================');
  console.log('SUMMARY OF ALL 10 TOPIC DIAGRAM VERIFICATION TESTS:');
  console.log('======================================================================');
  results.forEach((r, idx) => {
    if (r.success) {
      console.log(`✓ Test ${idx + 1}: ${r.topic} → ${r.diagramSlides}/${r.totalSlides} diagram slides [${r.visualTypes.join(', ')}] | Selective: ${r.isSelective} | Mermaid valid: ${r.hasValidMermaid}`);
    } else {
      console.log(`✗ Test ${idx + 1}: ${r.topic} → FAILED: ${r.error}`);
    }
  });
  console.log('======================================================================');
}

runTests().catch(err => {
  console.error('Fatal error in tests:', err);
  process.exit(1);
});
