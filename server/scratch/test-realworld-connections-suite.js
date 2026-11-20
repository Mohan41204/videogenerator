/**
 * test-realworld-connections-suite.js
 *
 * Comprehensive Test Suite for the Real-World Connection Engine
 * Tests the 8 specified test cases:
 * 1. Cybersecurity — WannaCry incident.
 * 2. Artificial Intelligence — Alan Turing and AlphaGo.
 * 3. Cloud Computing — Netflix and cloud infrastructure.
 * 4. Operating Systems — Linus Torvalds and Linux.
 * 5. Programming — Iron Man's JARVIS as a fictional AI analogy.
 * 6. Database Management — Real transaction consistency examples.
 * 7. Data Science — Predictive analytics applications.
 * 8. Niche topic with no strong connection — Should return hasConnection: false.
 */

const assert = require('assert');
const connectionEngine = require('../services/realWorldConnectionEngine.service');
const teachingEngine = require('../services/teachingEngine.service');

async function runTestSuite() {
  console.log('================================================================');
  console.log('REAL-WORLD CONNECTION ENGINE COMPREHENSIVE VERIFICATION SUITE');
  console.log('================================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function test(name, fn) {
    totalTests++;
    try {
      fn();
      console.log(`[PASS] ${name}`);
      passedTests++;
    } catch (err) {
      console.error(`[FAIL] ${name}: ${err.message}`);
    }
  }

  // ── TEST 1: Cybersecurity — WannaCry Incident ──
  test('Test 1: Cybersecurity -> WannaCry incident (Category A)', () => {
    const conn = connectionEngine.findBestConnection('Cybersecurity', 'Ransomware and Port Security', 'CYBERSECURITY');
    assert(conn, 'Expected a match for Cybersecurity');
    assert.strictEqual(conn.hasConnection, true);
    assert.strictEqual(conn.category, connectionEngine.CATEGORIES.INCIDENT);
    assert(conn.title.includes('WannaCry'), `Expected WannaCry in title, got "${conn.title}"`);
    assert.strictEqual(conn.isFictional, false);
    assert(conn.year === '2017', 'Expected 2017');
    assert(conn.relevanceScore >= 75, `Expected score >= 75, got ${conn.relevanceScore}`);
    assert(conn.sourceVerification.includes('CISA'), 'Expected verified source');
  });

  // ── TEST 2: Artificial Intelligence — Alan Turing & AlphaGo ──
  test('Test 2A: Artificial Intelligence -> Alan Turing (Category B)', () => {
    const conn = connectionEngine.findBestConnection('Artificial Intelligence', 'Turing Machine and Foundations of AI', 'MACHINE_LEARNING');
    assert(conn, 'Expected a match for AI Turing');
    assert.strictEqual(conn.category, connectionEngine.CATEGORIES.PERSONALITY);
    assert(conn.personOrEntity.includes('Alan Turing'));
    assert.strictEqual(conn.isFictional, false);
    assert(conn.relevanceScore >= 80);
  });

  test('Test 2B: Deep Reinforcement Learning -> AlphaGo (Category A)', () => {
    const conn = connectionEngine.findBestConnection('Deep Learning', 'AlphaGo and Reinforcement Learning Search', 'MACHINE_LEARNING');
    assert(conn, 'Expected a match for AlphaGo');
    assert.strictEqual(conn.category, connectionEngine.CATEGORIES.INCIDENT);
    assert(conn.title.includes('AlphaGo'));
    assert.strictEqual(conn.isFictional, false);
  });

  // ── TEST 3: Cloud Computing — Netflix Chaos Engineering ──
  test('Test 3: Cloud Computing -> Netflix Microservices & Chaos Monkey (Category A)', () => {
    const conn = connectionEngine.findBestConnection('Cloud Computing', 'Netflix Microservices and Resilience', 'CLOUD_DEVOPS');
    assert(conn, 'Expected a match for Cloud Netflix');
    assert.strictEqual(conn.category, connectionEngine.CATEGORIES.INCIDENT);
    assert(conn.title.includes('Netflix'));
    assert(conn.technicalConcept.includes('Microservices') || conn.technicalConcept.includes('Fault Tolerance'));
    assert.strictEqual(conn.isFictional, false);
  });

  // ── TEST 4: Operating Systems — Linus Torvalds and Linux ──
  test('Test 4: Operating Systems -> Linus Torvalds and Linux (Category B)', () => {
    const conn = connectionEngine.findBestConnection('Operating Systems', 'Linux Monolithic Kernel', 'OPERATING_SYSTEMS');
    assert(conn, 'Expected a match for Linux/OS');
    assert.strictEqual(conn.category, connectionEngine.CATEGORIES.PERSONALITY);
    assert(conn.title.includes('Linus Torvalds'));
    assert.strictEqual(conn.isFictional, false);
  });

  // ── TEST 5: Programming — JARVIS as Fictional AI Analogy ──
  test('Test 5: Conversational AI -> JARVIS from Iron Man (Category C)', () => {
    const conn = connectionEngine.findBestConnection('Conversational AI', 'JARVIS AI Assistant and Tool Calling', 'PROGRAMMING');
    assert(conn, 'Expected a match for JARVIS');
    assert.strictEqual(conn.category, connectionEngine.CATEGORIES.MOVIE);
    assert(conn.title.includes('JARVIS'));
    assert.strictEqual(conn.isFictional, true, 'Movie reference must have isFictional: true');
    assert(conn.sourceVerification.includes('conceptual pedagogical analogy'));
  });

  // ── TEST 6: Database Management — Real Transaction Consistency ──
  test('Test 6: Database Management -> Transaction Consistency & Double-Spend (Category A)', () => {
    const conn = connectionEngine.findBestConnection('Database Systems', 'ACID Transactions and Concurrency', 'DATABASE');
    assert(conn, 'Expected a match for Database Transactions');
    assert.strictEqual(conn.category, connectionEngine.CATEGORIES.INCIDENT);
    assert(conn.technicalConcept.includes('ACID') || conn.technicalConcept.includes('Locking'));
    assert.strictEqual(conn.isFictional, false);
  });

  // ── TEST 7: Rocket Science / Data Types — Ariane 5 Overflow ──
  test('Test 7: Software Engineering -> Ariane 5 Integer Overflow (Category A)', () => {
    const conn = connectionEngine.findBestConnection('Programming Data Types', 'Ariane 5 Integer Overflow', 'PROGRAMMING');
    assert(conn, 'Expected Ariane 5 match');
    assert.strictEqual(conn.category, connectionEngine.CATEGORIES.INCIDENT);
    assert(conn.title.includes('Ariane 5'));
    assert(conn.year === '1996');
    assert(conn.technicalConcept.includes('Overflow'));
  });

  // ── TEST 8: Topic with No Strong Connection ──
  test('Test 8: Niche Topic without strong connection -> Returns null / hasConnection: false', () => {
    const conn = connectionEngine.findBestConnection('Abstract Category Theory', 'Yoneda Lemma Functors', 'MATHEMATICS');
    // For purely abstract math without verified engineering incidents or pop-culture references, should be null or < 75
    if (conn) {
      assert(conn.relevanceScore < connectionEngine.MIN_RELEVANCE_THRESHOLD, 'Expected score below threshold');
    } else {
      assert.strictEqual(conn, null, 'Expected null when no strong connection exists');
    }
  });

  // ── TEST 9: Post-Processing Slide Enrichment & Deduplication ──
  test('Test 9: postProcessSlides enriches slides and strictly deduplicates across course', () => {
    const mockSlides = [
      {
        heading: 'Cybersecurity',
        subheading: 'Introduction to System Threats',
        narration: 'Welcome to this lesson on system security and defense.',
        teachingStage: 'introduction',
        sceneType: 'hook'
      },
      {
        heading: 'Cybersecurity',
        subheading: 'Network Port Vulnerabilities',
        narration: 'Now let us examine how unpatched open ports create critical system risks.',
        teachingStage: 'real_world_application',
        sceneType: 'concept'
      },
      {
        heading: 'Cybersecurity',
        subheading: 'Another Application Scene',
        narration: 'Continuing our study of security principles.',
        teachingStage: 'real_world_application',
        sceneType: 'concept'
      },
      {
        heading: 'Cybersecurity',
        subheading: 'Mastery Summary',
        narration: 'To summarize what we learned today about cybersecurity.',
        teachingStage: 'recap',
        sceneType: 'summary'
      }
    ];

    const processed = teachingEngine.postProcessSlides(mockSlides, { mins: 5, sceneCount: 4 }, 'CYBERSECURITY', 'Cybersecurity', 'Port Vulnerabilities');
    
    // Scene 2 should be enriched with WannaCry
    assert(processed[1].realWorldConnection, 'Expected realWorldConnection on scene 2');
    assert.strictEqual(processed[1].realWorldConnection.hasConnection, true);
    assert(processed[1].realWorldConnection.title.includes('WannaCry'));
    assert(processed[1].realWorldVisual.enabled, 'Expected realWorldVisual enabled for case study');
    assert(processed[1].realWorldVisual.imagePrompt.includes('WannaCry'), 'Expected imagePrompt configured');

    // Scene 3 should NOT duplicate WannaCry (deduplication check)
    if (processed[2].realWorldConnection && processed[2].realWorldConnection.hasConnection) {
      assert.notStrictEqual(processed[2].realWorldConnection.title, processed[1].realWorldConnection.title, 'Should never duplicate same reference in one lesson');
    }
  });

  // ── TEST 10: Copyright Safety in Image Prompts ──
  test('Test 10: Image prompt generation is copyright-safe and educational', () => {
    const movieConn = {
      title: 'Inception',
      category: connectionEngine.CATEGORIES.MOVIE,
      technicalConcept: 'Recursion and Call Stacks',
      visualLayout: 'Left side dream layers, right side call stack frames'
    };
    const prompt = connectionEngine.buildSafeImagePrompt(movieConn, 'Recursion');
    assert(prompt.includes('no copyrighted characters'), 'Must contain copyright safety disclaimer');
    assert(prompt.includes('16:9'), 'Must enforce 16:9 layout');
    assert(prompt.includes('vector'), 'Must request flat vector illustrations');
    assert(prompt.includes('white background'), 'Must specify white background');
  });

  // ── TEST 11: C Programming / If Statement Connection (Dynamic Variety) ──
  test('Test 11: C Programming / if statement -> Dynamic pool of relevant references', () => {
    const conn = connectionEngine.findBestConnection('c', 'if statement', 'PROGRAMMING');
    assert(conn, 'Expected match for C if-statement');
    assert.strictEqual(conn.hasConnection, true);
    const validMatches = ['Vikram Vedha', 'Anniyan', 'Circuit Breaker', 'DigiYatra', 'Dennis Ritchie'];
    const matchedOne = validMatches.some(m => conn.title.includes(m));
    assert(matchedOne, `Expected one of [${validMatches.join(', ')}], got "${conn.title}"`);
    assert(conn.relevanceScore >= 80);
  });

  // ── TEST 12: Course-Level Safety Net (ensureCourseConnection) ──
  test('Test 12: ensureCourseConnection guarantees reference even if LLM generated all false', () => {
    const mockZeroSlides = [
      { heading: 'c', subheading: 'if statement', teachingStage: 'introduction', narration: 'Intro to C', realWorldConnection: { hasConnection: false } },
      { heading: 'c', subheading: 'if statement', teachingStage: 'concept_explanation', narration: 'Concepts', realWorldConnection: { hasConnection: false } },
      { heading: 'c', subheading: 'if statement', teachingStage: 'example', narration: 'Code example', isCode: true, realWorldConnection: { hasConnection: false } },
      { heading: 'c', subheading: 'Summary', teachingStage: 'recap', narration: 'Wrap up', realWorldConnection: { hasConnection: false } }
    ];

    const plan = teachingEngine.getDurationPlan(5);
    const enriched = teachingEngine.postProcessSlides(mockZeroSlides, plan, 'PROGRAMMING', 'c', 'if statement');
    const active = enriched.filter(s => s.realWorldConnection && s.realWorldConnection.hasConnection);
    assert.strictEqual(active.length, 1, 'Expected exactly 1 slide enriched with verified connection');
    const validMatches = ['Vikram Vedha', 'Anniyan', 'Circuit Breaker', 'DigiYatra', 'Dennis Ritchie'];
    const matchedOne = validMatches.some(m => active[0].realWorldConnection.title.includes(m));
    assert(matchedOne, `Expected one of [${validMatches.join(', ')}], got "${active[0].realWorldConnection.title}"`);
    assert(active[0].realWorldVisual.enabled, 'Expected realWorldVisual enabled');
    assert(active[0].narration.length > 20, 'Narration must be woven with context');
  });

  // ── TEST 13: 6-Scene Course Syllabus includes real_world_application ──
  test('Test 13: 6-scene course syllabus allocates real_world_application stage before recap', () => {
    const syllabus = teachingEngine.createBatchSyllabus('c', ['if statement'], 6, 200, 'PROGRAMMING');
    assert.strictEqual(syllabus.length, 6);
    assert.strictEqual(syllabus[0].teachingStage, 'introduction');
    assert.strictEqual(syllabus[syllabus.length - 1].teachingStage, 'recap');
    const hasRealWorldStage = syllabus.some(s => s.teachingStage === 'real_world_application');
    assert(hasRealWorldStage, 'Expected real_world_application stage in 6-scene syllabus');
  });

  // ── TEST 14: Loop / Iteration -> Tamil movie Maanaadu or 24 ──
  test('Test 14: Loop / while loop -> Maanaadu or 24 time loop analogy (Category C)', () => {
    const conn = connectionEngine.findBestConnection('Python', 'while loop and iteration', 'PROGRAMMING');
    assert(conn, 'Expected match for while loop');
    assert.strictEqual(conn.category, connectionEngine.CATEGORIES.MOVIE);
    assert(conn.title.includes('Maanaadu') || conn.title.includes('24'), `Expected Maanaadu or 24, got ${conn.title}`);
    assert.strictEqual(conn.isFictional, true);
  });

  // ── TEST 15: Functions / Methods -> Jailer or Sivaji ──
  test('Test 15: Functions / Reusability -> Jailer or Sivaji modularity (Category C)', () => {
    const conn = connectionEngine.findBestConnection('JavaScript', 'functions and modular reusability', 'PROGRAMMING');
    assert(conn, 'Expected match for functions');
    assert.strictEqual(conn.category, connectionEngine.CATEGORIES.MOVIE);
    assert(conn.title.includes('Jailer') || conn.title.includes('Sivaji'), `Expected Jailer or Sivaji, got ${conn.title}`);
    assert.strictEqual(conn.isFictional, true);
  });

  // ── TEST 16: Concurrency / Multi-threading -> IRCTC Tatkal Booking ──
  test('Test 16: Concurrency / Multithreading -> IRCTC Tatkal 10:00 AM Concurrency (Category A)', () => {
    const conn = connectionEngine.findBestConnection('Java', 'concurrency multithreading race condition', 'PROGRAMMING');
    assert(conn, 'Expected match for concurrency');
    assert.strictEqual(conn.category, connectionEngine.CATEGORIES.INCIDENT);
    assert(conn.title.includes('IRCTC Tatkal'), `Expected IRCTC Tatkal, got ${conn.title}`);
    assert.strictEqual(conn.isFictional, false);
  });

  // ── TEST 17: Distributed Payments / ACID -> UPI NPCI Architecture ──
  test('Test 17: Distributed Systems / Payments -> UPI NPCI Switch (Category A)', () => {
    const conn = connectionEngine.findBestConnection('System Design', 'UPI distributed payment transactions', 'CLOUD_DEVOPS');
    assert(conn, 'Expected match for UPI payments');
    assert.strictEqual(conn.category, connectionEngine.CATEGORIES.INCIDENT);
    assert(conn.title.includes('UPI'), `Expected UPI, got ${conn.title}`);
    assert.strictEqual(conn.isFictional, false);
  });

  // ── TEST 18: Fault Tolerance / Exception Handling -> ISRO Chandrayaan-3 ──
  test('Test 18: Fault Tolerance / Exception Handling -> ISRO Chandrayaan-3 (Category A)', () => {
    const conn = connectionEngine.findBestConnection('Software Architecture', 'fault tolerance and exception handling', 'PROGRAMMING');
    assert(conn, 'Expected match for fault tolerance');
    assert.strictEqual(conn.category, connectionEngine.CATEGORIES.INCIDENT);
    assert(conn.title.includes('ISRO Chandrayaan-3'), `Expected ISRO Chandrayaan-3, got ${conn.title}`);
    assert.strictEqual(conn.isFictional, false);
  });

  // ── TEST 19: Dynamic Reference Variety across Multiple Invocations ──
  test('Test 19: Dynamic selection provides varied references across multiple calls for same topic', () => {
    const pickedTitles = new Set();
    for (let i = 0; i < 20; i++) {
      const match = connectionEngine.findBestConnection('c', 'if statement', 'PROGRAMMING');
      if (match && match.title) {
        pickedTitles.add(match.title);
      }
    }
    assert(pickedTitles.size >= 2, `Expected at least 2 distinct references across 20 calls, got ${pickedTitles.size}: ${[...pickedTitles].join(' | ')}`);
  });

  // ── TEST 20: Python If Statement — Slide 2 Movie Analogy Guarantee ──
  test('Test 20: Python If Statement -> Slide 2 Movie Analogy (Concept First, Movie Second, Audio Only)', () => {
    const rawSlides = [
      { heading: 'Python', subheading: 'Introduction & Course Roadmap', teachingStage: 'introduction', sceneType: 'hook', narration: 'Welcome to Python.' },
      { heading: 'Python', subheading: 'if ifstatement', teachingStage: 'concept_explanation', sceneType: 'concept', bullets: ['Syntax: if condition:', 'Indentation defines code blocks'], narration: 'The if statement evaluates a boolean expression to True or False.' },
      { heading: 'Python', subheading: 'Visual Execution Flow', teachingStage: 'technical_visual', sceneType: 'diagram', isDiagram: true, mermaid: 'graph TD; A-->B;' },
      { heading: 'Python', subheading: 'Executable Code Example', teachingStage: 'example', sceneType: 'code', isCode: true, code: 'if age >= 18:\n    print("Eligible")' },
      { heading: 'Python', subheading: 'Real-World System Verification', teachingStage: 'real_world_application', sceneType: 'concept', bullets: ['Production architecture'], narration: 'Here is how production systems handle conditions.' },
      { heading: 'Python', subheading: 'Summary & Key Takeaways', teachingStage: 'recap', sceneType: 'summary', narration: 'In summary, if statements govern decisions.' }
    ];

    const processed = connectionEngine.ensureCourseConnection(rawSlides, 'python', 'if ifstatement', 'PROGRAMMING');
    const slide2 = processed[1];

    // Slide 2 must have an Indian movie analogy
    assert(slide2.narration.includes('Vikram Vedha') || slide2.narration.includes('Anniyan'), `Expected Vikram Vedha or Anniyan in Slide 2 narration, got: "${slide2.narration}"`);
    // Concept must be explained FIRST, movie SECOND
    const conceptIdx = slide2.narration.indexOf('boolean expression');
    const movieIdx = slide2.narration.search(/Vikram Vedha|Anniyan/);
    assert(conceptIdx !== -1 && movieIdx !== -1 && conceptIdx < movieIdx, 'Concept explanation must appear BEFORE movie reference in narration');
    // Bullets must remain clean technical syntax (no movie reference on Notepad)
    const hasMovieInBullets = slide2.bullets.some(b => /movie|film|vikram|vedha|anniyan/i.test(b));
    assert.strictEqual(hasMovieInBullets, false, 'Slide 2 bullets must not contain movie storylines (Audio only!)');
    // Slide 2 must not have realWorldVisual enabled
    assert(!slide2.realWorldVisual || slide2.realWorldVisual.enabled === false, 'Slide 2 must not have realWorldVisual enabled');
  });

  // ── TEST 21: Python If Statement — Slide 5 Real-World Incident Guarantee ──
  test('Test 21: Python If Statement -> Slide 5 Real-World Incident (Image First, Incident Second, Audio Only)', () => {
    const rawSlides = [
      { heading: 'Python', subheading: 'Introduction & Course Roadmap', teachingStage: 'introduction', sceneType: 'hook', narration: 'Welcome to Python.' },
      { heading: 'Python', subheading: 'if ifstatement', teachingStage: 'concept_explanation', sceneType: 'concept', bullets: ['Syntax: if condition:'], narration: 'The if statement evaluates a boolean expression.' },
      { heading: 'Python', subheading: 'Visual Execution Flow', teachingStage: 'technical_visual', sceneType: 'diagram', isDiagram: true, mermaid: 'graph TD; A-->B;' },
      { heading: 'Python', subheading: 'Executable Code Example', teachingStage: 'example', sceneType: 'code', isCode: true, code: 'if age >= 18:\n    print("Eligible")' },
      { heading: 'Python', subheading: 'Real-World System Verification', teachingStage: 'real_world_application', sceneType: 'concept', bullets: ['Production architecture'], narration: 'Here is our production system verification architecture.' },
      { heading: 'Python', subheading: 'Summary & Key Takeaways', teachingStage: 'recap', sceneType: 'summary', narration: 'In summary, if statements govern decisions.' }
    ];

    const processed = connectionEngine.ensureCourseConnection(rawSlides, 'python', 'if ifstatement', 'PROGRAMMING');
    const slide5 = processed[4];

    // Slide 5 must have a real-world incident (NOT a movie, NOT Guido van Rossum)
    assert(slide5.realWorldConnection, 'Slide 5 must have realWorldConnection');
    assert.strictEqual(slide5.realWorldConnection.hasConnection, true);
    assert.strictEqual(slide5.realWorldConnection.category, connectionEngine.CATEGORIES.INCIDENT, `Expected INCIDENT category, got: ${slide5.realWorldConnection.category}`);
    assert(slide5.realWorldConnection.title.includes('Circuit Breaker') || slide5.realWorldConnection.title.includes('DigiYatra'), `Expected Circuit Breaker or DigiYatra, got: "${slide5.realWorldConnection.title}"`);
    // Slide 5 must have realWorldVisual enabled
    assert(slide5.realWorldVisual && slide5.realWorldVisual.enabled === true, 'Slide 5 must have realWorldVisual enabled');
    // Spoken narration must explain image FIRST, incident SECOND
    assert(slide5.narration.includes('Looking closely at the architecture diagram on screen'), 'Slide 5 narration must describe the on-screen diagram first');
    assert(slide5.narration.includes(slide5.realWorldConnection.title.split(' ')[0]), 'Slide 5 narration must include the incident title');
    // Bullets must remain clean architectural takeaways (no movie or storytelling prose)
    const hasStoryInBullets = slide5.bullets.some(b => /movie|film|actor|director/i.test(b));
    assert.strictEqual(hasStoryInBullets, false, 'Slide 5 bullets must be clean architectural takeaways (Audio only!)');
  });

  // ── TEST 22: Multi-Module Longer Courses (15m, 30m, 40m, 60m) Structure Guarantee ──
  test('Test 22: Multi-Module Long Course -> Every module receives distinct Movie (Slide 2) & Incident (Slide 5)', () => {
    const multiModuleSlides = [
      { heading: 'Python', subheading: 'Course Roadmap', teachingStage: 'introduction', sceneType: 'hook', narration: 'Welcome to comprehensive Python.' },
      // Module 1: If condition
      { heading: 'Python', subheading: 'if statement logic', teachingStage: 'concept_explanation', sceneType: 'concept', bullets: ['Syntax if'], narration: 'Evaluating boolean expressions.' },
      { heading: 'Python', subheading: 'if statement flow', teachingStage: 'technical_visual', sceneType: 'diagram', isDiagram: true, mermaid: 'graph TD; A-->B;' },
      { heading: 'Python', subheading: 'if statement code', teachingStage: 'example', sceneType: 'code', isCode: true, code: 'if x > 0: pass' },
      { heading: 'Python', subheading: 'if statement application', teachingStage: 'real_world_application', sceneType: 'concept', bullets: ['Architecture'], narration: 'Real world condition checking.' },
      // Module 2: While loop
      { heading: 'Python', subheading: 'while loop iteration', teachingStage: 'concept_explanation', sceneType: 'concept', bullets: ['Syntax while'], narration: 'Repeating execution until false.' },
      { heading: 'Python', subheading: 'while loop flow', teachingStage: 'technical_visual', sceneType: 'diagram', isDiagram: true, mermaid: 'graph TD; C-->D;' },
      { heading: 'Python', subheading: 'while loop code', teachingStage: 'example', sceneType: 'code', isCode: true, code: 'while count < 5: count += 1' },
      { heading: 'Python', subheading: 'while loop application', teachingStage: 'real_world_application', sceneType: 'concept', bullets: ['Telemetry'], narration: 'Continuous polling system.' },
      // Recap
      { heading: 'Python', subheading: 'Mastery Summary', teachingStage: 'recap', sceneType: 'summary', narration: 'Full course summary.' }
    ];

    const processed = connectionEngine.ensureCourseConnection(multiModuleSlides, 'python', 'conditionals and loops', 'PROGRAMMING');

    const mod1Concept = processed[1];
    const mod1App = processed[4];
    const mod2Concept = processed[5];
    const mod2App = processed[8];

    // Module 1 Concept -> Movie reference
    assert(mod1Concept.narration.includes('Vikram Vedha') || mod1Concept.narration.includes('Anniyan'), 'Module 1 concept must have if-else movie analogy');
    // Module 2 Concept -> Movie reference
    assert(mod2Concept.narration.includes('Maanaadu') || mod2Concept.narration.includes('24'), 'Module 2 concept must have loop movie analogy');
    // Module 1 App -> Incident
    assert(mod1App.realWorldVisual && mod1App.realWorldVisual.enabled, 'Module 1 app must have realWorldVisual enabled');
    assert.strictEqual(mod1App.realWorldConnection.category, connectionEngine.CATEGORIES.INCIDENT);
    // Module 2 App -> Incident / Tech
    assert(mod2App.realWorldVisual && mod2App.realWorldVisual.enabled, 'Module 2 app must have realWorldVisual enabled');
  });

  console.log(`\n================================================================`);
  console.log(`TEST SUMMARY: ${passedTests}/${totalTests} TESTS PASSED!`);
  console.log(`================================================================\n`);

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runTestSuite().catch(err => {
  console.error('Test suite failed:', err);
  process.exit(1);
});

