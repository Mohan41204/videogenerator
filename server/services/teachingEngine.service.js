/**
 * teachingEngine.service.js
 *
 * Human-Like Educational Video Teaching Engine
 *
 * Transforms (Topic + Subtopic + Duration) into a carefully structured,
 * pedagogically sound one-way educational video script.
 *
 * Implements:
 * 1. Domain Classification (Programming, Algorithms, Data Structures, Networking, Databases, Architecture, Math, Science)
 * 2. Duration-Driven Depth & Scope Planning (2m, 5m, 10m, 15m+)
 * 3. Human Teaching Methodology:
 *    - Start simple (intuition & real-world analogies before formal definitions)
 *    - Always explain "WHY" (problem solved, need, importance)
 *    - Real-world production applications
 *    - Misconception debunking & failure scenarios (e.g. missing base case -> stack overflow)
 *    - Topic-specific pedagogical sequences
 *    - Strict One-Way Engagement (rhetorical/predictive hooks with immediate answers; NO "pause/comment/wait")
 *    - Visual synchronization (code, Mermaid diagrams, whiteboard callouts)
 *    - Mental model synthesis
 * 4. Full Backward Compatibility with existing renderers, Mermaid, gTTS, and Translation service.
 */

const path = require('path');
const { GoogleGenAI } = require('@google/genai');
const diagramService = require('./diagram.service');

if (!process.env.GOOGLE_CLOUD_PROJECT) {
  require('dotenv').config({ path: path.join(__dirname, '../../../.env') });
  require('dotenv').config({ path: path.join(__dirname, '../../.env') });
  require('dotenv').config();
}

// Spoken speech rate: ~135 words per minute for clear educational pacing
const WORDS_PER_MINUTE = 135;

/**
 * Classifies topic and subtopic into a distinct pedagogical domain.
 */
function classifyDomain(topic, subTopic) {
  const combined = `${topic || ''} ${subTopic || ''}`.toLowerCase();

  if (/algorithm|sort|search|graph\s+traversal|dijkstra|dynamic\s+programming|greedy|backtracking|big\s*o|complexity/i.test(combined)) {
    return 'ALGORITHM';
  }
  if (/data\s*structure|array|linked\s*list|stack|queue|tree|binary\s*tree|bst|heap|trie|hash\s*map|hash\s*table/i.test(combined)) {
    return 'DATA_STRUCTURE';
  }
  if (/network|tcp|udp|ip|dns|http|https|socket|osi|packet|router|gateway|handshake|rest\s*api/i.test(combined)) {
    return 'NETWORKING';
  }
  if (/sql|database|db|nosql|mongodb|postgres|mysql|query|join|table|index|transaction|acid|relational/i.test(combined)) {
    return 'DATABASE';
  }
  if (/architecture|microservice|load\s*balancer|docker|kubernetes|cloud|serverless|system\s*design|caching|kafka|queue/i.test(combined)) {
    return 'SYSTEM_ARCHITECTURE';
  }
  if (/math|calculus|algebra|matrix|probability|statistics|boolean|formula|equation|geometry|vector/i.test(combined)) {
    return 'MATHEMATICS';
  }
  if (/physics|chemistry|biology|science|astronomy|circuit|quantum/i.test(combined)) {
    return 'SCIENCE';
  }
  if (/python|javascript|typescript|java|c\+\+|c#|golang|rust|php|ruby|swift|kotlin|code|function|class|object|variable|loop|recursion|oop|syntax|inheritance|polymorphism|programming/i.test(combined)) {
    return 'PROGRAMMING';
  }

  return 'GENERAL';
}

/**
 * Computes duration-aware scene planning parameters.
 */
function getDurationPlan(durationMinutes) {
  const mins = Math.max(1, parseInt(durationMinutes, 10) || 5);
  const totalTargetWords = mins * WORDS_PER_MINUTE;

  let sceneCount;
  let depthTier;
  let depthDescription;
  let stagePlan = [];

  if (mins <= 2) {
    sceneCount = 4;
    depthTier = 'MICRO_LESSON';
    depthDescription = 'Distilled core lesson: Topic Introduction → Core Concept → Real-World Annotated Visual → Recap.';
    stagePlan = ['introduction', 'concept_explanation', 'real_world_application', 'recap'];
  } else if (mins <= 6) {
    sceneCount = 6;
    depthTier = 'STANDARD_LESSON';
    depthDescription = 'Standard lesson: Introduction → Core Concept Explanation → Technical Diagram / Code → Diagram Explanation → Real-World Annotated Scenario → Final Recap.';
    stagePlan = ['introduction', 'concept_explanation', 'technical_visual', 'diagram_explanation', 'real_world_application', 'recap'];
  } else if (mins <= 20) {
    sceneCount = Math.max(8, Math.min(14, Math.round(mins * 0.8)));
    depthTier = 'COMPREHENSIVE_DEEP_DIVE';
    depthDescription = 'In-depth mastery: Introduction → Core Concept → Technical Visual → Diagram Explanation → Concrete Example → Real-World Application → Concept Mapping → Recap.';
    stagePlan = ['introduction', 'concept_explanation', 'technical_visual', 'diagram_explanation', 'example', 'real_world_application', 'concept_mapping', 'recap'];
  } else {
    sceneCount = Math.max(14, Math.min(25, Math.round(mins * 0.5)));
    depthTier = 'MASTERCLASS_COURSE';
    depthDescription = 'Full Masterclass Course tier: Exhaustive step-by-step topic breakdown, technical visuals, real-world scenarios, and end-to-end synthesis.';
    stagePlan = ['introduction', 'concept_explanation', 'technical_visual', 'diagram_explanation', 'example', 'real_world_application', 'real_world_annotation', 'concept_mapping', 'recap'];
  }

  const avgWordsPerScene = Math.round(totalTargetWords / sceneCount);

  return {
    mins,
    totalTargetWords,
    sceneCount,
    depthTier,
    depthDescription,
    avgWordsPerScene,
    stagePlan
  };
}

/**
 * Domain-specific pedagogical teaching sequence and guidelines.
 */
function getDomainTeachingStrategy(domain) {
  switch (domain) {
    case 'PROGRAMMING':
      return `
DOMAIN: PROGRAMMING CONCEPT
Pedagogical Sequence:
1. Real-world Problem & Intuition (relatable analogy, why this concept exists)
2. Core Principle & Syntax Breakdown (what happens behind the scenes)
3. Basic Working Code Example (clean, 6-10 lines, executable, showing exact output)
4. Step-by-Step Execution & Trace (how data flows line by line, visual trace)
5. Failure Scenario or Common Mistake (e.g., missing base case, off-by-one, null pointer, infinite loop)
6. Real-World Production Use Cases (e.g., file system traversal, parsing, routing, data processing)
7. Best Practices & Final Mental Model Summary
`;

    case 'ALGORITHM':
      return `
DOMAIN: ALGORITHM
Pedagogical Sequence:
1. The Problem: What specific challenge are we trying to solve?
2. Why Naive Approach Fails or Is Inefficient: Establish the motivation.
3. The Core Algorithmic Idea: Intuitive explanation before writing a single line of code.
4. Step-by-Step Algorithm Walkthrough & Diagram: Flowchart or state transition diagram.
5. Concrete Implementation: Clean code snippet demonstrating the algorithm.
6. Execution Trace: Step-by-step state changes on sample input.
7. Time & Space Complexity: Intuitive explanation of efficiency.
8. Real-World Applications & Summary Mental Model.
`;

    case 'DATA_STRUCTURE':
      return `
DOMAIN: DATA STRUCTURE
Pedagogical Sequence:
1. Real-World Physical Analogy (e.g., Stack = cafeteria plates, Queue = ticketing line, Tree = organizational hierarchy).
2. Internal Structure & Memory Layout (how nodes/elements are connected).
3. Visual Diagram: Clear structural Mermaid diagram of the data structure.
4. Core Operations (Insert, Search, Delete, Traverse) with time complexity comparison.
5. Code Implementation Snippet: Concise working implementation.
6. Comparison with Alternative Data Structures (e.g., Array vs Linked List).
7. Real-World Applications & Summary.
`;

    case 'NETWORKING':
      return `
DOMAIN: COMPUTER NETWORKING
Pedagogical Sequence:
1. Real-World Communication Analogy (e.g., postal mail, phone call, restaurant ordering).
2. The Actors & Components (Client, Server, Router, Socket, Protocol).
3. Visual Sequence Diagram: Mermaid sequence diagram showing packet/message flow.
4. Step-by-Step Packet Flow (headers, payloads, state transitions).
5. What Happens When Things Go Wrong? (Packet loss, timeouts, retries, handshake failure).
6. Real-World Services (Netflix streaming, WhatsApp messaging, web browsing).
7. Protocol Comparison & Summary Mental Model.
`;

    case 'DATABASE':
      return `
DOMAIN: DATABASE & DATA STORAGE
Pedagogical Sequence:
1. The Data Problem: Why plain files or disorganized storage fail at scale.
2. Conceptual Structure: Tables, records, keys, relationships.
3. Visual Relationship Diagram: Clean Mermaid diagram showing table relationships or query flow.
4. Concrete SQL / Query Example: Clean query demonstrating the concept with sample tabular output.
5. Execution Mechanics: How the database engine evaluates the operation.
6. Common Mistake or Performance Trap (e.g., missing index, Cartesian product, null values in joins).
7. Real-World Industry Application (Banking transactions, E-commerce inventory, Social feeds) & Summary.
`;

    case 'SYSTEM_ARCHITECTURE':
      return `
DOMAIN: SYSTEM ARCHITECTURE & CLOUD
Pedagogical Sequence:
1. The Scale or Reliability Problem: Single server bottleneck or failure point.
2. Architectural Solution: The new component and its core responsibility.
3. System Architecture Diagram: Mermaid diagram showing request flow between components.
4. Step-by-Step Traffic Flow: How a user request travels through the system.
5. Failure Scenarios & Fault Tolerance: What happens when a node or service goes down?
6. Trade-offs: Latency vs consistency, cost vs reliability.
7. Real-World Systems (e.g., Uber, Amazon, YouTube) & Summary Mental Model.
`;

    case 'MATHEMATICS':
      return `
DOMAIN: MATHEMATICS & THEORETICAL COMPUTER SCIENCE
Pedagogical Sequence:
1. Intuitive Question or Visual Observation.
2. The Core Concept Explained in Plain English without symbols.
3. Visual Representation or Diagram illustrating the concept.
4. The Formula or Definition: Dissecting what every single symbol means.
5. Step-by-Step Walkthrough of a concrete calculation.
6. Where this is applied in computer science, software, or nature.
7. Summary & Intuitive Mental Rule.
`;

    default:
      return `
DOMAIN: EDUCATIONAL CONCEPT
Pedagogical Sequence:
1. Hook & Curiosity: Real-world scenario or thought experiment.
2. Intuition First: Explain what it is and why it exists in simple terms.
3. Real-World Analogy: Relatable physical parallel.
4. Visual Explanation / Diagram: Structural or process diagram.
5. Practical Example & Walkthrough: Step-by-step application.
6. Common Misconceptions & Edge Cases.
7. Real-World Impact & Summary Mental Model.
`;
  }
}

/**
 * Builds the comprehensive pedagogical system prompt.
 */
function buildPedagogicalPrompt(topic, subTopic, plan, domain) {
  const domainStrategy = getDomainTeachingStrategy(domain);

  return `
You are an expert, compassionate human teacher who excels at creating captivating recorded educational video lessons.
You do not speak like an encyclopedia or a chatbot; you speak like a gifted mentor who makes complex ideas feel natural, intuitive, and exciting.

Your mission is to create a complete, scene-by-scene educational script for a pre-recorded educational video.

TOPIC: "${topic}"
SUBTOPIC: "${subTopic || 'Core Principles & Practical Application'}"
TARGET DURATION: ${plan.mins} MINUTES (~${plan.totalTargetWords} words total narration, exactly ${plan.sceneCount} scenes).
LESSON TIER: ${plan.depthTier} (${plan.depthDescription})
CLASSIFIED DOMAIN: ${domain}

================================================================================
AUTHORITATIVE LESSON IDENTITY (HEADING & SUBHEADING RULES)
================================================================================
USER_TOPIC = "${topic}"
USER_SUBTOPIC = "${subTopic || topic}"

USER_TOPIC and USER_SUBTOPIC are authoritative lesson metadata.
Never replace them with creative titles, metaphorical names, or clickbait phrases!

1. HEADING MUST BE DERIVED DIRECTLY FROM USER_TOPIC:
   - For Scene 1, "heading" MUST be exactly "${topic}".
   - For subsequent scenes (Scene 2..N), "heading" MUST remain "${topic}" (or clearly anchored to the topic, e.g. "${topic}").
   - Do NOT creatively rename, summarize, rephrase, or convert the topic into an analogy (e.g. do NOT rename "Networks" into "The Global Postal System of Data" or "Python" into "The Magic Blueprint").

2. SUBHEADING MUST BE DERIVED DIRECTLY FROM USER_SUBTOPIC:
   - For Scene 1, "subheading" MUST be exactly "${subTopic || topic}".
   - For subsequent scenes, "subheading" MUST describe the specific academic/technical concept being covered (e.g. "How Devices Communicate", "Request & Response Flow", "Understanding Network Protocols", "Common Pitfalls", "Summary & Mental Model").
   - Do NOT use metaphorical phrases or analogies as subheadings (e.g. do NOT use "The Digital Restaurant" or "The Power of Blueprints").

3. SEPARATE TEACHING HOOK FROM LESSON TITLE:
   - Lesson Title = User's Topic and Subtopic (accurate, professional, preserved).
   - Teaching Hook = Creative Narration!
   - You CAN and SHOULD be highly creative in the spoken NARRATION, analogies, rhetorical questions, and real-world examples.
   - Example:
     "heading": "${topic}",
     "subheading": "${subTopic || topic}",
     "narration": "Imagine sending a message to someone on the other side of the world..."
   The creative analogy belongs inside the narration and real-world visual, NEVER as the primary lesson heading.

${domainStrategy}

================================================================================
CRITICAL RULE 1: STRICTLY PRE-RECORDED ONE-WAY VIDEO (NO LIVE INTERACTION)
================================================================================
The video is a pre-recorded, non-interactive one-way educational video.
There is NO live student, NO chat, NO button clicking, NO pause button dependency.
- NEVER say: "Pause the video", "Try this on your own and resume", "Type your answer in the comments", "Raise your hand", "Click the link", "I will wait for you", "Let me know in the chat".
- DO use rhetorical questions and prediction hooks that YOU IMMEDIATELY ANSWER:
  * GOOD: "What happens when factorial(5) calls factorial(4)? Let's follow the call stack step by step."
  * GOOD: "You might wonder why we need a base case. Notice what happens if we remove it: the function calls itself indefinitely until Python raises a RecursionError."
  * BAD: "What happens when factorial(5) calls factorial(4)? Pause the video and calculate it."
The video must flow seamlessly and continuously without requiring student action.

================================================================================
CRITICAL RULE 2: HUMAN TEACHING METHODOLOGY
================================================================================
1. START WITH INTUITION BEFORE FORMAL DEFINITIONS:
   - Never begin a lesson with a sterile textbook definition.
   - Begin with an intuitive hook or physical analogy.
   - Example (Recursion): Instead of "Recursion is a technique where a function invokes itself", use: "Imagine opening a folder that contains another folder, which contains another folder. You keep opening folders until you reach one with plain files. That is the exact intuition behind recursion."
2. ALWAYS EXPLAIN "WHY":
   - What problem does this solve?
   - Why couldn't we just use a simple loop or a basic approach?
   - What makes this concept powerful?
3. REAL-WORLD ANALOGIES (when genuinely helpful):
   - Recursion → Russian nesting dolls / nested folders
   - API → Restaurant waiter taking your order to the kitchen
   - Cache → Items kept on your desk versus walking to a warehouse
   - Queue → People waiting in line at a cinema
   - Database Index → Book index at the back of a textbook
   - Router → Traffic controller at a busy intersection
4. REAL-WORLD PRODUCTION APPLICATIONS:
   - Explain where real tech companies use this (e.g., Recursion in file managers, DOM tree traversal, JSON serialization, graphics rendering).
5. MISCONCEPTION DEBUNKING & FAILURE SCENARIOS:
   - Dedicate a scene or clear moment to a common student misconception (e.g. "Recursion is NOT just a while loop with extra steps; it builds a call stack in memory").
   - Demonstrate the failure scenario (e.g. what happens when there is no base case → Stack Overflow).
6. FINAL MENTAL MODEL:
   - Conclude with a clear, memorable mental model or 3-step rule that the student will remember for years.

================================================================================
CRITICAL RULE 3: VISUAL PLANNING & TIMED WHITEBOARD DIAGRAMS
================================================================================
A visual must be introduced at the point in the narration where it becomes educationally useful.
DO NOT make diagrams visible from the beginning of a scene!

The lesson must follow a natural teacher-like sequence:
  1. Video/Scene begins.
  2. Teacher introduces the concept and explains why it matters (5 to 12 seconds of speech).
  3. Teacher naturally introduces the visual (e.g. "Let's see how this works visually...", "Notice how these components connect...").
  4. The diagram appears at that exact moment.
  5. Teacher explains the diagram step-by-step.
  6. The diagram REMAINS visible after it appears for the rest of the scene while the teacher explains it.

For EACH scene, perform a visual planning analysis and ask:
"Would a simple visual representation make this concept significantly easier to understand?"

1. IF YES (Visual provides clear educational value):
   - Select EXACTLY ONE of the 6 supported diagram types:
     * "flowchart": Use for algorithms, workflows, decision branches, processes, recursion logic.
     * "concept": Use for relationships between concepts, classifications, component breakdowns.
     * "architecture": Use for system architectures, cloud setups, client/server, APIs, databases.
     * "sequence": Use when multiple components communicate in a specific ordered sequence.
     * "tree": Use for hierarchies, call stacks, DOM trees, directory structures, binary trees.
     * "comparison": Use when comparing two concepts side-by-side (e.g., Iteration vs Recursion).
   - Generate a structured "visual" object:
     {
       "enabled": true,
       "type": "flowchart" | "concept" | "architecture" | "sequence" | "tree" | "comparison",
       "title": "Short descriptive diagram title",
       "nodes": [
         { "id": "1", "label": "Short label (under 25 chars)" },
         { "id": "2", "label": "Next node" }
       ],
       "connections": [
         { "from": "1", "to": "2", "label": "calls/sends (optional)" }
       ]
     }
   - Generate a structured "visualTiming" object:
     {
       "enabled": true,
       "appearAtSecond": 10,
       "triggerPhrase": "Let's look at this process visually."
     }
     * "triggerPhrase": The phrase or sentence in your narration where the diagram should appear.
     * "appearAtSecond": The estimated second in the narration where that phrase is spoken (typically ~25% to 45% into the scene's duration, giving 5 to 12 seconds of spoken introduction first).
     * DO NOT use a fixed timestamp like 5 for every scene; calculate it based on when your narration reaches the visual explanation.
   - Set "isDiagram": true, "isCode": false, and "bullets": [].
   - Provide the corresponding valid raw Mermaid code in "mermaid".
   - Diagram rules:
     * Maximum 5 to 8 major elements per diagram for instant legibility.
     * Short, concise labels. No paragraphs.
     * Clear arrows and relationships. Zero visual clutter.
     * The visual MUST directly match what the teacher is explaining in the narration at that exact moment.

2. IF NO (Visual is not needed):
   - A diagram is NOT needed for simple definitions, introductory hooks, syntax walk-throughs, or pure code walk-throughs.
   - Set "isDiagram": false, "mermaid": "", "visual": { "enabled": false }, and "visualTiming": { "enabled": false, "appearAtSecond": 0, "triggerPhrase": "" }.
   - Do NOT create decorative diagrams just to have a visual.
   - For a 5-minute video, generate approximately 2 to 4 meaningful diagrams where they genuinely help understanding.

3. CODE SLIDES:
   - When isCode is true:
     * Keep code short, concise, and focused (6 to 10 lines max).
     * The 'bullets' array MUST contain exactly ONE string with the code AND output separated by '\\N\\N==== OUTPUT ====\\N'.
     * Use literal '\\N' for newlines so whitespace and indentation are perfectly preserved on screen.
     * Provide valid 'fileName' (e.g., 'main.py', 'index.js', 'Main.java') and 'runCommand' (e.g., 'python main.py', 'node index.js').
     * Set 'isDiagram': false, 'mermaid': '', and 'visual': { 'enabled': false }.

4. WHITEBOARD TEXT SLIDES:
   - When isCode is false and isDiagram is false:
     * Provide 2 to 4 clear, well-structured bullet strings.
     * You may use callouts like '> [!NOTE] key insight', tables '| Col 1 | Col 2 |', or clean bullet points.

================================================================================
CRITICAL RULE 4: NATURAL TEACHER NARRATION FOR TTS
================================================================================
- Write narration as spoken dialogue.
- Use warm, conversational teacher phrases:
  * "Let's take a look at what happens here."
  * "Notice how each step gets us closer to the solution."
  * "Here is the key insight to remember."
  * "At first, this might seem a little unusual, but..."
  * "Let's see this in action."
- Avoid robotic phrases like "In this slide I will discuss...", "According to the definition...", "The bullet points show...".
- Target approximately ${plan.avgWordsPerScene} words per scene narration so spoken duration naturally hits ${plan.mins} minutes.

================================================================================
CRITICAL RULE 5: TOPIC-INDEPENDENT REAL-WORLD VISUAL SCENARIOS (AI VISUAL REASONING ENGINE)
================================================================================
You must decide dynamically whether a real-world visual scenario would make a concept immediately intuitive for ANY topic or subtopic (e.g. Programming, Networks, Databases, Operating Systems, Math, Physics, Chemistry, Biology, Economics, Architecture, etc.).
NEVER hardcode scenarios or use predefined domain shortcuts. Instead, solve the TEACHING PROBLEM first.

1. AI VISUAL REASONING STEP (Execute before generating each scene):
   Ask yourself:
   - What is being taught in this scene?
   - What is the core concept or key difficulty?
   - Is this concept difficult to visualize or abstract?
   - Would a concrete real-world situation or familiar physical interaction improve understanding?
   - If NO: Set "realWorldVisual": { "enabled": false } and "realWorldVisualTiming": { "enabled": false, "appearAtSecond": 0, "triggerPhrase": "" }.
   - If YES:
     * What is the simplest, most familiar real-world scenario?
     * What specific objects, people, or actions are involved?
     * How do they map directly to the educational concept?
     * Would a student understand the mapping within 3 to 5 seconds of seeing the image?
     * Proceed to generate the structured visual specification.

2. CHOOSE THE BEST VISUAL STRATEGY (Set "visualType" in realWorldVisual):
   Select one of the 5 educational visual strategies:
   - "direct": Direct real-world representation when the concept itself can be shown naturally in a physical setting (e.g. Computer Network shown as an office with interconnected computers, printer, router, and server).
   - "analogy": Real-world analogy when the technical concept is abstract (e.g. API shown as a customer ordering through a waiter who communicates with a kitchen; Cache shown as a desk drawer vs warehouse storage).
   - "process": Real-world process when the concept involves a sequence of steps (e.g. TCP handshake shown as two people greeting and establishing communication before a meeting).
   - "comparison": Real-world comparison when contrasting two approaches (e.g. TCP vs UDP shown as registered signed courier delivery vs fast lightweight delivery).
   - "spatial": Real-world spatial relationship when hierarchy or structure is key (e.g. Database hierarchy shown as an organized multi-drawer filing system).

3. OPTIMIZE FOR STUDENT UNDERSTANDING (NOT ARTISTIC CREATIVITY):
   - Choose simple, familiar scenarios (e.g., people, classroom, office, road, traffic, library, shopping, delivery, queue, factory, machines, vehicles, daily activities, nature, kitchen, workshop, etc.).
   - NEVER generate abstract images (NO abstract glowing lines, geometric neon shapes, futuristic digital spheres, floating network nodes, decorative sci-fi graphics).
   - The image must be concrete, recognizable, and immediately grounding.

4. STRUCTURED VISUAL SPECIFICATION & EDUCATIONAL ANNOTATIONS:
   When enabled, provide:
   {
     "enabled": true,
     "scenario": "Short description of the real-world scene",
     "purpose": "Pedagogical objective (why this image helps student understand)",
     "visualType": "direct" | "analogy" | "process" | "comparison" | "spatial",
     "imagePrompt": "Detailed concept-driven prompt: describe clean physical scene, realistic educational presentation, minimal clutter. CRITICAL: Strictly NO text, NO labels, NO words, NO diagram symbols in the image generation prompt itself.",
     "conceptMapping": [
       { "realWorldElement": "Real element name", "concept": "Technical/academic concept" }
     ],
     "annotations": [
       {
         "type": "arrow" | "callout" | "highlight" | "box" | "circle" | "label",
         "target": "Target element in scene (e.g. 'Customer', 'Waiter', 'Kitchen', 'Car')",
         "label": "Concise real-world label (e.g. 'Waiter', 'Blueprint')",
         "concept": "Academic concept mapped to it (e.g. 'API Intermediary', 'Class Definition')",
         "x": 0.25,
         "y": 0.40,
         "toX": 0.55,
         "toY": 0.40,
         "triggerPhrase": "Phrase in narration where this part is explained",
         "appearAtSecond": 12
       }
     ]
   }
   - Coordinates (x, y, toX, toY) are normalized between 0.05 and 0.95 relative to the image frame (0,0 is top-left, 1,1 is bottom-right).
   - "arrow": Draws a directional arrow from (x, y) to (toX, toY) pointing out a relationship or flow.
   - "callout": Renders an interactive educational card pointing to the element at (x, y).
   - "highlight" / "circle" / "box": Emphasizes the element at (x, y).
   - MANDATORY: Whenever "enabled" is true, you MUST provide at least 2 to 4 annotations (including arrows and callouts) and at least 2 conceptMapping entries.
   - Annotations MUST be synchronized with the spoken narration through "triggerPhrase" and "appearAtSecond"!

5. NARRATION MUST EXPLAIN THE IMAGE (COORDINATED TEACHING UNIT):
   - The image and narration must form an integrated explanation.
   - Teaching sequence:
     1. Introduce the concept and why it matters.
     2. Transition to the real-world scenario (using the triggerPhrase).
     3. Explain what is happening in the real-world scenario.
     4. Explicitly map the real-world elements to the technical concept.
     5. Continue with the technical explanation (never let the analogy replace the actual topic!).

6. VISUAL TIMING:
   - The image must NOT appear from second 0.
   - It must start hidden and appear when the teacher reaches the sentence introducing the real-world scenario.
   - Set "realWorldVisualTiming": {
       "enabled": true,
       "appearAtSecond": <approximate timestamp based on narration position>,
       "triggerPhrase": "<exact sentence or phrase in narration that introduces the analogy/scenario>"
     }

7. SELF-EVALUATION CHECKLIST (Run mentally before emitting):
   - Is the scenario familiar to a general student?
   - Does it directly illuminate the concept?
   - Is it simpler than explaining the concept without it?
   - Is the image free of abstract clutter?
   - If the scenario is confusing, convoluted, or unnecessary, set "enabled": false.
   - In every educational lesson, aim to select 1 to 2 scenes (typically during the early intuition, analogy, or concept scene) to feature an annotated real-world visual scenario with "enabled": true, visualType, imagePrompt, conceptMapping, and annotations! For all other scenes, set "enabled": false.

8. INDEPENDENCE FROM DIAGRAMS:
   - Technical diagrams (Mermaid, architecture, flowcharts) and Real-World Visuals are separate tools.
   - A scene can have: diagram only, real-world visual only, both (coexisting), or neither.

================================================================================
CRITICAL RULE 6: STRUCTURED VISUAL TEACHING ORDER & TEACHING STAGES
================================================================================
Every generated video MUST follow a logical, pedagogically progressive teaching sequence.
Visuals must NEVER be scattered randomly or placed at the beginning of the video.
Follow this deliberate teaching order:

1. TOPIC INTRODUCTION (Scene 1):
   - "teachingStage": "introduction"
   - Introduce what we are learning and hook student curiosity.
   - Strictly NO real-world scenario images and NO technical diagrams in Scene 1!

2. CORE CONCEPT EXPLANATION (Scene 2):
   - "teachingStage": "concept_explanation"
   - Explain how the concept works mechanically or logically. Build foundational understanding.

3. TECHNICAL DIAGRAM / CODE VISUALIZATION (Scene 3):
   - "teachingStage": "technical_visual"
   - Show the formal architecture, flowchart, sequence, or working code snippet.
   - Set "isDiagram": true (with valid Mermaid code) OR "isCode": true.
   - Strictly NO real-world scenario image on this slide.

4. EXPLAIN THE TECHNICAL DIAGRAM / PROCESS (Scene 4):
   - "teachingStage": "diagram_explanation" or "example"
   - Deep dive into how data, requests, or states move through the diagram or code.

5. REAL-WORLD REINFORCEMENT & ANNOTATIONS (Scene 5 / Penultimate Scene):
   - "teachingStage": "real_world_application" or "real_world_annotation"
   - The real-world visual is a REINFORCEMENT stage answering: "Where can I see this concept in the real world?"
   - Place the real-world visual HERE, in the later part of the lesson, AFTER the technical diagram has been explained and BEFORE the final recap.
   - Set "realWorldVisual": { "enabled": true, "scenario": "...", "purpose": "...", "annotations": [...], "conceptMapping": [...] }.
   - The narration introduces the real-world scenario, then explicitly maps it back to the technical concept learned earlier.

6. FINAL RECAP & MENTAL MODEL (Scene ${plan.sceneCount}):
   - "teachingStage": "recap"
   - Consolidate key takeaways and lasting mental model.
   - Strictly NO new real-world images and NO new diagrams in the final recap!

================================================================================
OUTPUT FORMAT: JSON ARRAY OF SCENE OBJECTS
================================================================================
You MUST output ONLY a valid JSON array of exactly ${plan.sceneCount} Scene objects. No markdown wraps outside the JSON.
Each Scene object must have:
- "heading": (String) Must be "${topic}" (authoritative user topic).
- "subheading": (String) For Scene 1: "${subTopic || topic}". For subsequent scenes: clear, technical concept name for that slide.
- "bullets": (Array of Strings) Text bullets to display. (1 string for code slides, empty [] for diagram slides).
- "narration": (String) Spoken teaching dialogue (~${plan.avgWordsPerScene} words). Creative hooks and analogies belong here!
- "isCode": (Boolean) True if this slide displays code.
- "isDiagram": (Boolean) True if this slide displays a diagram.
- "mermaid": (String) Valid Mermaid code if isDiagram is true, else "".
- "visual": (Object - optional) Structured diagram object with "enabled", "type", "title", "nodes", "connections".
- "visualTiming": (Object - optional) Timing configuration: { "enabled": true, "appearAtSecond": 12, "triggerPhrase": "Let's examine this visually." }.
- "realWorldVisual": (Object - optional) Structured real-world object: { "enabled": true, "scenario": "...", "purpose": "...", "visualType": "direct"|"analogy"|"process"|"comparison"|"spatial", "imagePrompt": "...", "conceptMapping": [...], "annotations": [...] }. If not helpful, { "enabled": false }.
- "realWorldVisualTiming": (Object - optional) Timing configuration: { "enabled": true, "appearAtSecond": 10, "triggerPhrase": "Let's look at a real-world example." }.
- "fileName": (String) E.g. "main.py" if isCode is true, else "".
- "runCommand": (String) E.g. "python main.py" if isCode is true, else "".
- "sceneType": (String) One of: "hook", "intuition", "concept", "analogy", "example", "code", "code_execution", "diagram", "process", "comparison", "real_world", "misconception", "failure_scenario", "summary".
- "teachingStage": (String) One of: "introduction", "concept_explanation", "technical_visual", "diagram_explanation", "example", "real_world_application", "real_world_annotation", "concept_mapping", "recap".
- "teachingPurpose": (String) Pedagogical objective for this scene.
- "visualType": (String) Visual format ("flowchart_diagram", "architecture_diagram", "sequence_diagram", "tree_diagram", "comparison_diagram", "real_world_scenario", "code_editor", "callout_card", "bullet_list").
- "estimatedDurationSeconds": (Number) Estimated duration in seconds (approx ${Math.round(plan.mins * 60 / plan.sceneCount)}).
- "realWorldApplication": (String - optional) Specific production system or use case referenced, or "".
- "misconception": (String - optional) Pitfall or misconception addressed in this scene, or "".
`.trim();
}

/**
 * Strips any accidental interactive prompts from narration to guarantee
 * seamless one-way video playback.
 */
function sanitizeNarration(narration) {
  if (!narration) return '';

  let text = narration;

  // Replace phrases asking students to pause or type
  text = text.replace(/pause\s+the\s+video\s*(and\s+try|and\s+think|and\s+answer|and\s+write)?/gi, 'let\'s take a close look');
  text = text.replace(/feel\s+free\s+to\s+pause/gi, 'as we examine this');
  text = text.replace(/pause\s+here/gi, 'observe closely here');
  text = text.replace(/type\s+(your\s+)?(answer|thoughts)\s+in\s+the\s+(comments|chat)/gi, 'you might be wondering how this works');
  text = text.replace(/leave\s+a\s+comment\s+below/gi, 'this is a crucial concept');
  text = text.replace(/raise\s+your\s+hand/gi, 'many developers encounter this');
  text = text.replace(/click\s+the\s+(button|link)/gi, 'let\'s continue to the next part');
  text = text.replace(/i('ll| will)\s+wait\s+(for\s+you)?/gi, 'let\'s trace the exact steps');
  text = text.replace(/let\s+me\s+know\s+what\s+you\s+think/gi, 'let\'s see the result');

  return text.trim();
}

/**
 * Cleans and extracts JSON array or object from model text response.
 */
function extractJson(str) {
  if (!str) return '';

  // Try array first
  const arrayMatch = str.match(/\[\s*\{[\s\S]*\}\s*\]/);
  if (arrayMatch) {
    str = arrayMatch[0];
  } else {
    // Try single object
    const objectMatch = str.match(/\{[\s\S]*\}/);
    if (objectMatch) {
      str = objectMatch[0];
    }
  }

  // Strip markdown fences
  str = str.replace(/^```json\s*/gi, '').replace(/\s*```$/gi, '');
  
  // Replace uppercase \N with literal \\n
  str = str.replace(/\\N/g, '\\n');
  // Escape invalid backslashes (preserving valid JSON escapes: \", \\, \/, \b, \f, \n, \r, \t, \uXXXX)
  str = str.replace(/\\(?!["\\/bfnrt]|u[0-9a-fA-F]{4})/g, '\\\\');

  return str.trim();
}

/**
 * Fail-safe compiler: converts structured `visual` object into valid Mermaid syntax.
 * Supports the 6 diagram types: flowchart, concept, architecture, sequence, tree, comparison.
 *
 * @param {Object} visual
 * @returns {string} Clean, valid Mermaid.js string
 */
function visualToMermaid(visual) {
  if (!visual || visual.enabled === false) return '';
  const type = (visual.type || 'flowchart').toLowerCase().trim();

  // 1. SEQUENCE DIAGRAM
  if (type === 'sequence') {
    let code = 'sequenceDiagram\n';
    if (Array.isArray(visual.connections) && visual.connections.length > 0) {
      visual.connections.forEach(conn => {
        const from = (conn.from || 'Client').replace(/[^a-zA-Z0-9_]/g, '');
        const to = (conn.to || 'Server').replace(/[^a-zA-Z0-9_]/g, '');
        const label = conn.label ? `: ${conn.label.replace(/["\n\r]/g, ' ')}` : ': request';
        code += `  ${from}->>${to}${label}\n`;
      });
    } else if (Array.isArray(visual.nodes) && visual.nodes.length >= 2) {
      for (let i = 0; i < visual.nodes.length - 1; i++) {
        const from = (visual.nodes[i].label || `Actor${i}`).replace(/[^a-zA-Z0-9_]/g, '');
        const to = (visual.nodes[i+1].label || `Actor${i+1}`).replace(/[^a-zA-Z0-9_]/g, '');
        code += `  ${from}->>${to}: Step ${i+1}\n`;
      }
    } else {
      code += '  Client->>Server: Request\n  Server->>Client: Response\n';
    }
    return code;
  }

  // 2. COMPARISON DIAGRAM
  if (type === 'comparison') {
    let code = 'graph LR\n';
    if (Array.isArray(visual.nodes) && visual.nodes.length >= 2) {
      visual.nodes.forEach((node, idx) => {
        const id = (node.id || `N${idx}`).replace(/[^a-zA-Z0-9_]/g, '_');
        const label = (node.label || `Item ${idx}`).replace(/["[\](){}]/g, '').trim();
        code += `  ${id}["${label}"]\n`;
      });
      for (let i = 0; i < visual.nodes.length - 1; i += 2) {
        const id1 = (visual.nodes[i].id || `N${i}`).replace(/[^a-zA-Z0-9_]/g, '_');
        const id2 = (visual.nodes[i+1].id || `N${i+1}`).replace(/[^a-zA-Z0-9_]/g, '_');
        code += `  ${id1} ---|vs| ${id2}\n`;
      }
    }
    return code;
  }

  // 3. ARCHITECTURE DIAGRAM (Horizontal LR flow)
  if (type === 'architecture') {
    let code = 'graph LR\n';
    if (Array.isArray(visual.nodes)) {
      visual.nodes.forEach((node, idx) => {
        const id = (node.id || `A${idx}`).replace(/[^a-zA-Z0-9_]/g, '_');
        const label = (node.label || `Node ${idx}`).replace(/["[\](){}]/g, '').trim();
        code += `  ${id}["${label}"]\n`;
      });
    }
    if (Array.isArray(visual.connections) && visual.connections.length > 0) {
      visual.connections.forEach(conn => {
        const from = (conn.from || '').replace(/[^a-zA-Z0-9_]/g, '_');
        const to = (conn.to || '').replace(/[^a-zA-Z0-9_]/g, '_');
        const label = conn.label ? `|"${conn.label.replace(/"/g, '')}"|` : '';
        if (from && to) code += `  ${from} -->${label} ${to}\n`;
      });
    } else if (Array.isArray(visual.nodes) && visual.nodes.length > 1) {
      for (let i = 0; i < visual.nodes.length - 1; i++) {
        const id1 = (visual.nodes[i].id || `A${i}`).replace(/[^a-zA-Z0-9_]/g, '_');
        const id2 = (visual.nodes[i+1].id || `A${i+1}`).replace(/[^a-zA-Z0-9_]/g, '_');
        code += `  ${id1} --> ${id2}\n`;
      }
    }
    return code;
  }

  // 4. FLOWCHART, CONCEPT, TREE DIAGRAM (Top-Down TD layout)
  let code = 'graph TD\n';
  if (Array.isArray(visual.nodes)) {
    visual.nodes.forEach((node, idx) => {
      const id = (node.id || `N${idx}`).replace(/[^a-zA-Z0-9_]/g, '_');
      const label = (node.label || `Node ${idx}`).replace(/["[\](){}]/g, '').trim();
      code += `  ${id}["${label}"]\n`;
    });
  }

  if (Array.isArray(visual.connections) && visual.connections.length > 0) {
    visual.connections.forEach(conn => {
      const from = (conn.from || '').replace(/[^a-zA-Z0-9_]/g, '_');
      const to = (conn.to || '').replace(/[^a-zA-Z0-9_]/g, '_');
      const label = conn.label ? `|"${conn.label.replace(/"/g, '')}"|` : '';
      if (from && to) code += `  ${from} -->${label} ${to}\n`;
    });
  } else if (Array.isArray(visual.nodes) && visual.nodes.length > 1) {
    for (let i = 0; i < visual.nodes.length - 1; i++) {
      const id1 = (visual.nodes[i].id || `N${i}`).replace(/[^a-zA-Z0-9_]/g, '_');
      const id2 = (visual.nodes[i+1].id || `N${i+1}`).replace(/[^a-zA-Z0-9_]/g, '_');
      code += `  ${id1} --> ${id2}\n`;
    }
  }

  return code;
}

/**
 * Post-processes and validates generated slides.
 */
function postProcessSlides(slides, plan, domain, topic, subTopic) {
  if (!Array.isArray(slides)) {
    throw new Error('Teaching engine expected an array of slides');
  }

  // ── PASS 1: STRUCTURED VISUAL TEACHING ORDER & GUARDRAILS ─────────────
  // Guard Scene 0: MUST be an introduction; NEVER a real-world visual or diagram
  if (slides.length > 0) {
    if (slides[0].realWorldVisual && slides[0].realWorldVisual.enabled) {
      const targetIdx = Math.max(1, Math.min(slides.length - 2, 4));
      if (!slides[targetIdx].isDiagram && !slides[targetIdx].isCode) {
        slides[targetIdx].realWorldVisual = slides[0].realWorldVisual;
        slides[targetIdx].realWorldVisualTiming = slides[0].realWorldVisualTiming;
      }
      slides[0].realWorldVisual = { enabled: false };
      slides[0].realWorldVisualTiming = { enabled: false, appearAtSecond: 0, triggerPhrase: '' };
    }
    slides[0].isDiagram = false;
    slides[0].mermaid = '';
    slides[0].teachingStage = 'introduction';
  }

  // Guard Final Scene: MUST be a recap; NEVER a real-world visual or diagram
  if (slides.length > 1) {
    const lastIdx = slides.length - 1;
    if (slides[lastIdx].realWorldVisual && slides[lastIdx].realWorldVisual.enabled) {
      const prevIdx = lastIdx - 1;
      if (!slides[prevIdx].isDiagram && !slides[prevIdx].isCode) {
        slides[prevIdx].realWorldVisual = slides[lastIdx].realWorldVisual;
        slides[prevIdx].realWorldVisualTiming = slides[lastIdx].realWorldVisualTiming;
      }
      slides[lastIdx].realWorldVisual = { enabled: false };
      slides[lastIdx].realWorldVisualTiming = { enabled: false, appearAtSecond: 0, triggerPhrase: '' };
    }
    slides[lastIdx].isDiagram = false;
    slides[lastIdx].mermaid = '';
    slides[lastIdx].teachingStage = 'recap';
  }

  // Reorder if realWorldVisual appears BEFORE the technical diagram:
  // (The real-world scenario must act as reinforcement AFTER the technical diagram/code)
  let firstDiagramIdx = -1;
  let firstRealWorldIdx = -1;
  for (let i = 0; i < slides.length; i++) {
    if (firstDiagramIdx === -1 && (slides[i].isDiagram || slides[i].isCode || (slides[i].visual && slides[i].visual.enabled))) {
      firstDiagramIdx = i;
    }
    if (firstRealWorldIdx === -1 && slides[i].realWorldVisual && slides[i].realWorldVisual.enabled) {
      firstRealWorldIdx = i;
    }
  }

  if (firstDiagramIdx !== -1 && firstRealWorldIdx !== -1 && firstRealWorldIdx < firstDiagramIdx) {
    const targetIdx = Math.max(firstDiagramIdx + 1, Math.min(slides.length - 2, firstDiagramIdx + 2));
    if (!slides[targetIdx].isDiagram && !slides[targetIdx].isCode) {
      const rwData = slides[firstRealWorldIdx].realWorldVisual;
      const rwTiming = slides[firstRealWorldIdx].realWorldVisualTiming;
      slides[firstRealWorldIdx].realWorldVisual = { enabled: false };
      slides[firstRealWorldIdx].realWorldVisualTiming = { enabled: false, appearAtSecond: 0, triggerPhrase: '' };
      slides[targetIdx].realWorldVisual = rwData;
      slides[targetIdx].realWorldVisualTiming = rwTiming;
    }
  }

  return slides.map((slide, idx) => {
    // Sanitize narration
    slide.narration = sanitizeNarration(slide.narration || '');

    // Strict preservation of user topic and subtopic as heading and subheading
    if (idx === 0) {
      slide.heading = topic ? topic.trim() : (slide.heading || 'Lesson Overview');
      slide.subheading = (subTopic && subTopic.trim()) ? subTopic.trim() : (slide.subheading || topic.trim());
    } else if (topic && topic.trim()) {
      const cleanTopic = topic.trim();
      if (!slide.heading || /blueprint|restaurant|magic|journey|adventure|story|mystery|secret|intro|welcome/i.test(slide.heading)) {
        slide.heading = cleanTopic;
      }
      if (!slide.heading.toLowerCase().includes(cleanTopic.toLowerCase())) {
        if (slide.heading && (!slide.subheading || slide.subheading === cleanTopic)) {
          slide.subheading = slide.heading;
        }
        slide.heading = cleanTopic;
      }
    }

    // Word count and timing estimate
    const wordCount = slide.narration.split(/\s+/).filter(Boolean).length;
    const estimatedSecs = Math.max(15, Math.round((wordCount / WORDS_PER_MINUTE) * 60));
    slide.estimatedDurationSeconds = slide.estimatedDurationSeconds || estimatedSecs;

    // Fill pedagogical metadata defaults if missing
    if (!slide.sceneType) {
      if (idx === 0) slide.sceneType = 'hook';
      else if (idx === slides.length - 1) slide.sceneType = 'summary';
      else if (slide.isCode) slide.sceneType = 'code';
      else if (slide.isDiagram) slide.sceneType = 'diagram';
      else slide.sceneType = 'concept';
    }

    // Assign and normalize teachingStage
    const validStages = [
      'introduction',
      'concept_explanation',
      'technical_visual',
      'diagram_explanation',
      'example',
      'real_world_application',
      'real_world_annotation',
      'concept_mapping',
      'recap'
    ];
    if (idx === 0) {
      slide.teachingStage = 'introduction';
    } else if (idx === slides.length - 1) {
      slide.teachingStage = 'recap';
    } else if (slide.realWorldVisual && slide.realWorldVisual.enabled) {
      slide.teachingStage = (slide.teachingStage && slide.teachingStage.includes('annotation')) 
        ? 'real_world_annotation' 
        : 'real_world_application';
    } else if (slide.isDiagram || (slide.visual && slide.visual.enabled)) {
      slide.teachingStage = 'technical_visual';
    } else if (!slide.teachingStage || !validStages.includes(slide.teachingStage)) {
      if (idx === 1) slide.teachingStage = 'concept_explanation';
      else if (idx === 2) slide.teachingStage = 'example';
      else if (idx === slides.length - 2) slide.teachingStage = 'concept_mapping';
      else slide.teachingStage = 'concept_explanation';
    }

    if (!slide.teachingPurpose) {
      if (slide.sceneType === 'hook') slide.teachingPurpose = 'create_curiosity';
      else if (slide.sceneType === 'summary') slide.teachingPurpose = 'build_mental_model';
      else if (slide.sceneType === 'code') slide.teachingPurpose = 'demonstrate_implementation';
      else if (slide.sceneType === 'diagram') slide.teachingPurpose = 'visualize_structure';
      else slide.teachingPurpose = 'explain_core_mechanics';
    }

    const hasVisual = slide.visual && slide.visual.enabled !== false && (slide.visual.nodes && slide.visual.nodes.length > 0);
    if (slide.isDiagram || hasVisual || (slide.mermaid && slide.mermaid.trim())) {
      slide.isCode = false;

      // STRICT ISOLATION: Diagram slides must never have realWorldVisual enabled
      if (slide.realWorldVisual && slide.realWorldVisual.enabled) {
        slide.realWorldVisual = { enabled: false };
        slide.realWorldVisualTiming = { enabled: false, appearAtSecond: 0, triggerPhrase: '' };
      }

      // Sanitize and strictly enforce visual type to one of the 6 supported types
      if (hasVisual) {
        const rawType = (slide.visual.type || '').toLowerCase();
        if (rawType.includes('seq')) slide.visual.type = 'sequence';
        else if (rawType.includes('arch')) slide.visual.type = 'architecture';
        else if (rawType.includes('tree')) slide.visual.type = 'tree';
        else if (rawType.includes('comp')) slide.visual.type = 'comparison';
        else if (rawType.includes('concept')) slide.visual.type = 'concept';
        else slide.visual.type = 'flowchart';

        slide.visual.enabled = true;
      }

      let validMermaid = '';
      // 1. If structured visual exists, compile cleanly from visual
      if (hasVisual) {
        try {
          validMermaid = visualToMermaid(slide.visual);
        } catch (err) {
          console.warn(`[TeachingEngine] Failed to compile visual to mermaid on slide ${idx + 1}:`, err.message);
        }
      }

      // 2. If no visual but raw mermaid is present, sanitize with diagramService (backward compatibility)
      if (!validMermaid && slide.mermaid && slide.mermaid.trim()) {
        try {
          validMermaid = diagramService.sanitizeMermaid(slide.mermaid);
        } catch (e) {
          console.warn(`[TeachingEngine] Sanitizing mermaid failed on slide ${idx + 1}:`, e.message);
        }
      }

      if (validMermaid) {
        slide.isDiagram = true;
        slide.mermaid = validMermaid;
        if (!slide.visualType) {
          slide.visualType = slide.visual?.type ? `${slide.visual.type}_diagram` : 'flowchart_diagram';
        }
      } else {
        // Fallback: render as normal slide
        slide.isDiagram = false;
        slide.mermaid = '';
        if (slide.visual) slide.visual.enabled = false;
        if (!slide.visualType) slide.visualType = 'callout_card';
      }

      if (!slide.bullets) slide.bullets = [];
    } else {
      slide.isDiagram = false;
      slide.mermaid = '';
      if (slide.visual) slide.visual.enabled = false;
      if (!slide.visualType) slide.visualType = slide.isCode ? 'code_editor' : 'callout_card';
    }

    // Process visualTiming for diagram slides
    if (slide.isDiagram || hasVisual) {
      if (!slide.visualTiming) {
        slide.visualTiming = { enabled: true };
      } else {
        slide.visualTiming.enabled = true;
      }

      const totalSecs = slide.estimatedDurationSeconds || 30;

      // Extract or compute triggerPhrase
      if (!slide.visualTiming.triggerPhrase) {
        const sentences = (slide.narration || '').split(/(?<=[.?!])\s+/);
        const visualSentence = sentences.find(s => /visual|diagram|look at|see this|trace|chart|flow|stack|overview/i.test(s));
        if (visualSentence) {
          slide.visualTiming.triggerPhrase = visualSentence.trim();
        } else if (sentences.length > 1) {
          slide.visualTiming.triggerPhrase = sentences[1].trim();
        } else {
          slide.visualTiming.triggerPhrase = "Let's examine how this works.";
        }
      }

      let calculatedSec = slide.visualTiming.appearAtSecond;
      if (!calculatedSec || calculatedSec <= 0 || calculatedSec >= totalSecs) {
        if (slide.visualTiming.triggerPhrase && slide.narration) {
          const phraseIdx = slide.narration.toLowerCase().indexOf(slide.visualTiming.triggerPhrase.toLowerCase().substring(0, 20));
          if (phraseIdx !== -1 && slide.narration.length > 0) {
            const ratio = phraseIdx / slide.narration.length;
            calculatedSec = Math.round(Math.max(0.20, Math.min(0.60, ratio)) * totalSecs);
          }
        }
        if (!calculatedSec || calculatedSec <= 0) {
          calculatedSec = Math.round(Math.max(3, totalSecs * 0.30));
        }
      }

      slide.visualTiming.appearAtSecond = Math.max(2.5, Math.min(Math.round(totalSecs * 0.75), calculatedSec));
    } else {
      slide.visualTiming = { enabled: false, appearAtSecond: 0, triggerPhrase: '' };
    }

    // Process realWorldVisual and realWorldVisualTiming (Topic-Independent AI Decision)
    const hasRealWorld = !!(slide.realWorldVisual && slide.realWorldVisual.enabled === true &&
      (slide.realWorldVisual.scenario || slide.realWorldVisual.imagePrompt));

    if (hasRealWorld) {
      slide.realWorldVisual.enabled = true;

      // Normalize visualType among the 5 strategies
      const validTypes = ['direct', 'analogy', 'process', 'comparison', 'spatial'];
      let vType = (slide.realWorldVisual.visualType || '').toLowerCase().trim();
      if (!validTypes.includes(vType)) {
        if (vType.includes('anal')) vType = 'analogy';
        else if (vType.includes('proc')) vType = 'process';
        else if (vType.includes('comp')) vType = 'comparison';
        else if (vType.includes('spat') || vType.includes('hier')) vType = 'spatial';
        else vType = 'direct';
      }
      slide.realWorldVisual.visualType = vType;

      if (!slide.realWorldVisual.scenario) {
        slide.realWorldVisual.scenario = `Real-world visual for ${slide.heading}`;
      }
      if (!slide.realWorldVisual.imagePrompt) {
        slide.realWorldVisual.imagePrompt = `A clean educational illustration showing ${slide.realWorldVisual.scenario}, clean simple background, clear recognizable objects, realistic educational appearance, minimal clutter, no text labels, no abstract lines`;
      }
      if (!slide.realWorldVisual.purpose) {
        slide.realWorldVisual.purpose = `Help students intuitively understand ${slide.heading} through a real-world scenario`;
      }
      if (!Array.isArray(slide.realWorldVisual.conceptMapping)) {
        slide.realWorldVisual.conceptMapping = [];
      }

      if (!slide.realWorldVisualTiming) {
        slide.realWorldVisualTiming = { enabled: true };
      } else {
        slide.realWorldVisualTiming.enabled = true;
      }

      const totalSecs = slide.estimatedDurationSeconds || 30;
      if (!slide.realWorldVisualTiming.triggerPhrase) {
        const sentences = (slide.narration || '').split(/(?<=[.?!])\s+/);
        const analogySentence = sentences.find(s => /imagine|picture|think of|like a|consider a|for example|real-world|look at|in this scenario|suppose/i.test(s));
        if (analogySentence) {
          slide.realWorldVisualTiming.triggerPhrase = analogySentence.trim();
        } else if (sentences.length > 1) {
          slide.realWorldVisualTiming.triggerPhrase = sentences[1].trim();
        } else {
          slide.realWorldVisualTiming.triggerPhrase = "Let's look at a real-world example.";
        }
      }

      let calculatedSec = slide.realWorldVisualTiming.appearAtSecond;
      if (!calculatedSec || calculatedSec <= 0 || calculatedSec >= totalSecs) {
        if (slide.realWorldVisualTiming.triggerPhrase && slide.narration) {
          const phraseIdx = slide.narration.toLowerCase().indexOf(slide.realWorldVisualTiming.triggerPhrase.toLowerCase().substring(0, 25));
          if (phraseIdx !== -1 && slide.narration.length > 0) {
            const ratio = phraseIdx / slide.narration.length;
            calculatedSec = Math.round(Math.max(0.18, Math.min(0.60, ratio)) * totalSecs);
          }
        }
        if (!calculatedSec || calculatedSec <= 0) {
          calculatedSec = Math.round(Math.max(3, totalSecs * 0.28));
        }
      }

      slide.realWorldVisualTiming.appearAtSecond = Math.max(2.5, Math.min(Math.round(totalSecs * 0.75), calculatedSec));

      // Process and normalize annotations (arrows, callouts, highlights, boxes)
      const baseAppear = slide.realWorldVisualTiming.appearAtSecond || 4;
      let mappings = slide.realWorldVisual.conceptMapping || [];
      if (mappings.length === 0) {
        const scenarioText = slide.realWorldVisual.scenario || '';
        const parts = scenarioText
          .split(/,|\sand\s|\swith\s/i)
          .map(p => p.trim())
          .filter(p => p.length > 3 && !/scene|background|foreground|setting/i.test(p));

        if (parts.length >= 2) {
          slide.realWorldVisual.conceptMapping = parts.slice(0, 3).map((part, pIdx) => ({
            realWorldElement: part.replace(/^(a|an|the)\s+/i, '').trim(),
            concept: pIdx === 0 ? 'Primary Actor' : (pIdx === 1 ? 'Intermediary / Process' : 'Target / Resource')
          }));
        } else {
          slide.realWorldVisual.conceptMapping = [
            { realWorldElement: 'Physical Analogy', concept: slide.subheading || slide.heading }
          ];
        }
        mappings = slide.realWorldVisual.conceptMapping;
      }

      if (!Array.isArray(slide.realWorldVisual.annotations) || slide.realWorldVisual.annotations.length === 0) {
        slide.realWorldVisual.annotations = mappings.map((m, mIdx, arr) => {
          const count = Math.max(1, arr.length);
          const xPos = Number((0.20 + (mIdx / Math.max(1, count - 1)) * 0.60).toFixed(2));
          return {
            type: 'callout',
            target: m.realWorldElement,
            label: m.realWorldElement,
            concept: m.concept,
            x: xPos,
            y: 0.35,
            appearAtSecond: Number((baseAppear + (mIdx * 2.0)).toFixed(1)),
            triggerPhrase: m.realWorldElement
          };
        });
      } else {
        // Validate and clamp coordinates, sync timing
        slide.realWorldVisual.annotations = slide.realWorldVisual.annotations.map((ann, aIdx) => {
          const validTypes = ['arrow', 'callout', 'highlight', 'box', 'circle', 'label'];
          ann.type = validTypes.includes(ann.type) ? ann.type : 'callout';
          ann.x = Math.max(0.05, Math.min(0.95, typeof ann.x === 'number' ? ann.x : 0.5));
          ann.y = Math.max(0.05, Math.min(0.95, typeof ann.y === 'number' ? ann.y : 0.5));
          if (typeof ann.toX === 'number') ann.toX = Math.max(0.05, Math.min(0.95, ann.toX));
          if (typeof ann.toY === 'number') ann.toY = Math.max(0.05, Math.min(0.95, ann.toY));

          if (ann.triggerPhrase && slide.narration) {
            const phraseIdx = slide.narration.toLowerCase().indexOf(ann.triggerPhrase.toLowerCase().substring(0, 20));
            if (phraseIdx !== -1 && slide.narration.length > 0) {
              const ratio = phraseIdx / slide.narration.length;
              ann.appearAtSecond = Math.max(baseAppear, Math.round(ratio * totalSecs));
            }
          }
          if (!ann.appearAtSecond || ann.appearAtSecond < baseAppear) {
            ann.appearAtSecond = Number((baseAppear + (aIdx * 2.0)).toFixed(1));
          }
          return ann;
        });
      }
    } else {
      slide.realWorldVisual = { enabled: false };
      slide.realWorldVisualTiming = { enabled: false, appearAtSecond: 0, triggerPhrase: '' };
    }

    if (slide.isCode) {
      slide.isDiagram = false;
      slide.mermaid = '';

      if (!slide.fileName) {
        if (domain === 'PROGRAMMING' || /python/i.test(slide.heading)) slide.fileName = 'main.py';
        else if (/javascript|node|react/i.test(slide.heading)) slide.fileName = 'index.js';
        else if (/java/i.test(slide.heading)) slide.fileName = 'Main.java';
        else if (/c\+\+/i.test(slide.heading)) slide.fileName = 'main.cpp';
        else slide.fileName = 'main.py';
      }

      if (!slide.runCommand) {
        if (slide.fileName.endsWith('.py')) slide.runCommand = `python ${slide.fileName}`;
        else if (slide.fileName.endsWith('.js')) slide.runCommand = `node ${slide.fileName}`;
        else if (slide.fileName.endsWith('.java')) slide.runCommand = `java Main`;
        else if (slide.fileName.endsWith('.cpp')) slide.runCommand = `g++ main.cpp -o main && ./main`;
        else slide.runCommand = `python ${slide.fileName}`;
      }

      // Ensure code block is single string in bullets array
      if (!Array.isArray(slide.bullets) || slide.bullets.length === 0) {
        slide.bullets = [slide.code || '# Code example\\Nprint("Hello world")\\N\\N==== OUTPUT ====\\nHello world'];
      }
    } else {
      if (!Array.isArray(slide.bullets)) {
        slide.bullets = [];
      }
    }

    return slide;
  });
}

/**
 * Main entry point: Generates a complete, high-quality educational teaching script.
 *
 * @param {Object} params
 * @param {string} params.topic - Main topic
 * @param {string} params.subTopic - Subtopic or focus area
 * @param {number|string} params.durationMinutes - Target video duration in minutes
 * @returns {Promise<Object>} { success: true, text: string, plan: Object, domain: string }
 */
async function generateTeachingScript({ topic, subTopic, durationMinutes = 5 }) {
  if (!topic || topic.trim() === '') {
    throw new Error('Topic is required for script generation');
  }

  const domain = classifyDomain(topic, subTopic);
  const plan = getDurationPlan(durationMinutes);

  console.log(`[TeachingEngine] Planning lesson: Topic="${topic}", SubTopic="${subTopic}", Duration=${plan.mins}m, Domain=${domain}, Scenes=${plan.sceneCount}, TargetWords=~${plan.totalTargetWords}`);

  const prompt = buildPedagogicalPrompt(topic, subTopic, plan, domain);
  const clientConfig = {};
  if (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY) {
    clientConfig.apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  } else {
    clientConfig.vertexai = process.env.GOOGLE_GENAI_USE_VERTEXAI === 'true';
    clientConfig.project = process.env.GOOGLE_CLOUD_PROJECT;
    clientConfig.location = process.env.GOOGLE_CLOUD_LOCATION || 'global';
  }
  const client = new GoogleGenAI(clientConfig);

  const jsonSchema = {
    type: 'array',
    items: {
      type: 'object',
      properties: {
        heading: { type: 'string' },
        subheading: { type: 'string' },
        bullets: {
          type: 'array',
          items: { type: 'string' }
        },
        narration: { type: 'string' },
        isCode: { type: 'boolean' },
        isDiagram: { type: 'boolean' },
        mermaid: { type: 'string' },
        visual: {
          type: 'object',
          properties: {
            enabled: { type: 'boolean' },
            type: {
              type: 'string',
              enum: ['flowchart', 'concept', 'architecture', 'sequence', 'tree', 'comparison']
            },
            title: { type: 'string' },
            nodes: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  label: { type: 'string' }
                },
                required: ['id', 'label']
              }
            },
            connections: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  from: { type: 'string' },
                  to: { type: 'string' },
                  label: { type: 'string' }
                },
                required: ['from', 'to']
              }
            }
          }
        },
        visualTiming: {
          type: 'object',
          properties: {
            enabled: { type: 'boolean' },
            appearAtSecond: { type: 'number' },
            triggerPhrase: { type: 'string' }
          }
        },
        realWorldVisual: {
          type: 'object',
          properties: {
            enabled: { type: 'boolean' },
            scenario: { type: 'string' },
            purpose: { type: 'string' },
            visualType: {
              type: 'string',
              enum: ['direct', 'analogy', 'process', 'comparison', 'spatial']
            },
            imagePrompt: { type: 'string' },
            conceptMapping: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  realWorldElement: { type: 'string' },
                  concept: { type: 'string' }
                },
                required: ['realWorldElement', 'concept']
              }
            },
            annotations: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  type: {
                    type: 'string',
                    enum: ['arrow', 'callout', 'highlight', 'box', 'circle', 'label']
                  },
                  target: { type: 'string' },
                  label: { type: 'string' },
                  concept: { type: 'string' },
                  x: { type: 'number' },
                  y: { type: 'number' },
                  toX: { type: 'number' },
                  toY: { type: 'number' },
                  appearAtSecond: { type: 'number' },
                  triggerPhrase: { type: 'string' }
                },
                required: ['type', 'label', 'concept', 'x', 'y']
              }
            }
          },
          required: ['enabled']
        },
        realWorldVisualTiming: {
          type: 'object',
          properties: {
            enabled: { type: 'boolean' },
            appearAtSecond: { type: 'number' },
            triggerPhrase: { type: 'string' }
          }
        },
        fileName: { type: 'string' },
        runCommand: { type: 'string' },
        sceneType: { type: 'string' },
        teachingStage: {
          type: 'string',
          enum: [
            'introduction',
            'concept_explanation',
            'technical_visual',
            'diagram_explanation',
            'example',
            'real_world_application',
            'real_world_annotation',
            'concept_mapping',
            'recap'
          ]
        },
        teachingPurpose: { type: 'string' },
        visualType: { type: 'string' },
        estimatedDurationSeconds: { type: 'number' },
        realWorldApplication: { type: 'string' },
        misconception: { type: 'string' }
      },
      required: [
        'heading',
        'subheading',
        'bullets',
        'narration',
        'isCode',
        'isDiagram',
        'mermaid',
        'sceneType',
        'teachingStage',
        'teachingPurpose',
        'visualType',
        'realWorldVisual'
      ]
    }
  };

  const candidateModels = [
    'gemini-3.7-flash',
    'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gemini-1.5-flash'
  ];

  let result = null;
  let lastError = null;
  const timeoutMs = Math.max(180000, (plan?.mins || 5) * 15000); // 180s base, scales up to 15m for 60m scripts

  for (const modelName of candidateModels) {
    try {
      console.log(`[TeachingEngine] Attempting script generation with ${modelName} on Vertex AI (timeout: ${Math.round(timeoutMs/1000)}s)...`);

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Timeout: ${modelName} exceeded ${Math.round(timeoutMs/1000)} seconds`)), timeoutMs)
      );

      const generatePromise = client.models.generateContent({
        model: modelName,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: jsonSchema
        }
      });

      result = await Promise.race([
        generatePromise,
        timeoutPromise
      ]);

      if (result) {
        console.log(`[TeachingEngine] Successfully received response from ${modelName}`);
        if (result.usageMetadata) {
          console.log(`[Token Usage] Provider: vertex-ai, Model: ${modelName}, Input Tokens: ${result.usageMetadata.promptTokenCount}, Output Tokens: ${result.usageMetadata.candidatesTokenCount}, Total Tokens: ${result.usageMetadata.totalTokenCount}, Timestamp: ${new Date().toISOString()}`);
        }
        break;
      }
    } catch (err) {
      lastError = err;
      console.warn(`[TeachingEngine] Model ${modelName} failed (${err.message}). Trying next candidate...`);
    }
  }

  if (!result) {
    throw new Error(`All candidate Gemini models failed. Last error: ${lastError ? lastError.message : 'Unknown'}`);
  }

  const rawText = result.text;
  const cleaned = extractJson(rawText);

  let rawParsed;
  try {
    rawParsed = JSON.parse(cleaned);
  } catch (parseErr) {
    console.warn('[TeachingEngine] Initial JSON parse failed:', parseErr.message, 'Attempting auto-repair...');
    try {
      let repaired = cleaned
        // 1. Remove literal control characters (like unescaped tabs or newlines inside strings)
        .replace(/[\u0000-\u0009\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, ' ')
        // 2. Remove invalid backslashes (any backslash not followed by a valid JSON escape character)
        .replace(/\\(?!["\\/bfnrt]|u[0-9a-fA-F]{4})/g, '');
        
      rawParsed = JSON.parse(repaired);
    } catch (retryErr) {
      console.error('[TeachingEngine] JSON parse auto-repair failed:', retryErr.message);
      // Log some context around the error position to help debugging
      const match = retryErr.message.match(/position (\d+)/);
      if (match && match[1]) {
         const pos = parseInt(match[1], 10);
         const snippet = cleaned.substring(Math.max(0, pos - 30), Math.min(cleaned.length, pos + 30));
         console.error(`[TeachingEngine] Error context near pos ${pos}: "${snippet}"`);
      }
      throw new Error(`Failed to parse AI-generated script JSON: ${parseErr.message} (Repair error: ${retryErr.message})`);
    }
  }

  // If top-level object with scenes array, extract scenes
  let rawSlides = rawParsed;
  if (!Array.isArray(rawParsed) && rawParsed.scenes && Array.isArray(rawParsed.scenes)) {
    rawSlides = rawParsed.scenes;
  }

  // Validate and post-process
  const processedSlides = postProcessSlides(rawSlides, plan, domain, topic, subTopic);
  const formattedJsonText = JSON.stringify(processedSlides, null, 2);

  console.log(`[TeachingEngine] Successfully generated ${processedSlides.length} educational scenes for "${topic}".`);

  return {
    success: true,
    text: formattedJsonText,
    plan,
    domain,
    slideCount: processedSlides.length
  };
}

module.exports = {
  generateTeachingScript,
  classifyDomain,
  getDurationPlan,
  sanitizeNarration,
  visualToMermaid
};
