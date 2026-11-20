/**
 * realWorldConnectionEngine.service.js
 *
 * Intelligent Real-World Connection Engine for Educational Video Generation.
 * Connects technical concepts with:
 *   1. Category A: Real-World Incidents (actual historical events, outages, breakthroughs)
 *   2. Category B: Famous Personalities (inventors, researchers, pioneers)
 *   3. Category C: Movie References & Pop-Culture Analogies (demarcated as fictional analogies)
 *
 * Provides:
 *   - Relevance scoring system (40% technical relevance, 30% educational value, 20% verifiability, 10% engagement)
 *   - Verified historical knowledge base for fact-checking and hallucination prevention
 *   - Natural teacher narration formatting (friendly Indian instructor tone)
 *   - Copyright-safe educational visual prompt generation for Gemini 3.1 Flash Image
 *   - Strict deduplication across multi-scene courses
 */

const CATEGORIES = {
  INCIDENT: 'real_world_incident',
  PERSONALITY: 'famous_personality',
  MOVIE: 'movie_reference'
};

const SCORING_WEIGHTS = {
  technicalRelevance: 0.40,
  educationalValue: 0.30,
  accuracyVerifiability: 0.20,
  studentEngagement: 0.10
};

const MIN_RELEVANCE_THRESHOLD = 75; // Must score >= 75 to be included

/**
 * Curated, verified repository of real-world connections across major technical domains.
 * Serves as ground-truth for fact-checking, scoring, and fallback enrichment.
 */
const VERIFIED_KNOWLEDGE_BASE = [
  // ── CYBERSECURITY ──
  {
    keywords: ['cybersecurity', 'security', 'ransomware', 'malware', 'exploit', 'vulnerability', 'smb', 'patch', 'port'],
    category: CATEGORIES.INCIDENT,
    title: 'WannaCry Ransomware Attack',
    year: '2017',
    personOrEntity: 'Microsoft / UK NHS / Global Healthcare & Logistics',
    technicalConcept: 'Unpatched Network Ports & Vulnerability Management',
    factualSummary: 'In May 2017, the WannaCry ransomware worm infected over 200,000 computers across 150 countries within hours by exploiting an unpatched Windows SMBv1 vulnerability (EternalBlue). It halted surgeries in the UK NHS and disrupted global shipping.',
    teachingConnection: 'Demonstrates that security patching, port isolation, and defense-in-depth are not optional theoretical best practices, but critical operational necessities that prevent systemic collapse.',
    takeaway: 'Always keep operating systems patched, isolate legacy protocols, and disable unused network ports.',
    isFictional: false,
    sourceVerification: 'US Cybersecurity and Infrastructure Security Agency (CISA) Alert TA17-132A / UK National Audit Office 2017 Report',
    visualLayout: 'Split educational diagram: on the left, an open SMB network port allowing malicious packets in; on the right, secure patched network with blocked ports and firewall barrier. Clear labeled cards with green shield for patched systems and red warning for unpatched.',
    scoring: { technicalRelevance: 95, educationalValue: 95, accuracyVerifiability: 100, studentEngagement: 90 }
  },

  // ── ARTIFICIAL INTELLIGENCE & MACHINE LEARNING ──
  {
    keywords: ['artificial intelligence', 'ai', 'turing', 'computation', 'turing machine', 'machine learning', 'enigma', 'cryptography'],
    category: CATEGORIES.PERSONALITY,
    title: 'Alan Turing & the Foundations of Computing',
    year: '1936-1950',
    personOrEntity: 'Alan Turing (Bletchley Park / University of Manchester)',
    technicalConcept: 'Universal Turing Machines & The Turing Test',
    factualSummary: 'Alan Turing formalized the concepts of algorithm and computation with the Universal Turing Machine in 1936, broke the wartime Enigma ciphers at Bletchley Park, and proposed the Turing Test in 1950 to explore machine intelligence.',
    teachingConnection: 'Grounds modern AI and programming in its historical origin: every computer program we run today is fundamentally an implementation of the universal machine Turing envisioned.',
    takeaway: 'Any computable problem can be solved by breaking it down into simple, discrete, algorithmic steps.',
    isFictional: false,
    sourceVerification: 'Turing, A. M. (1936) "On Computable Numbers" / Turing, A. M. (1950) "Computing Machinery and Intelligence"',
    visualLayout: 'Educational historical diagram showing a timeline arrow from the 1936 Universal Turing Machine tape to modern microprocessors and neural network architectures. Clean vector cards, dates, and milestone badges.',
    scoring: { technicalRelevance: 95, educationalValue: 95, accuracyVerifiability: 100, studentEngagement: 85 }
  },
  {
    keywords: ['alphago', 'reinforcement learning', 'deep learning', 'neural network', 'search', 'monte carlo', 'game ai'],
    category: CATEGORIES.INCIDENT,
    title: 'AlphaGo Defeats World Champion Lee Sedol',
    year: '2016',
    personOrEntity: 'DeepMind / Lee Sedol',
    technicalConcept: 'Deep Reinforcement Learning & Monte Carlo Tree Search (MCTS)',
    factualSummary: 'In March 2016 in Seoul, DeepMind\'s AlphaGo defeated 18-time world Go champion Lee Sedol 4-1. Move 37 in Game 2 demonstrated unprecedented creative policy intuition that human Go grandmasters had never played in millennia.',
    teachingConnection: 'Proves how combining deep neural policy networks with Monte Carlo Tree Search enables AI to evaluate astronomical state spaces (more board states than atoms in the universe) that brute-force computation could never solve.',
    takeaway: 'Heuristics and policy evaluations beat brute-force computation in high-dimensional state spaces.',
    isFictional: false,
    sourceVerification: 'Silver, D., et al. (2016) "Mastering the game of Go with deep neural networks and tree search", Nature',
    visualLayout: 'Educational diagram showing a tree search structure: a root board state branching into Monte Carlo simulated paths, with a neural network value evaluation badge giving win probability. Clean 16:9 vector cards.',
    scoring: { technicalRelevance: 95, educationalValue: 90, accuracyVerifiability: 100, studentEngagement: 95 }
  },

  // ── CLOUD COMPUTING & DISTRIBUTED SYSTEMS ──
  {
    keywords: ['cloud', 'cloud computing', 'aws', 'netflix', 'microservices', 'distributed', 'resilience', 'chaos engineering', 'high availability'],
    category: CATEGORIES.INCIDENT,
    title: 'Netflix Moving to AWS & Inventing Chaos Monkey',
    year: '2008-2011',
    personOrEntity: 'Netflix Engineering / AWS',
    technicalConcept: 'Microservices Architecture, Fault Tolerance & Chaos Engineering',
    factualSummary: 'After a major database corruption in their private datacenter in August 2008 shut down DVD shipping for three days, Netflix migrated entirely to AWS cloud microservices and created Chaos Monkey—a tool that intentionally kills production servers randomly to verify resilience.',
    teachingConnection: 'Illustrates the fundamental shift from fragile monolithic servers to self-healing cloud microservices where failures are assumed to be inevitable and continuously tested.',
    takeaway: 'Design distributed systems under the assumption that any component can fail at any second without taking down the user experience.',
    isFictional: false,
    sourceVerification: 'Netflix Technology Blog (2010) "Chaos Monkey Released Into The Wild" / IEEE Software Case Study',
    visualLayout: 'Educational architecture diagram: left side shows a single fragile monolithic server with a red failure cross; right side shows distributed microservices with automated health checks, load balancers, and a self-healing node replacing a failed instance.',
    scoring: { technicalRelevance: 95, educationalValue: 95, accuracyVerifiability: 95, studentEngagement: 90 }
  },
  {
    keywords: ['s3', 'outage', 'blast radius', 'cloud outage', 'cascading failure', 'rate limit', 'deployment'],
    category: CATEGORIES.INCIDENT,
    title: 'AWS S3 US-East-1 Outage Caused by Command Typo',
    year: '2017',
    personOrEntity: 'Amazon Web Services (AWS)',
    technicalConcept: 'Cascading Failures, Blast Radius & Subsystem Dependencies',
    factualSummary: 'In February 2017, an authorized engineer executing an operational playbook entered a typo in a command line parameter intended to take a small number of servers offline for billing maintenance. The command accidentally removed more servers than intended, triggering a massive restart cascade that brought down S3 and thousands of major web applications across the internet for hours.',
    teachingConnection: 'Shows why production tools must have blast-radius constraints, rate limiting, and defensive confirmation barriers rather than allowing raw administrative commands to execute unchecked.',
    takeaway: 'Never rely on human perfection; build defensive guardrails, rate-limiters, and blast-radius limiters directly into operational automation.',
    isFictional: false,
    sourceVerification: 'AWS Post-Event Summary (March 2, 2017): "Summary of the Amazon S3 Service Disruption in the Northern Virginia (US-East-1) Region"',
    visualLayout: 'Educational timeline and dependency diagram showing an operational command impacting a core storage subsystem, with cascading dependency arrows to downstream web services. Clean red/green containment borders.',
    scoring: { technicalRelevance: 90, educationalValue: 95, accuracyVerifiability: 100, studentEngagement: 85 }
  },

  // ── OPERATING SYSTEMS & SYSTEM SOFTWARE ──
  {
    keywords: ['operating system', 'os', 'linux', 'kernel', 'linus torvalds', 'git', 'open source', 'unix'],
    category: CATEGORIES.PERSONALITY,
    title: 'Linus Torvalds Creating Linux & Git',
    year: '1991 / 2005',
    personOrEntity: 'Linus Torvalds (University of Helsinki / Linux Foundation)',
    technicalConcept: 'Monolithic OS Kernels & Distributed Version Control',
    factualSummary: 'In 1991, 21-year-old student Linus Torvalds announced Linux as a free hobby operating system. Today it powers 100% of the world\'s top 500 supercomputers, the majority of cloud servers, and Android. In 2005, frustrated with existing tools, he wrote Git in just a few weeks to manage Linux kernel development.',
    teachingConnection: 'Demonstrates the power of modular, performance-oriented systems programming in C and shows how thoughtful data structures (like Git\'s directed acyclic graph of content hashes) can transform global engineering collaboration.',
    takeaway: 'Great software solves immediate practical developer pain through clean, robust data structures and zero unnecessary abstraction.',
    isFictional: false,
    sourceVerification: 'Torvalds, L. (1991) "What would you like to see most in minix?" comp.os.minix / Torvalds, L. & Diamond, D. "Just for Fun"',
    visualLayout: 'Educational diagram showing the Linux OS layers: User space applications at the top, system call interface (POSIX) in the middle, and the monolithic kernel managing CPU, memory, and devices at the bottom. Clean labeled cards.',
    scoring: { technicalRelevance: 95, educationalValue: 95, accuracyVerifiability: 100, studentEngagement: 90 }
  },
  {
    keywords: ['crowdstrike', 'kernel driver', 'blue screen', 'bsod', 'out of bounds', 'crash', 'driver'],
    category: CATEGORIES.INCIDENT,
    title: 'The CrowdStrike Falcon Sensor Kernel Crash',
    year: '2024',
    personOrEntity: 'CrowdStrike / Microsoft Windows Global Outage',
    technicalConcept: 'Kernel-Mode Execution (Ring 0) & Out-of-Bounds Memory Reads',
    factualSummary: 'In July 2024, a rapid configuration channel update pushed to CrowdStrike Falcon sensor drivers caused 8.5 million Windows machines worldwide to enter a Blue Screen of Death (BSOD) boot loop. An out-of-bounds memory read in kernel driver memory caused an unhandled memory fault at Ring 0, grounding flights and disrupting banks globally.',
    teachingConnection: 'Highlights the severe difference between user-space (Ring 3) software, where a crash only terminates one process, and kernel-space (Ring 0), where any unhandled memory exception brings down the entire operating system.',
    takeaway: 'Privileged kernel-mode code requires rigorous phased rollouts, strict pointer boundary validation, and architectural isolation from rapid telemetry updates.',
    isFictional: false,
    sourceVerification: 'CrowdStrike Falcon Content Update Preliminary Post Incident Review (July 24, 2024) / Microsoft Security Response Center',
    visualLayout: 'Educational diagram contrasting CPU privilege rings: Ring 3 (User Space with browser and apps safely isolated) vs Ring 0 (Kernel Space with OS kernel and drivers having direct hardware access). Labeled cards showing how a Ring 0 fault halts the CPU.',
    scoring: { technicalRelevance: 95, educationalValue: 95, accuracyVerifiability: 100, studentEngagement: 95 }
  },

  // ── INDIAN CINEMA ANALOGIES (PEDAGOGICAL HOOKS) ──
  {
    keywords: ['if', 'if statement', 'if else', 'conditional', 'conditionals', 'branching', 'decision making', 'control flow', 'boolean', 'vikram vedha', 'vedha', 'if condition', 'decision', 'logic'],
    category: CATEGORIES.MOVIE,
    title: 'Vikram Vedha (The Moral Dilemma as If-Else Conditional Branching)',
    year: '2017',
    personOrEntity: 'Film: "Vikram Vedha" (Directors: Pushkar–Gayathri)',
    technicalConcept: 'Boolean Conditions, Mutually Exclusive Branching & Control Flow',
    factualSummary: 'In the film Vikram Vedha, gangster Vedha corners police officer Vikram with a real moral dilemma where Vikram has two clear options: Option 1 is shoot the innocent brother to catch the villain, or Option 2 is let the villain escape to save the innocent brother. Vikram must evaluate the condition: if he decides to save the brother, he executes Option 2; else, he executes Option 1. Both options are mutually exclusive and can never happen at the same time!',
    teachingConnection: 'This is the exact mental model of an if-else statement in programming: you evaluate a condition. If the condition is true, execute the first code block; else, execute the second code block. Just like Vikram\'s choice, only one path can ever run!',
    takeaway: 'An if-else construct guarantees clear, mutually exclusive decision logic—ensure your condition evaluates cleanly to true or false without unhandled edge cases.',
    isFictional: true,
    isIndian: true,
    sourceVerification: 'YNOT Studios (2017) "Vikram Vedha" - Cited strictly as a conceptual pedagogical analogy.',
    visualLayout: 'Educational decision-tree diagram: on the left, Vikram facing Vedha\'s moral riddle; in the middle, a diamond boolean condition decision node evaluating to True or False; on the right, two mutually exclusive execution paths: Option A (If-Block) and Option B (Else-Block). Clean modern vector layout.',
    scoring: { technicalRelevance: 100, educationalValue: 95, accuracyVerifiability: 95, studentEngagement: 100 }
  },
  {
    keywords: ['loop', 'loops', 'for loop', 'while loop', 'do while', 'iteration', 'infinite loop', 'break condition', 'maanaadu', 'time loop', 'simbu', 'while', 'for', 'looping', 'repeat'],
    category: CATEGORIES.MOVIE,
    title: 'Maanaadu (The Time Loop as While-Loop Iteration & Break Conditions)',
    year: '2021',
    personOrEntity: 'Film: "Maanaadu" (Director: Venkat Prabhu)',
    technicalConcept: 'Loop Iteration, State Evolution & Loop Termination Conditions',
    factualSummary: 'In the film Maanaadu, the protagonist Abdul Khaliq is trapped in a relentless time loop where he repeatedly wakes up on a flight to Coimbatore. Every time he dies or fails to stop the assassination, the execution sequence resets to the initial state. The loop only terminates when he discovers the exact exit condition and successfully executes the break sequence.',
    teachingConnection: 'The perfect visual analogy for while-loops and for-loops in programming: a code block repeats continuously as long as the loop condition remains true. If you forget to update state or fail to provide a valid break condition, the program is trapped in an infinite loop, exactly like a time loop in cinema.',
    takeaway: 'Every loop must have a guaranteed termination condition and state update to prevent runaway infinite execution.',
    isFictional: true,
    isIndian: true,
    sourceVerification: 'V House Productions (2021) "Maanaadu" - Cited strictly as a conceptual pedagogical analogy.',
    visualLayout: 'Educational loop cycle diagram: a circular execution track showing Step 1 -> Step 2 -> Step 3 returning to the top condition check, with a prominent break arrow leading to "Loop Terminated (Success)". Clean vector cards with iteration counter.',
    scoring: { technicalRelevance: 100, educationalValue: 95, accuracyVerifiability: 95, studentEngagement: 100 }
  },
  {
    keywords: ['function', 'functions', 'method', 'methods', 'subroutine', 'modularity', 'reusability', 'parameters', 'arguments', 'jailer', 'rajinikanth', 'muthuvel pandian', 'def', 'call', 'procedure'],
    category: CATEGORIES.MOVIE,
    title: 'Jailer (Tiger Muthuvel Pandian Pre-Configured Snipers as Function Definition & Call)',
    year: '2023',
    personOrEntity: 'Film: "Jailer" (Director: Nelson Dilipkumar)',
    technicalConcept: 'Function Definition, Parameter Passing, Modularity & Function Invocation',
    factualSummary: 'In the film Jailer, Tiger Muthuvel Pandian (Rajinikanth) does not shoot the armed attackers himself in that moment. Instead, he sets up a reusable sniper system beforehand with defined coordinates and targets (function definition). When the villains back him into a corner, he simply places a phone call—passing the trigger argument to invoke the pre-configured function instantly.',
    teachingConnection: 'Vividly illustrates why functions exist in programming: instead of writing messy, repetitive execution logic on the fly, you define a reusable routine once with parameters. Whenever you need that task accomplished, you simply place a call—invoking the function with the right arguments.',
    takeaway: 'Write modular, reusable functions with explicit parameters instead of duplicating monolithic code across your program.',
    isFictional: true,
    isIndian: true,
    sourceVerification: 'Sun Pictures (2023) "Jailer" - Cited strictly as a conceptual pedagogical analogy.',
    visualLayout: 'Educational function architecture diagram: on the left, "Function Definition: triggerSnipers(targetCoordinates)" showing pre-configured logic; in the middle, main program making a single call "triggerSnipers(room_A)"; on the right, instant reusable execution output. Clean vector cards.',
    scoring: { technicalRelevance: 100, educationalValue: 95, accuracyVerifiability: 95, studentEngagement: 100 }
  },
  {
    keywords: ['if', 'if statement', 'if else', 'conditional', 'conditionals', 'branching', 'validation', 'decision making', 'anniyan', 'aparichit', 'rules', 'rule', 'guard clause'],
    category: CATEGORIES.MOVIE,
    title: 'Anniyan (Garuda Purana Rule-Based Conditional Evaluation & Enforcement)',
    year: '2005',
    personOrEntity: 'Film: "Anniyan" (Director: S. Shankar)',
    technicalConcept: 'Conditional Rule Engines, Precondition Checking & Strict If-Else Assertions',
    factualSummary: 'In the film Anniyan, Ambi encounters civic infractions. When rules are strictly followed (condition == true), normal society proceeds undisturbed; but when an infraction occurs (condition == false), his alter-ego Anniyan triggers an uncompromising punitive block dictated by Garuda Purana rules.',
    teachingConnection: 'Provides a memorable mental model for defensive if-statement validation in software: an incoming state is checked against strict rules. If validation passes, the standard business logic runs; else, execution branches immediately into a defensive handler.',
    takeaway: 'Use strict conditional validations at system entry points to protect your application from invalid or malicious states.',
    isFictional: true,
    isIndian: true,
    sourceVerification: 'Aascar Films (2005) "Anniyan" - Cited strictly as a conceptual pedagogical analogy.',
    visualLayout: 'Educational input validation flow: Incoming Data -> Condition Check (rule compliant?) -> True path (Standard Execution) vs False path (Defensive Error Block). Clean labeled cards with green/red badges.',
    scoring: { technicalRelevance: 100, educationalValue: 95, accuracyVerifiability: 95, studentEngagement: 100 }
  },
  {
    keywords: ['loop', 'loops', 'for loop', 'while loop', 'do while', 'iteration', '24 movie', 'suriya', 'time travel', 'while', 'timer', 'delay', 'timing'],
    category: CATEGORIES.MOVIE,
    title: '24 (The Watch Time Manipulation as Loop Iteration & State Pauses)',
    year: '2016',
    personOrEntity: 'Film: "24" (Director: Vikram Kumar)',
    technicalConcept: 'Loop States, Iteration Delays & Clock-Driven Execution Cycles',
    factualSummary: 'In the film 24, watchmaker Mani uses a time-manipulating watch that enables him to freeze external time for precise intervals, execute actions while world state is paused, and rewind iterations to repeat events under controlled conditions.',
    teachingConnection: 'Analogous to timed loop iterations and state controllers: a loop iterates through discrete state changes, pauses for defined intervals, and checks whether the continuation condition remains valid.',
    takeaway: 'Controlled loop iterations allow software to poll, process streams, and update state at deterministic intervals.',
    isFictional: true,
    isIndian: true,
    sourceVerification: '2D Entertainment (2016) "24" - Cited strictly as a conceptual pedagogical analogy.',
    visualLayout: 'Educational timing loop diagram: showing state updates advancing on clock ticks with pause conditions and rewind branches. Clean vector diagram.',
    scoring: { technicalRelevance: 95, educationalValue: 95, accuracyVerifiability: 95, studentEngagement: 100 }
  },
  {
    keywords: ['function', 'functions', 'method', 'methods', 'subroutine', 'sivaji', 'rajinikanth', 'sivaji the boss', 'modularity', 'decomposition', 'delegation'],
    category: CATEGORIES.MOVIE,
    title: 'Sivaji The Boss (Systematic Delegated Execution & Modular Functions)',
    year: '2007',
    personOrEntity: 'Film: "Sivaji The Boss" (Director: S. Shankar)',
    technicalConcept: 'Modular Decomposition, Single Responsibility & Delegated Subroutines',
    factualSummary: 'In the film Sivaji The Boss, Sivaji organizes complex social projects by delegating tasks into distinct, specialized modular teams—each team executing a single focused responsibility (legal audit, construction, public funds) rather than creating a tangled, unmaintainable single operation.',
    teachingConnection: 'Teaches the core software principle of modular functions: decompose complex monolithic tasks into clean, single-responsibility functions that each take inputs, process them independently, and return results to the caller.',
    takeaway: 'Functions provide modular abstraction—keep each function focused on a single responsibility for maintainable code.',
    isFictional: true,
    isIndian: true,
    sourceVerification: 'AVM Productions (2007) "Sivaji The Boss" - Cited strictly as a conceptual pedagogical analogy.',
    visualLayout: 'Educational modular decomposition diagram: Master Program delegating inputs to specialized function blocks (Audit, Build, Verify), with return arrows converging back. Clean vector cards.',
    scoring: { technicalRelevance: 95, educationalValue: 95, accuracyVerifiability: 95, studentEngagement: 100 }
  },
  {
    keywords: ['recursion', 'recursive', 'call stack', 'base case', 'divide and conquer', 'enthiran', 'robot', 'chitti'],
    category: CATEGORIES.MOVIE,
    title: 'Enthiran (Chitti Replicating Formations as Recursive Self-Assembly)',
    year: '2010',
    personOrEntity: 'Film: "Enthiran" (Director: S. Shankar)',
    technicalConcept: 'Recursive Self-Similarity, Call Stack Decomposition & Base Conditions',
    factualSummary: 'In the climax of Enthiran, Chitti commands hundreds of identical robotic units to dynamically link and assemble into composite structures—a sphere, a serpent, and a giant titan. Each individual robot executes the same self-similar configuration rules until the desired macroscopic shape is reached.',
    teachingConnection: 'Provides an intuitive mental model for recursion: large, complex structures are resolved by breaking the problem down into identical, self-similar sub-units that each perform a simple task until a base condition is satisfied.',
    takeaway: 'Recursive algorithms solve complex hierarchical problems by delegating work to smaller, self-similar instances of the same function with a verified base case.',
    isFictional: true,
    isIndian: true,
    sourceVerification: 'Sun Pictures (2010) "Enthiran" - Cited strictly as a conceptual pedagogical analogy.',
    visualLayout: 'Educational recursive hierarchy diagram: showing a master task decomposing into smaller identical robot nodes forming a tree structure, with base cases unwinding at the bottom. Clean vector diagram.',
    scoring: { technicalRelevance: 95, educationalValue: 95, accuracyVerifiability: 90, studentEngagement: 100 }
  },

  // ── INDIAN HIGH-TECH REAL-WORLD INCIDENTS & SYSTEMS ARCHITECTURE ──
  {
    keywords: ['upi', 'npci', 'payment', 'distributed systems', 'acid', 'transaction', 'two phase commit', 'fintech', 'banking', 'microservices'],
    category: CATEGORIES.INCIDENT,
    title: 'UPI (Unified Payments Interface) Real-Time Distributed Payment Switch',
    year: '2016-Present',
    personOrEntity: 'National Payments Corporation of India (NPCI) / Reserve Bank of India (RBI)',
    technicalConcept: 'Distributed ACID Transactions, Two-Phase Commits & High-Throughput Switching',
    factualSummary: 'Launched by NPCI in 2016, India\'s Unified Payments Interface (UPI) orchestrates over 14 billion instant transactions monthly across 500+ commercial banks. It coordinates a real-time distributed transaction across the remitter bank, NPCI central switch, and beneficiary bank without double-spending or state inconsistency.',
    teachingConnection: 'Teaches students how modern distributed systems achieve strict ACID transaction guarantees and sub-second latency across heterogeneous third-party banking APIs.',
    takeaway: 'Design distributed architectures with idempotency keys, atomic distributed locks, and two-phase commits to ensure zero state inconsistency under massive volume.',
    isFictional: false,
    isIndian: true,
    sourceVerification: 'NPCI UPI Product Overview / Reserve Bank of India Payment System Bulletins',
    visualLayout: 'Educational distributed transaction diagram: Remitter Bank -> NPCI Central Switch -> Beneficiary Bank, showing the 2-Phase Commit (Prepare -> Commit) with atomic verification checks. Clean vector cards with arrows.',
    scoring: { technicalRelevance: 100, educationalValue: 95, accuracyVerifiability: 100, studentEngagement: 95 }
  },
  {
    keywords: ['concurrency', 'multithreading', 'race condition', 'locking', 'database locking', 'queue', 'redis', 'irctc', 'tatkal', 'threads', 'thread pool', 'rate limit'],
    category: CATEGORIES.INCIDENT,
    title: 'IRCTC Tatkal 10:00 AM Concurrency & Optimistic Database Locking',
    year: '2014-Present',
    personOrEntity: 'Centre for Railway Information Systems (CRIS) / IRCTC',
    technicalConcept: 'Concurrency Control, Race Conditions, Thread Contention & Row-Level Locking',
    factualSummary: 'Every morning at 10:00 AM and 11:00 AM, the IRCTC train booking platform experiences a sudden influx of millions of concurrent user sessions competing for tens of thousands of Tatkal train seats within a 60-second window.',
    teachingConnection: 'A legendary real-world case study for concurrency, thread pools, and race conditions. Without strict database row-level locking (SELECT FOR UPDATE) and distributed queues, concurrent user threads reading the same available seat count simultaneously would cause fatal overbooking.',
    takeaway: 'Under heavy concurrent load, use distributed queues, optimistic locking, and atomic inventory decrements to prevent race conditions and data corruption.',
    isFictional: false,
    isIndian: true,
    sourceVerification: 'CRIS Technical Architecture Review / Indian Railways IT Infrastructure Whitepapers',
    visualLayout: 'Educational concurrency diagram: multiple concurrent user threads arriving at time T0 competing for 1 available seat; showing an unhandled race condition (double booking) contrasted with an atomic queue with row-level locking.',
    scoring: { technicalRelevance: 100, educationalValue: 95, accuracyVerifiability: 100, studentEngagement: 100 }
  },
  {
    keywords: ['fault tolerance', 'exception handling', 'error handling', 'try catch', 'redundancy', 'isro', 'chandrayaan', 'safe mode', 'embedded', 'autonomous'],
    category: CATEGORIES.INCIDENT,
    title: 'ISRO Chandrayaan-3 Autonomous Descent & Failure-Based Software Architecture',
    year: '2023',
    personOrEntity: 'Indian Space Research Organisation (ISRO) - Vikram Lander',
    technicalConcept: 'Failure-Based Software Design, Autonomous Safe-Mode & Sensor Redundancy',
    factualSummary: 'In August 2023, ISRO successfully executed a soft landing on the Moon\'s South Pole. Following the Chandrayaan-2 telemetry anomaly, ISRO re-engineered the flight software around a "failure-based architecture"—giving the onboard computer autonomous algorithms to dynamically adjust descent velocity, bypass malfunctioning thrusters, and select safe landing zones without ground control.',
    teachingConnection: 'Demonstrates defensive programming and fault tolerance: software must be engineered not just for the ideal "happy path", but with defensive try-catch handlers, autonomous fallback algorithms, and sensor redundancy for every conceivable failure mode.',
    takeaway: 'Build resilient systems by designing for failure: incorporate autonomous safe modes, redundant inputs, and graceful degradation.',
    isFictional: false,
    isIndian: true,
    sourceVerification: 'ISRO Chandrayaan-3 Mission Report / S. Somanath "Failure-Based Design Philosophy" Address',
    visualLayout: 'Educational fault-tolerant architecture diagram: Lunar lander descending with sensor inputs (Altimeter, Velocimeter, Hazard Camera); showing a sensor failure triggering an instant autonomous fallback routine without system crash.',
    scoring: { technicalRelevance: 100, educationalValue: 100, accuracyVerifiability: 100, studentEngagement: 100 }
  },
  {
    keywords: ['aadhaar', 'uidai', 'biometric', 'deduplication', 'indexing', 'hashing', 'big data', 'scalability', 'distributed database'],
    category: CATEGORIES.INCIDENT,
    title: 'Aadhaar (UIDAI) Large-Scale Biometric Deduplication & 1:N Search Engine',
    year: '2010-Present',
    personOrEntity: 'Unique Identification Authority of India (UIDAI)',
    technicalConcept: 'Large-Scale Distributed Indexing, Hashing & 1:N Biometric Search',
    factualSummary: 'The Unique Identification Authority of India (UIDAI) manages the world\'s largest biometric identity system, serving over 1.4 billion residents. Every new registration undergoes a 1:N biometric deduplication search against billions of existing fingerprint and iris vector records to prevent duplicate identities.',
    teachingConnection: 'Teaches students why hash indexing, spatial partitioning, and distributed search engines are mandatory when datasets grow to billions of records—brute-force sequential scanning would take days per lookup.',
    takeaway: 'At billion-scale, query performance is dictated entirely by efficient indexing, sharding, and hashing algorithms rather than raw CPU power.',
    isFictional: false,
    isIndian: true,
    sourceVerification: 'UIDAI Technology Architecture Whitepaper / National Informatics Centre (NIC) Reports',
    visualLayout: 'Educational database architecture diagram: incoming record hashing into biometric feature vectors, routing through distributed sharded nodes with B-tree and spatial indexes to achieve sub-second lookup. Clean vector cards.',
    scoring: { technicalRelevance: 95, educationalValue: 95, accuracyVerifiability: 100, studentEngagement: 90 }
  },
  {
    keywords: ['ramanujan', 'number theory', 'modular arithmetic', 'partition formula', 'infinite series', 'elliptic functions', 'pi formula'],
    category: CATEGORIES.PERSONALITY,
    title: 'Srinivasa Ramanujan & the Foundations of Algorithmic Mathematics',
    year: '1914',
    personOrEntity: 'Srinivasa Ramanujan (Trinity College, Cambridge / Madras University)',
    technicalConcept: 'Algorithmic Modular Arithmetic, Partition Functions & Infinite Series',
    factualSummary: 'Srinivasa Ramanujan, one of history\'s greatest mathematical geniuses, discovered thousands of groundbreaking formulas for infinite series, partition functions, and modular forms. His 1914 fast series for Pi forms the algorithmic foundation used in modern high-precision scientific computing and cryptographic modular arithmetic.',
    teachingConnection: 'Inspires students by showing how pure mathematical and algorithmic intuition enables exponential computational efficiency—transforming problems that would take centuries of brute-force compute into instant calculations.',
    takeaway: 'Algorithmic breakthroughs provide exponential multipliers that no amount of raw hardware can match.',
    isFictional: false,
    isIndian: true,
    sourceVerification: 'Ramanujan, S. (1914) "Modular Equations and Approximations to Pi", Quarterly Journal of Mathematics',
    visualLayout: 'Educational mathematics and computing diagram: Ramanujan\'s 1914 infinite series formula branching into modern algorithmic implementations: Fast Fourier Transforms, Cryptographic Keys, and Precision Floating-Point Arithmetic.',
    scoring: { technicalRelevance: 95, educationalValue: 95, accuracyVerifiability: 100, studentEngagement: 95 }
  },
  {
    keywords: ['if', 'if statement', 'if else', 'conditional', 'conditionals', 'branching', 'threshold', 'circuit breaker', 'stock market', 'trading', 'nse', 'bse', 'halt', 'boundary check', 'safety limit'],
    category: CATEGORIES.INCIDENT,
    title: 'Indian Stock Market (NSE/BSE) 10% Circuit Breaker Automated Conditional Trading Halt',
    year: '2020',
    personOrEntity: 'Securities and Exchange Board of India (SEBI) / NSE / BSE',
    technicalConcept: 'Threshold Evaluation, Automated Circuit Breakers & Safe State Transition',
    factualSummary: 'In March 2020 during peak market volatility, the Nifty index plunged 10% within seconds of market opening. SEBI\'s automated exchange engine evaluated the condition: if (dropPercent >= 10.0) { haltOrderMatching(45_MINS); triggerMarketCooling(); } else { proceedTrading(); }. The automated conditional check instantly halted nationwide trading, preventing a catastrophic liquidity collapse.',
    teachingConnection: 'Demonstrates how production financial software relies on strict if-statement boundary and threshold checks to trigger safety circuit breakers and prevent runaway crashes.',
    takeaway: 'Automated conditional checks on numerical thresholds are crucial protective barriers in mission-critical software.',
    isFictional: false,
    isIndian: true,
    sourceVerification: 'SEBI Circular on Nationwide Market Circuit Breakers / NSE Operational Bulletins',
    visualLayout: 'Educational financial threshold diagram: Index value falling toward 10% limit line -> Condition check (drop >= 10%?) -> True branch triggering automated circuit breaker lock. Clean vector diagram.',
    scoring: { technicalRelevance: 100, educationalValue: 95, accuracyVerifiability: 100, studentEngagement: 95 }
  },
  {
    keywords: ['if', 'if statement', 'if else', 'conditional', 'conditionals', 'branching', 'validation', 'authentication', 'digiyatra', 'airport', 'biometric', 'gate', 'access control', 'compound condition'],
    category: CATEGORIES.INCIDENT,
    title: 'DigiYatra Airport Contactless Gate Automated Biometric Verification',
    year: '2022-Present',
    personOrEntity: 'Ministry of Civil Aviation / Digi Yatra Foundation (India)',
    technicalConcept: 'Multi-Condition Authentication Gateways & Access Control Flow',
    factualSummary: 'At major Indian airports with DigiYatra, when you walk up to the smart gate, a camera scans your face. An automated program runs a simple check: if your face matches your flight ticket, the gate opens and lets you board; else, the gate stays locked and directs you to a human security officer for manual check.',
    teachingConnection: 'A super clear, relatable everyday example for students: access is granted only when the condition evaluates to true; otherwise, it safely branches to the else handler.',
    takeaway: 'In real-world software, conditional gates ensure only valid requests proceed while safely handling all other cases.',
    isFictional: false,
    isIndian: true,
    sourceVerification: 'DigiYatra Central Ecosystem Technical Specs / Airports Authority of India (AAI)',
    visualLayout: 'Educational biometric authentication flowchart: Camera input + Boarding pass data -> Compound boolean condition check -> Success branch (open turnstile) vs Denied branch (manual security). Clean vector cards.',
    scoring: { technicalRelevance: 100, educationalValue: 95, accuracyVerifiability: 100, studentEngagement: 95 }
  },

  // ── PROGRAMMING & COMPILERS ──
  {
    keywords: ['c', 'c language', 'c programming', 'ansi c', 'k&r', 'dennis ritchie', 'brian kernighan', 'bell labs', 'systems programming', 'ken thompson'],
    category: CATEGORIES.PERSONALITY,
    title: 'Dennis Ritchie Creating the C Programming Language at Bell Labs',
    year: '1972',
    personOrEntity: 'Dennis Ritchie & Ken Thompson (Bell Labs)',
    technicalConcept: 'Structured Control Flow, Low-Level Hardware Control & Portability',
    factualSummary: 'In 1972 at Bell Labs, Dennis Ritchie created the C programming language to rewrite the Unix operating system. C replaced assembly with structured control flow (if-else, loops, functions) while keeping direct hardware and memory access. Its syntax for conditionals and control structures became the universal foundation for C++, Java, JavaScript, C#, Python, and Rust.',
    teachingConnection: 'Shows how C\'s conditional if-else syntax was engineered to map directly into efficient assembly CPU jump instructions (like JMP, JZ, JNZ) while remaining intuitive and readable for humans.',
    takeaway: 'Mastering C\'s structured control flow teaches you how computer hardware actually executes logical branches at machine level.',
    isFictional: false,
    sourceVerification: 'Ritchie, D. M. (1993) "The Development of the C Language", ACM SIGPLAN / Kernighan, B. W. & Ritchie, D. M. "The C Programming Language" (K&R)',
    visualLayout: 'Educational timeline and architecture diagram: on the left, Dennis Ritchie at Bell Labs 1972; in the middle, C compiler parsing an if-else decision block into CPU branch/jump instructions; on the right, modern operating systems and kernels powered by C. Clean vector cards with arrows.',
    scoring: { technicalRelevance: 100, educationalValue: 95, accuracyVerifiability: 100, studentEngagement: 90 }
  },
  {
    keywords: ['if statement', 'if else', 'conditional', 'conditionals', 'branching', 'decision making', 'control flow', 'boolean', 'matrix', 'red pill'],
    category: CATEGORIES.MOVIE,
    title: 'The Matrix (The Red Pill vs. Blue Pill Decision as Conditional Branching)',
    year: '1999',
    personOrEntity: 'Film: "The Matrix" (Directors: The Wachowskis)',
    technicalConcept: 'Boolean Conditions, Branching Execution Paths & Mutually Exclusive Logic',
    factualSummary: 'In the film "The Matrix", Morpheus presents Neo with a pivotal conditional choice: take the blue pill to remain in comfortable illusion, or take the red pill to discover the truth. Only one path can be taken; choosing one branch permanently excludes the other.',
    teachingConnection: 'Serves as the perfect visual analogy for the if-else construct in programming: a single condition evaluation (isPillRed == true) creates two mutually exclusive execution paths. If the condition is true, the if-block executes; otherwise, the else-block executes.',
    takeaway: 'An if-else statement represents a decisive fork in program execution—ensure your conditions evaluate unambiguously to true or false.',
    isFictional: true,
    sourceVerification: 'Warner Bros. Pictures (1999) "The Matrix" - Cited strictly as a conceptual pedagogical analogy.',
    visualLayout: 'Educational comparison diagram: on the left side, labeled cards showing the Red Pill vs Blue Pill decision fork; on the right side, the corresponding programming flowchart with a diamond condition branching into True (if-block) and False (else-block). Clean modern vector layout.',
    scoring: { technicalRelevance: 95, educationalValue: 95, accuracyVerifiability: 90, studentEngagement: 95 }
  },
  {
    keywords: ['embedded', 'safety critical', 'therac', 'therac-25', 'race condition', 'flag', 'state machine', 'microcontroller', 'embedded systems', 'c bug'],
    category: CATEGORIES.INCIDENT,
    title: 'The Therac-25 Medical Radiation Disaster (Unhandled State Flag Flaw)',
    year: '1985-1987',
    personOrEntity: 'Atomic Energy of Canada Limited (AECL)',
    technicalConcept: 'State Flags, Race Conditions & Safety-Critical Conditional Checks',
    factualSummary: 'Between 1985 and 1987, the Therac-25 computer-controlled radiation therapy machine delivered lethal massive overdoses of radiation to patients. A software flaw involving a one-byte conditional flag incremented past 255 caused an overflow to 0, which bypassed a safety check and fired full-power 25-MeV electron beams before protective beam-softening magnets were in place.',
    teachingConnection: 'Provides a critical lesson for engineers: conditional statements in systems programming and embedded C are not academic exercises—a missing boundary check or unchecked state flag can have catastrophic physical consequences.',
    takeaway: 'In safety-critical systems, never assume a condition is safe by default; always enforce explicit state validation and defensive assertions.',
    isFictional: false,
    sourceVerification: 'Leveson, N. & Turner, C. S. (1993) "An Investigation of the Therac-25 Accidents", IEEE Computer',
    visualLayout: 'Educational system safety diagram: left side shows the unhandled conditional flag overflow bypassing the safety interlock; right side shows the safe defensive check with explicit boundary assertions. Clean labeled cards and warning indicators.',
    scoring: { technicalRelevance: 95, educationalValue: 100, accuracyVerifiability: 100, studentEngagement: 95 }
  },
  {
    keywords: ['ada lovelace', 'analytical engine', 'first programmer', 'algorithm', 'conditional branching', 'history of computing'],
    category: CATEGORIES.PERSONALITY,
    title: 'Ada Lovelace & the Conception of Conditional Branching',
    year: '1843',
    personOrEntity: 'Ada Lovelace (Collaboration with Charles Babbage)',
    technicalConcept: 'Algorithmic Sequence, Conditional Branching & Symbolic Computation',
    factualSummary: 'In 1843, Ada Lovelace translated Luigi Menabrea\'s paper on Charles Babbage\'s Analytical Engine and added extensive notes. In Note G, she described an algorithm to calculate Bernoulli numbers—widely recognized as the world\'s first published computer program. Lovelace foresaw that computers could manipulate symbols and make conditional jumps based on intermediate results.',
    teachingConnection: 'Grounds conditional branching in history: Lovelace realized that machines become truly powerful not just when they perform linear calculations, but when they can evaluate conditions to choose their next action dynamically.',
    takeaway: 'Dynamic decision-making (conditional branching) is what separates a true computer from a simple mechanical calculator.',
    isFictional: false,
    sourceVerification: 'Lovelace, A. A. (1843) "Sketch of the Analytical Engine Invented by Charles Babbage, with Notes by the Translator"',
    visualLayout: 'Educational historical diagram showing Ada Lovelace\'s 1843 algorithm table with conditional branching arrows connecting to modern code execution flow. Clean vector timeline.',
    scoring: { technicalRelevance: 95, educationalValue: 95, accuracyVerifiability: 100, studentEngagement: 85 }
  },
  {
    keywords: ['c++', 'cpp', 'bjarne stroustrup', 'object oriented c', 'classes', 'c with classes'],
    category: CATEGORIES.PERSONALITY,
    title: 'Bjarne Stroustrup Creating C++ & Zero-Overhead Abstractions',
    year: '1979-1985',
    personOrEntity: 'Bjarne Stroustrup (Bell Labs)',
    technicalConcept: 'Object-Oriented Programming, Zero-Cost Abstractions & RAII',
    factualSummary: 'In 1979 at Bell Labs, Bjarne Stroustrup began creating "C with Classes" (later named C++ in 1983) to combine Simula\'s object-oriented modularity with C\'s raw hardware speed. He championed the principle of "zero-overhead abstractions"—what you don\'t use, you don\'t pay for—and invented RAII for deterministic memory and resource management.',
    teachingConnection: 'Helps students understand how C++ extended C with classes, encapsulation, and type safety without sacrificing bare-metal performance.',
    takeaway: 'Zero-overhead abstractions allow high-level software architectures to run with bare-metal hardware efficiency.',
    isFictional: false,
    sourceVerification: 'Stroustrup, B. (1994) "The Design and Evolution of C++", Addison-Wesley',
    visualLayout: 'Educational diagram contrasting C procedural struct-and-function layout with C++ class encapsulation, member functions, access modifiers, and RAII lifetime management.',
    scoring: { technicalRelevance: 95, educationalValue: 95, accuracyVerifiability: 100, studentEngagement: 85 }
  },
  {
    keywords: ['javascript', 'js', 'brendan eich', 'netscape', 'frontend', 'scripting', 'ecmascript'],
    category: CATEGORIES.PERSONALITY,
    title: 'Brendan Eich Creating JavaScript in 10 Days at Netscape',
    year: '1995',
    personOrEntity: 'Brendan Eich (Netscape Communications)',
    technicalConcept: 'Dynamic First-Class Functions, Prototypal Inheritance & Event-Driven UI',
    factualSummary: 'In May 1995, Brendan Eich developed Mocha (later renamed JavaScript) in just 10 days at Netscape Communications. Designed to bring interactivity to the static World Wide Web, JavaScript combined Scheme\'s first-class functions, Self\'s prototype-based inheritance, and Java-like syntax, eventually becoming the most widely deployed programming language in human history.',
    teachingConnection: 'Shows how rapid language design compromises and event-driven architecture enabled dynamic browser scripting and modern web applications.',
    takeaway: 'Ubiquitous platform integration and approachable syntax often drive language adoption more than theoretical purity.',
    isFictional: false,
    sourceVerification: 'Eich, B. (2008) "JavaScript: The First 20 Years", HOPL IV / Netscape Communications Archive',
    visualLayout: 'Educational architectural diagram: Netscape browser showing HTML/CSS rendering engine, with the JavaScript engine executing event-driven DOM manipulation via an event loop and callback queue.',
    scoring: { technicalRelevance: 95, educationalValue: 90, accuracyVerifiability: 100, studentEngagement: 85 }
  },
  {
    keywords: ['apollo', 'apollo 11', 'margaret hamilton', 'priority scheduling', 'interrupt', 'concurrency', 'real time'],
    category: CATEGORIES.INCIDENT,
    title: 'Margaret Hamilton & Apollo 11 Lunar Module Computer Overload Recovery',
    year: '1969',
    personOrEntity: 'Margaret Hamilton (MIT Instrumentation Laboratory / NASA Apollo 11)',
    technicalConcept: 'Priority-Based Asynchronous Scheduling & Graceful Overload Recovery',
    factualSummary: 'Three minutes before Apollo 11 landed on the Moon in July 1969, computer alarms 1201 and 1202 triggered because an erroneous radar setting flooded the Apollo Guidance Computer with interrupts. Margaret Hamilton\'s software team had built an asynchronous executive scheduler with priority job recovery: the computer dropped low-priority radar tasks while preserving critical landing engine throttle calculations, preventing an abort.',
    teachingConnection: 'Demonstrates priority-based task scheduling and graceful degradation under load in mission-critical real-time systems.',
    takeaway: 'Under system overload, prioritize mission-critical tasks and shed non-essential load cleanly.',
    isFictional: false,
    sourceVerification: 'Hamilton, M. H. & Hackler, W. R. (2008) "Universal Systems Language: Lessons from Apollo", IEEE Computer',
    visualLayout: 'Educational timeline diagram: incoming radar task overflow on the left; Hamilton\'s priority queue in the middle dropping low-priority tasks; high-priority landing radar and thruster tasks executing uninterrupted on the right.',
    scoring: { technicalRelevance: 100, educationalValue: 100, accuracyVerifiability: 100, studentEngagement: 95 }
  },
  {
    keywords: ['compiler', 'programming language', 'grace hopper', 'cobol', 'bug', 'high level language', 'machine code'],
    category: CATEGORIES.PERSONALITY,
    title: 'Grace Hopper & the Invention of the Compiler',
    year: '1952',
    personOrEntity: 'Rear Admiral Grace Hopper (US Navy / Remington Rand)',
    technicalConcept: 'Translating Human-Readable Code to Machine Code (Compilers)',
    factualSummary: 'In 1952, Grace Hopper developed the A-0 System—the world\'s first compiler. When she proposed writing programs in English words rather than raw octal and binary machine instructions, peers told her computers could only do arithmetic. Her pioneering work led directly to COBOL and modern programming languages.',
    teachingConnection: 'Demystifies compilers for students: a compiler is simply a specialized program that parses human-readable abstract logic into executable CPU instructions.',
    takeaway: 'Programming languages are tools for human communication and thought, not just for machines.',
    isFictional: false,
    sourceVerification: 'Hopper, G. M. (1952) "The Education of a Computer", ACM Conference Proceedings / Computer History Museum',
    visualLayout: 'Educational compiler flow diagram: on the left, human-readable code; middle, compiler steps (Lexer, Parser, Code Generator); on the right, binary executable machine code. Colorful vector cards with arrows.',
    scoring: { technicalRelevance: 95, educationalValue: 95, accuracyVerifiability: 100, studentEngagement: 85 }
  },
  {
    keywords: ['python', 'guido van rossum', 'readability', 'dynamic typing', 'interpreted', 'programming languages'],
    category: CATEGORIES.PERSONALITY,
    title: 'Guido van Rossum Creating Python for Readability',
    year: '1989-1991',
    personOrEntity: 'Guido van Rossum (CWI Amsterdam)',
    technicalConcept: 'Language Ergonomics, Indentation Syntax & Developer Velocity',
    factualSummary: 'Over Christmas break in 1989, Dutch programmer Guido van Rossum began writing Python as a hobby project to bridge the gap between low-level C and rigid shell scripts. He chose significant indentation to enforce clean readability, famously noting that "code is read much more often than it is written."',
    teachingConnection: 'Helps students understand language design trade-offs: Python sacrifices raw execution speed to maximize developer productivity and readability.',
    takeaway: 'Writing clean, readable code that other developers can understand quickly is often more valuable than premature micro-optimizations.',
    isFictional: false,
    sourceVerification: 'Van Rossum, G. (1993) "An Introduction to Python for UNIX/C Programmers" / PEP 20 "The Zen of Python"',
    visualLayout: 'Educational code comparison diagram: on the left, verbose boilerplate in low-level syntax; on the right, clean concise Python syntax highlighting indentation and readability. Labeled comparative cards.',
    scoring: { technicalRelevance: 95, educationalValue: 90, accuracyVerifiability: 100, studentEngagement: 85 }
  },
  {
    keywords: ['ariane', 'overflow', 'data types', 'integer', 'exception', 'rocket', 'software engineering'],
    category: CATEGORIES.INCIDENT,
    title: 'The Ariane 5 Rocket Failure (64-bit to 16-bit Integer Overflow)',
    year: '1996',
    personOrEntity: 'European Space Agency (ESA) Flight 501',
    technicalConcept: 'Data Type Range Bounds & Unhandled Numeric Overflow',
    factualSummary: 'On June 4, 1996, the Ariane 5 rocket veered off course and self-destructed 37 seconds after launch, destroying a \$370 million payload. An unhandled numeric overflow occurred when a 64-bit floating-point horizontal velocity value was cast into a 16-bit signed integer whose maximum limit was 32,767. The conversion threw an exception that halted both primary and backup computers.',
    teachingConnection: 'Provides the ultimate unforgettable lesson on data types: a computer variable is not an abstract mathematical number, but a finite memory box with strict minimum and maximum boundaries.',
    takeaway: 'Always validate data conversions, check numerical range boundaries, and protect mission-critical code with defensive exception handlers.',
    isFictional: false,
    sourceVerification: 'Lions, J. L., et al. (1996) "Ariane 5 Flight 501 Failure Report by the Inquiry Board", European Space Agency',
    visualLayout: 'Educational diagram of a 64-bit wide register attempting to fit into a 16-bit register with an overflow spill warning. Visual indicator showing max range (+32,767) and how an unhandled overflow triggered an error.',
    scoring: { technicalRelevance: 100, educationalValue: 100, accuracyVerifiability: 100, studentEngagement: 95 }
  },
  {
    keywords: ['knight capital', 'deployment', 'feature flag', 'dead code', 'trading', 'testing', 'devops'],
    category: CATEGORIES.INCIDENT,
    title: 'The Knight Capital \$440 Million Deployment Disaster',
    year: '2012',
    personOrEntity: 'Knight Capital Group (Wall Street)',
    technicalConcept: 'Deployment Integrity, Feature Flags & Dead Code Removal',
    factualSummary: 'On August 1, 2012, Knight Capital deployed new high-frequency trading code to eight servers, but inadvertently missed one server. The old code on that eighth server repurposed an obsolete feature flag, triggering legacy dead code that bought millions of overpriced shares continuously. Within 45 minutes, the company lost \$440 million and was pushed into bankruptcy.',
    teachingConnection: 'Teaches students why automated continuous deployment, configuration consistency, and deleting obsolete dead code are critical engineering principles.',
    takeaway: 'Never leave dormant dead code in production systems, and always automate deployment verification across all server nodes.',
    isFictional: false,
    sourceVerification: 'US Securities and Exchange Commission (SEC) Administrative Proceeding File No. 3-15570 (October 16, 2013)',
    visualLayout: 'Educational deployment pipeline diagram: 8 server boxes, 7 showing updated green code and 1 showing old red code, with arrows showing how inconsistent deployment states create fatal race conditions.',
    scoring: { technicalRelevance: 95, educationalValue: 95, accuracyVerifiability: 100, studentEngagement: 95 }
  },

  // ── DATABASES & DATA STORAGE ──
  {
    keywords: ['database', 'acid', 'transaction', 'consistency', 'concurrency', 'bank', 'double spend'],
    category: CATEGORIES.INCIDENT,
    title: 'Financial Double-Spending & Race Conditions in Unlocked Accounts',
    year: '2014',
    personOrEntity: 'Banking & Cryptocurrency Exchange Concurrency Incidents',
    technicalConcept: 'ACID Transactions, Row-Level Locking & Isolation Levels',
    factualSummary: 'In early 2014, multiple cryptocurrency exchanges and financial systems were exploited when automated withdrawal scripts sent simultaneous concurrent requests. Because account balances were checked before being deducted without row-level database locking (SELECT FOR UPDATE), the systems suffered race conditions allowing attackers to withdraw funds twice.',
    teachingConnection: 'Shows why database ACID guarantees (especially Atomicity and Isolation) and proper database transactions are essential whenever multiple concurrent requests access the same account or state.',
    takeaway: 'Always use atomic transactions and proper database locking to prevent concurrent read-modify-write race conditions.',
    isFictional: false,
    sourceVerification: 'Carvalho, M. (2014) "Transactional Consistency in Distributed Ledgers" / ACM Queue Database Concurrency Best Practices',
    visualLayout: 'Educational concurrency diagram: two simultaneous user threads reading balance = \$100 at time T1, both approving \$100 withdrawals at time T2, resulting in an invalid -\$100 balance. Side-by-side with a locked atomic transaction.',
    scoring: { technicalRelevance: 95, educationalValue: 95, accuracyVerifiability: 95, studentEngagement: 85 }
  },

  // ── ALGORITHMS & DATA STRUCTURES ──
  {
    keywords: ['algorithm', 'donald knuth', 'complexity', 'big o', 'data structures', 'sorting', 'efficiency'],
    category: CATEGORIES.PERSONALITY,
    title: 'Donald Knuth & the Analysis of Algorithms',
    year: '1968-Present',
    personOrEntity: 'Donald Knuth (Stanford University)',
    technicalConcept: 'Asymptotic Analysis & Rigorous Algorithm Complexity (Big-O)',
    factualSummary: 'Donald Knuth revolutionized computing with his multi-volume opus "The Art of Computer Programming", establishing algorithmic analysis as a rigorous scientific discipline. He popularized Big-O notation, created TeX typesetting, and proved how algorithm efficiency dominates hardware speed as data grows.',
    teachingConnection: 'Teaches students that choosing the right algorithm ($O(n \log n)$ vs $O(n^2)$) matters exponentially more than buying a faster processor.',
    takeaway: 'Algorithm efficiency is the fundamental multiplier that determines whether software can scale to millions of users or crash under load.',
    isFictional: false,
    sourceVerification: 'Knuth, D. E. (1968) "The Art of Computer Programming, Vol 1: Fundamental Algorithms" / ACM Turing Award Citation (1974)',
    visualLayout: 'Educational complexity graph: comparing execution curves for O(1), O(log n), O(n), O(n log n), and O(n^2) as input size N grows from 10 to 1,000,000. Clean labeled cards and colorful curve lines.',
    scoring: { technicalRelevance: 95, educationalValue: 95, accuracyVerifiability: 100, studentEngagement: 80 }
  },
  {
    keywords: ['recursion', 'call stack', 'base case', 'nested', 'inception', 'stack overflow'],
    category: CATEGORIES.MOVIE,
    title: 'Inception (Nested Dream Levels as an Analogy for Recursion)',
    year: '2010',
    personOrEntity: 'Film: "Inception" (Director: Christopher Nolan)',
    technicalConcept: 'Recursive Function Calls, Call Stacks & Base Cases',
    factualSummary: 'In the film "Inception", characters enter a dream within a dream, descending through multiple nested levels. Crucially, they can only return to reality by resolving each level in reverse order (Last In, First Out). If they descend too deep without an exit condition, they become trapped in limbo.',
    teachingConnection: 'Provides a vivid, unforgettable mental model for recursion: each nested dream level is a stack frame on the call stack. The "kick" or exit condition is the recursive base case. Without a base case, the function runs forever until it causes a Stack Overflow (limbo).',
    takeaway: 'Every recursive function must have a verified base case and unwind its call stack in reverse order (LIFO).',
    isFictional: true,
    sourceVerification: 'Warner Bros. Pictures (2010) "Inception" - Cited strictly as a conceptual pedagogical analogy.',
    visualLayout: 'Educational comparison diagram: on the left side, labeled cards showing Level 1 -> Level 2 -> Level 3 dream layers; on the right side, the corresponding computer Call Stack frames (main -> factorial(3) -> factorial(2) -> base case). Unwinding arrows showing return values.',
    scoring: { technicalRelevance: 90, educationalValue: 95, accuracyVerifiability: 85, studentEngagement: 95 }
  },

  // ── ARTIFICIAL INTELLIGENCE & ASSISTANTS (POP-CULTURE ANALOGY) ──
  {
    keywords: ['jarvis', 'assistant', 'iron man', 'agent', 'conversational ai', 'context', 'tool calling'],
    category: CATEGORIES.MOVIE,
    title: 'JARVIS from Iron Man (Fictional Analogy for AI Assistants)',
    year: '2008',
    personOrEntity: 'Film: "Iron Man" (Marvel Studios)',
    technicalConcept: 'Conversational Context, Speech Recognition & Multi-Modal Tool Calling',
    factualSummary: 'In the Iron Man films, Tony Stark interacts with JARVIS—a fictional conversational AI that understands natural voice commands, queries CAD databases, runs holographic simulations, and controls robotic equipment.',
    teachingConnection: 'Used as an intuitive analogy to explain how modern AI assistants actually work: combining speech-to-text, large language models for natural language understanding, context memory windows, and function calling (tool use) to trigger external APIs.',
    takeaway: 'Modern AI agents do not possess consciousness; they orchestrate language models with APIs, databases, and structured tool calling.',
    isFictional: true,
    sourceVerification: 'Marvel Studios (2008) "Iron Man" - Cited strictly as a conceptual pedagogical analogy.',
    visualLayout: 'Educational architecture diagram: user voice input -> Speech-to-Text -> LLM reasoning brain -> Function Calling router connecting to Weather API, Code Runner, and Database tools. Clean 16:9 vector cards.',
    scoring: { technicalRelevance: 85, educationalValue: 90, accuracyVerifiability: 85, studentEngagement: 95 }
  },

  // ── NETWORKING & THE INTERNET ──
  {
    keywords: ['internet', 'web', 'tim berners lee', 'http', 'html', 'url', 'networking', 'browser'],
    category: CATEGORIES.PERSONALITY,
    title: 'Tim Berners-Lee & the Invention of the World Wide Web',
    year: '1989',
    personOrEntity: 'Sir Tim Berners-Lee (CERN)',
    technicalConcept: 'Hypertext Transfer Protocol (HTTP), HTML & Uniform Resource Locators (URLs)',
    factualSummary: 'In 1989 at CERN, British scientist Tim Berners-Lee wrote a proposal titled "Information Management: A Proposal". He invented HTML for document formatting, HTTP for network transfer, and URLs for addressing, making the existing internet accessible to all humanity—and intentionally released it royalty-free.',
    teachingConnection: 'Explains the foundational three-pillar architecture of web development: how URLs identify resources, HTTP transports them, and HTML structures their presentation.',
    takeaway: 'Open, royalty-free standards are the engine that enabled the exponential growth of the modern internet.',
    isFictional: false,
    sourceVerification: 'Berners-Lee, T. (1989) "Information Management: A Proposal", CERN / W3C Historical Archive',
    visualLayout: 'Educational diagram showing the 3 pillars of the Web: URL (Address identifier), HTTP (Request/Response client-server transport), and HTML/DOM (Rendered document in browser). Clean vector cards with arrows.',
    scoring: { technicalRelevance: 95, educationalValue: 95, accuracyVerifiability: 100, studentEngagement: 85 }
  },
  {
    keywords: ['bgp', 'routing', 'dns', 'packet', 'internet outage', 'isp', 'router'],
    category: CATEGORIES.INCIDENT,
    title: 'Major Internet Routing Incidents (BGP Route Hijacking)',
    year: '2008 / 2021',
    personOrEntity: 'Global Telecoms & Major Internet Backbones',
    technicalConcept: 'Border Gateway Protocol (BGP) & Autonomous System Routing',
    factualSummary: 'In 2008, an ISP attempting to block YouTube locally accidentally advertised its route to upstream providers via BGP. The incorrect route propagated worldwide within minutes, blackholing global YouTube traffic for hours. Similar BGP misconfigurations in 2021 took Facebook, Instagram, and WhatsApp offline worldwide.',
    teachingConnection: 'Demonstrates how the global internet relies on Border Gateway Protocol (BGP) route announcements between Autonomous Systems (AS), and why cryptographic route origin validation (RPKI) is critical.',
    takeaway: 'Global distributed routing requires cryptographic verification to prevent accidental misconfigurations from cascading across the entire internet.',
    isFictional: false,
    sourceVerification: 'RIPE NCC Technical Analysis of YouTube BGP Hijack / Cloudflare BGP Routing Incident Reports',
    visualLayout: 'Educational networking diagram: Autonomous Systems (AS1, AS2, AS3) exchanging BGP routing tables. Shows an invalid advertisement redirecting traffic into a blackhole, contrasted with RPKI cryptographic verification.',
    scoring: { technicalRelevance: 95, educationalValue: 90, accuracyVerifiability: 95, studentEngagement: 90 }
  }
];

/**
 * Calculates a weighted relevance score out of 100.
 */
function calculateScore(scores = {}) {
  const tr = typeof scores.technicalRelevance === 'number' ? scores.technicalRelevance : 70;
  const ev = typeof scores.educationalValue === 'number' ? scores.educationalValue : 70;
  const av = typeof scores.accuracyVerifiability === 'number' ? scores.accuracyVerifiability : 80;
  const se = typeof scores.studentEngagement === 'number' ? scores.studentEngagement : 75;

  const total = (tr * SCORING_WEIGHTS.technicalRelevance) +
                (ev * SCORING_WEIGHTS.educationalValue) +
                (av * SCORING_WEIGHTS.accuracyVerifiability) +
                (se * SCORING_WEIGHTS.studentEngagement);

  return Math.round(total);
}

/**
 * Finds the best verified real-world connection for a given topic or domain from the knowledge base.
 */
function findBestConnection(topic, subTopic = '', domain = '', preferredCategory = null) {
  if (!topic) return null;

  const cleanQuery = `${topic} ${subTopic} ${domain}`.toLowerCase()
    .replace(/ifstatement/g, 'if statement')
    .replace(/whileloop/g, 'while loop')
    .replace(/forloop/g, 'for loop')
    .replace(/ifelse/g, 'if else');

  const candidates = [];
  let highestScore = 0;

  for (const entry of VERIFIED_KNOWLEDGE_BASE) {
    if (preferredCategory && entry.category !== preferredCategory) {
      continue;
    }

    let matchCount = 0;
    let matchBonus = 0;
    for (const kw of entry.keywords) {
      const escaped = kw.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      const regex = new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, 'i');
      if (regex.test(cleanQuery)) {
        matchCount++;
        // Multi-word phrases or terms >= 6 chars get higher specificity bonus
        matchBonus += (kw.length >= 6 || kw.includes(' ')) ? 12 : 8;
      }
    }

    if (matchCount > 0) {
      const baseScore = calculateScore(entry.scoring);
      let combinedScore = baseScore + matchBonus;

      // Priority for Indian context (Indian cinema analogies, ISRO, UPI, IRCTC, etc.)
      const isIndianContext = entry.isIndian === true || /india|tamil|isro|upi|irctc|aadhaar|ramanujan|vikram|maanaadu|jailer|enthiran|anniyan|digiyatra|sebi|nse|bse|sivaji/i.test(`${entry.title} ${entry.personOrEntity} ${entry.keywords.join(' ')}`);
      if (isIndianContext) {
        combinedScore += 15; // Decisive priority for Indian context references
      }

      if (combinedScore >= MIN_RELEVANCE_THRESHOLD) {
        if (combinedScore > highestScore) {
          highestScore = combinedScore;
        }
        candidates.push({ entry, score: combinedScore });
      }
    }
  }

  if (candidates.length === 0) return null;

  // DYNAMIC SELECTION: Filter top-tier matches (within 10 points of top score) and pick dynamically
  // so every generated video receives fresh, varied references rather than repeating the same one!
  const topTier = candidates.filter(c => c.score >= Math.max(MIN_RELEVANCE_THRESHOLD, highestScore - 10));
  const picked = topTier.length > 0 ? topTier[Math.floor(Math.random() * topTier.length)] : candidates[0];
  const bestMatch = picked.entry;

  return {
    hasConnection: true,
    category: bestMatch.category,
    title: bestMatch.title,
    year: bestMatch.year,
    personOrEntity: bestMatch.personOrEntity,
    relevanceScore: Math.min(100, picked.score),
    technicalConcept: bestMatch.technicalConcept,
    factualSummary: bestMatch.factualSummary,
    teachingConnection: bestMatch.teachingConnection,
    takeaway: bestMatch.takeaway,
    isFictional: bestMatch.isFictional,
    sourceVerification: bestMatch.sourceVerification,
    visualLayout: bestMatch.visualLayout
  };
}

/**
 * Enriches and validates a slide's realWorldConnection.
 * Ensures:
 * 1. Factual accuracy & proper category tags.
 * 2. Relevance threshold >= 75.
 * 3. Deduplication (never repeat the same title across slides).
 * 4. Safe image prompt formatting for visual scenario generation.
 * 5. Explicit distinction for fictional movie references.
 */
function enrichAndValidateSlide(slide, topic, domain, usedReferencesSet, subTopic = '') {
  if (!slide) return slide;

  // Case 1: Slide already has realWorldConnection from Gemini
  if (slide.realWorldConnection && slide.realWorldConnection.hasConnection) {
    const conn = slide.realWorldConnection;

    // Validate category
    const validCategories = [CATEGORIES.INCIDENT, CATEGORIES.PERSONALITY, CATEGORIES.MOVIE];
    if (!validCategories.includes(conn.category)) {
      if (/incident|outage|attack|crash|failure|history|event/i.test(conn.category || '')) {
        conn.category = CATEGORIES.INCIDENT;
      } else if (/person|founder|creator|inventor|scientist|turing|hopper|torvalds/i.test(conn.category || '')) {
        conn.category = CATEGORIES.PERSONALITY;
      } else if (/movie|film|fiction|analogy|pop|jarvis|matrix|inception/i.test(conn.category || '')) {
        conn.category = CATEGORIES.MOVIE;
      } else {
        conn.category = CATEGORIES.INCIDENT;
      }
    }

    // Enforce fictional flag
    conn.isFictional = (conn.category === CATEGORIES.MOVIE) || (conn.isFictional === true);

    // Score calculation
    const score = typeof conn.relevanceScore === 'number' 
      ? conn.relevanceScore 
      : calculateScore({
          technicalRelevance: 85,
          educationalValue: 85,
          accuracyVerifiability: conn.isFictional ? 85 : 95,
          studentEngagement: 90
        });
    conn.relevanceScore = score;

    // Deduplication check
    const refKey = (conn.title || '').trim().toLowerCase();
    if (usedReferencesSet && usedReferencesSet.has(refKey)) {
      // Duplicate reference in the same course: prune it to avoid repetitive narration
      slide.realWorldConnection = { hasConnection: false };
      return slide;
    }

    // Check minimum threshold
    if (score < MIN_RELEVANCE_THRESHOLD) {
      slide.realWorldConnection = { hasConnection: false };
      return slide;
    }

    if (usedReferencesSet && refKey) {
      usedReferencesSet.add(refKey);
    }

    // Clean up required text fields
    conn.title = conn.title || 'Real-World Case Study';
    conn.factualSummary = conn.factualSummary || '';
    conn.teachingConnection = conn.teachingConnection || '';
    conn.takeaway = conn.takeaway || '';

    // If visual is requested or slide is a theory slide, arm realWorldVisual
    // STRICT ISOLATION: concept_explanation slides are Notepad slides and MUST NOT arm realWorldVisual
    if (!slide.isCode && !slide.isDiagram && slide.teachingStage !== 'concept_explanation') {
      if (!slide.realWorldVisual || !slide.realWorldVisual.enabled) {
        slide.realWorldVisual = {
          enabled: true,
          scenario: `${conn.title} (${conn.year || 'Case Study'})`,
          purpose: conn.teachingConnection,
          visualType: conn.category === CATEGORIES.MOVIE ? 'analogy' : 'direct',
          imagePrompt: buildSafeImagePrompt(conn, slide.heading),
          conceptMapping: [
            { realWorldElement: conn.title, concept: conn.technicalConcept || slide.subheading || slide.heading }
          ],
          annotations: []
        };
        slide.realWorldVisualTiming = {
          enabled: true,
          appearAtSecond: 4,
          triggerPhrase: conn.title
        };
      } else if (!slide.realWorldVisual.imagePrompt) {
        slide.realWorldVisual.scenario = `${conn.title} (${conn.year || 'Case Study'})`;
        slide.realWorldVisual.purpose = conn.teachingConnection;
        slide.realWorldVisual.imagePrompt = buildSafeImagePrompt(conn, slide.heading);
      }
    } else if (slide.teachingStage === 'concept_explanation') {
      slide.realWorldVisual = { enabled: false };
      slide.realWorldVisualTiming = { enabled: false, appearAtSecond: 0, triggerPhrase: '' };
    }

    return slide;
  }

  // Case 2: Gemini did not generate a connection, but slide is a dedicated real-world application scene
  const isTargetScene = slide.teachingStage === 'real_world_application' || 
                        slide.teachingStage === 'real_world_annotation' ||
                        slide.sceneType === 'real_world' ||
                        (slide.realWorldVisual && slide.realWorldVisual.enabled);

  if (isTargetScene) {
    const queryContext = `${slide.subheading || ''} ${subTopic}`.trim();
    let candidate = findBestConnection(topic, queryContext, domain, CATEGORIES.INCIDENT);
    if (!candidate) {
      candidate = findBestConnection(topic, queryContext, domain, CATEGORIES.PERSONALITY);
    }

    if (candidate && candidate.relevanceScore >= 80) {
      const refKey = candidate.title.toLowerCase();
      if (!usedReferencesSet || !usedReferencesSet.has(refKey)) {
        if (usedReferencesSet) usedReferencesSet.add(refKey);
        slide.realWorldConnection = candidate;

        // If not code/diagram, initialize realWorldVisual
        if (!slide.isCode && !slide.isDiagram) {
          if (!slide.realWorldVisual || !slide.realWorldVisual.enabled) {
            slide.realWorldVisual = {
              enabled: true,
              scenario: `${candidate.title} (${candidate.year || 'Case Study'})`,
              purpose: candidate.teachingConnection,
              visualType: candidate.category === CATEGORIES.MOVIE ? 'analogy' : 'direct',
              imagePrompt: buildSafeImagePrompt(candidate, slide.heading),
              conceptMapping: [
                { realWorldElement: candidate.title, concept: candidate.technicalConcept || slide.subheading || slide.heading }
              ],
              annotations: []
            };
            slide.realWorldVisualTiming = {
              enabled: true,
              appearAtSecond: 4,
              triggerPhrase: candidate.title
            };
          } else if (!slide.realWorldVisual.imagePrompt) {
            slide.realWorldVisual.scenario = candidate.title;
            slide.realWorldVisual.purpose = candidate.teachingConnection;
            slide.realWorldVisual.imagePrompt = buildSafeImagePrompt(candidate, slide.heading);
          }
        }

        // Weave reference into audio narration: Explain image on screen FIRST, then detail real incident / pioneer
        const titleSnippet = (candidate.title || '').split(/\s+/).slice(0, 2).join(' ').toLowerCase();
        const narrationLower = (slide.narration || '').toLowerCase();
        if (!narrationLower.includes(titleSnippet)) {
          let narrativeAddition = '';
          if (candidate.category === CATEGORIES.PERSONALITY) {
            narrativeAddition = ` Looking closely at the educational visual on screen, we see the architectural structure that underpins this system. In the history of technology, this directly connects to ${candidate.title}. ${candidate.factualSummary} ${candidate.teachingConnection} For developers, the takeaway is vital: ${candidate.takeaway}`;
          } else if (candidate.category === CATEGORIES.INCIDENT) {
            narrativeAddition = ` Looking closely at the architecture diagram on screen, we see the critical components and conditional decision flows that govern this system in production. In real-world engineering, this was powerfully demonstrated during ${candidate.title} in ${candidate.year}. ${candidate.factualSummary} ${candidate.teachingConnection} As software engineers, our core takeaway is: ${candidate.takeaway}`;
          } else {
            narrativeAddition = ` Looking closely at the educational visual on screen, a clear practical case is ${candidate.title}. ${candidate.factualSummary} ${candidate.teachingConnection}`;
          }
          slide.narration = (slide.narration || '').trim() + ' ' + narrativeAddition;
        }
      }
    }
  }

  if (!slide.realWorldConnection) {
    slide.realWorldConnection = { hasConnection: false };
  }

  return slide;
}

/**
 * Guarantees that every generated course contains at least one authentic, verified
 * real-world connection (Incident, Pioneer, or Movie Analogy) even if the LLM output omitted it.
 *
 * If no slide has realWorldConnection.hasConnection === true:
 * 1. Matches the best verified reference from VERIFIED_KNOWLEDGE_BASE using topic, subTopic, and all slide headings.
 * 2. Selects the most appropriate slide (preferring a theory/concept explanation slide over code/diagram).
 * 3. Populates realWorldConnection.
 * 4. Arms realWorldVisual (with buildSafeImagePrompt) if the slide is not code and not a whiteboard diagram.
 * 5. Weaves the reference into the slide's narration naturally if not already present.
 */
function ensureCourseConnection(slides, topic, subTopic = '', domain = '') {
  if (!Array.isArray(slides) || slides.length === 0) return slides;

  const usedTitles = new Set();
  for (const s of slides) {
    if (s.realWorldConnection && s.realWorldConnection.title) {
      usedTitles.add(s.realWorldConnection.title.toLowerCase());
    }
  }

  // Aggregate subheadings from slides to maximize query matching context
  const allSubheadings = slides.map(s => s.subheading || '').filter(Boolean).join(' ');
  const combinedContext = `${subTopic} ${allSubheadings}`.trim();

  // ── TIER 1: ENRICH CONCEPT EXPLANATION SLIDES (SLIDE 2 / concept_explanation) WITH INDIAN MOVIE ANALOGY (AUDIO ONLY) ──
  // Process all concept_explanation scenes across the course (5m, 15m, 30m, 40m, 60m)
  const conceptSlides = slides.filter(s => s.teachingStage === 'concept_explanation' && !s.isCode && !s.isDiagram && !s.board);
  for (const cSlide of conceptSlides) {
    // Strictly isolate: Slide 2 is a Notepad concept explanation, NOT a real-world visual
    if (cSlide.realWorldVisual) {
      cSlide.realWorldVisual = { enabled: false };
      cSlide.realWorldVisualTiming = { enabled: false, appearAtSecond: 0, triggerPhrase: '' };
    }

    const narrationLower = (cSlide.narration || '').toLowerCase();
    const hasMovieInNarration = /movie|film|cinema|vikram|maanaadu|jailer|anniyan|enthiran|24|sivaji|baahubali|idiots/i.test(narrationLower);
    if (!hasMovieInNarration) {
      let movieCandidate = findBestConnection(topic, cSlide.subheading, domain, CATEGORIES.MOVIE);
      if (!movieCandidate || (usedTitles.has(movieCandidate.title.toLowerCase()) && usedTitles.size < 5)) {
        const alt = findBestConnection(topic, `${cSlide.subheading || ''} ${combinedContext}`.trim(), domain, CATEGORIES.MOVIE);
        if (alt && !usedTitles.has(alt.title.toLowerCase())) {
          movieCandidate = alt;
        }
      }

      if (movieCandidate && movieCandidate.category === CATEGORIES.MOVIE) {
        usedTitles.add(movieCandidate.title.toLowerCase());
        // Concept is explained FIRST; Movie analogy is presented SECOND
        cSlide.narration = (cSlide.narration || '').trim() + 
          ` Now, to make this logic unforgettable with a relatable cinema analogy, consider the film ${movieCandidate.title}. In the movie, ${movieCandidate.factualSummary} In programming, this mirrors our concept directly: ${movieCandidate.teachingConnection}`;
      }
    }

    // Clean Notepad bullets: Notepad bullets MUST remain clean technical syntax (NO movie references)
    if (Array.isArray(cSlide.bullets)) {
      cSlide.bullets = cSlide.bullets.filter(b => !/movie|film|cinema|vikram|maanaadu|jailer|anniyan|enthiran|24|sivaji|actor|director/i.test(b));
    }
  }

  // ── TIER 2: ENRICH REAL-WORLD APPLICATION SLIDES (SLIDE 5 / real_world_application) WITH INCIDENT / PIONEER & IMAGE ──
  let rwSlides = slides.filter(s => (s.teachingStage === 'real_world_application' || s.teachingStage === 'real_world_annotation' || s.sceneType === 'real_world') && !s.isCode && !s.isDiagram && !s.board && s.teachingStage !== 'concept_explanation');

  // If no dedicated real-world slide was found in the syllabus, find an eligible slide
  if (rwSlides.length === 0) {
    const candidateIdx = slides.findIndex((s, idx) => idx > 1 && idx < slides.length - 1 && !s.isCode && !s.isDiagram && !s.board && s.teachingStage !== 'concept_explanation');
    if (candidateIdx !== -1) {
      rwSlides = [slides[candidateIdx]];
    } else if (slides.length > 0) {
      rwSlides = [slides[0]];
    }
  }

  for (const rSlide of rwSlides) {
    let candidate = null;
    if (rSlide.realWorldConnection && rSlide.realWorldConnection.hasConnection && rSlide.realWorldConnection.category !== CATEGORIES.MOVIE) {
      candidate = rSlide.realWorldConnection;
    } else {
      const specificQuery = `${rSlide.subheading || ''} ${subTopic}`.trim();
      candidate = findBestConnection(topic, specificQuery, domain, CATEGORIES.INCIDENT);
      if (!candidate || usedTitles.has(candidate.title.toLowerCase())) {
        candidate = findBestConnection(topic, `${specificQuery} ${combinedContext}`.trim(), domain, CATEGORIES.INCIDENT);
      }
      if (!candidate || usedTitles.has(candidate.title.toLowerCase())) {
        const alt = findBestConnection(topic, specificQuery, domain, CATEGORIES.PERSONALITY) ||
                    findBestConnection(topic, `${specificQuery} ${combinedContext}`.trim(), domain, CATEGORIES.PERSONALITY);
        if (alt && !usedTitles.has(alt.title.toLowerCase())) {
          candidate = alt;
        }
      }
      if (candidate && !usedTitles.has(candidate.title.toLowerCase())) {
        usedTitles.add(candidate.title.toLowerCase());
        rSlide.realWorldConnection = candidate;
      } else {
        candidate = null;
      }
    }

    if (candidate) {
      // Arm realWorldVisual with educational system diagram
      rSlide.realWorldVisual = {
        enabled: true,
        scenario: `${candidate.title} (${candidate.year || 'Case Study'})`,
        purpose: candidate.teachingConnection,
        visualType: candidate.category === CATEGORIES.PERSONALITY ? 'process' : 'direct',
        imagePrompt: buildSafeImagePrompt(candidate, rSlide.heading),
        conceptMapping: [
          { realWorldElement: candidate.title, concept: candidate.technicalConcept || rSlide.subheading || rSlide.heading }
        ],
        annotations: []
      };
      rSlide.realWorldVisualTiming = {
        enabled: true,
        appearAtSecond: 4,
        triggerPhrase: candidate.title
      };

      // Spoken Narration: Explain image on screen FIRST, then detail real incident / pioneer SECOND
      const titleSnippet = (candidate.title || '').split(/\s+/).slice(0, 2).join(' ').toLowerCase();
      const personSnippet = (candidate.personOrEntity || '').split(/\s+/).slice(0, 2).join(' ').toLowerCase();
      const narrationLower = (rSlide.narration || '').toLowerCase();

      if (!narrationLower.includes(titleSnippet) && !narrationLower.includes(personSnippet)) {
        let narrativeAddition = '';
        if (candidate.category === CATEGORIES.PERSONALITY) {
          narrativeAddition = `Looking closely at the educational visual on screen, we see how this connects to ${candidate.title}. ${candidate.factualSummary} ${candidate.teachingConnection} For developers, the takeaway is vital: ${candidate.takeaway}`;
        } else {
          narrativeAddition = `Looking closely at the architecture diagram on screen, we see how this works in a real-world system: ${candidate.title}. ${candidate.factualSummary} ${candidate.teachingConnection} For students and developers, our core takeaway is: ${candidate.takeaway}`;
        }

        // If original narration talked about an unrelated incident (e.g. Chandrayaan when image is DigiYatra), ensure narration remains 100% cohesive with the on-screen diagram!
        const hasUnrelatedIncident = /chandrayaan|isro|netflix|wannacry|apollo|ariane|crowdstrike|alphago/i.test(narrationLower) && !new RegExp(titleSnippet, 'i').test(narrationLower);
        if (hasUnrelatedIncident) {
          rSlide.narration = `Now, let's see how conditional logic is used in real systems. ` + narrativeAddition;
        } else {
          rSlide.narration = (rSlide.narration || '').trim() + ' ' + narrativeAddition;
        }
      }

      // Notepad Bullets: Ensure clean architectural takeaways, NOT narrative story prose
      if (Array.isArray(rSlide.bullets)) {
        rSlide.bullets = rSlide.bullets.filter(b => !/movie|film|cinema|actor|director/i.test(b));
        if (rSlide.bullets.length === 0 && candidate.takeaway) {
          rSlide.bullets = [
            `Production Architecture: ${candidate.technicalConcept || 'Defensive Verification'}`,
            `Key Takeaway: ${candidate.takeaway}`
          ];
        }
      }
    }
  }

  return slides;
}

/**
 * Builds an original, educational, copyright-safe image prompt for Gemini 3.1 Flash Image.
 * Strictly adheres to guidelines:
 * - NEVER generate photorealistic faces of living actors or copyrighted characters.
 * - Flat, clean vector diagram/infographic with labeled cards, arrows, and milestone badges.
 * - White background, 16:9 layout.
 */
function buildSafeImagePrompt(connection, mainTopic = 'Educational Concept') {
  const title = connection.title || 'Case Study';
  const concept = connection.technicalConcept || mainTopic;
  const layout = connection.visualLayout || 'Clean educational system diagram with labeled vector cards and bold connecting arrows.';

  if (connection.category === CATEGORIES.INCIDENT) {
    return `Educational system diagram illustrating the real-world case study "${title}" explaining ${concept}. ${layout} Flat colorful vector illustration, labeled rectangular cards with clear technical text, arrows showing system flow and failure points. Clean modern educational presentation, white background, 16:9 layout. No photorealistic violence, no news headlines, no logos.`;
  }

  if (connection.category === CATEGORIES.PERSONALITY) {
    return `Educational history and technology milestone diagram explaining the contribution of "${title}" to ${concept}. ${layout} Flat vector timeline cards, milestone icons, clear text labels, and structural architectural arrows. Clean modern educational infographic, white background, 16:9 layout. No photorealistic human faces.`;
  }

  // Movie / Pop-culture analogy
  return `Conceptual educational diagram illustrating ${concept} inspired by the analogy of "${title}". ${layout} Use original conceptual vector illustrations of smart interfaces, memory stacks, and digital agents. Clear labeled cards and arrows. Clean modern educational layout, white background, 16:9 aspect ratio. Strictly original conceptual artwork, no copyrighted characters, no actors, no trademarked movie logos.`;
}

/**
 * Returns the comprehensive prompt instructions to inject into teachingEngine.service.js.
 */
function getPromptInstructions() {
  return `
================================================================================
INTELLIGENT REAL-WORLD CONNECTION ENGINE (INDIAN INCIDENTS, PIONEERS & MOVIES)
================================================================================
To make lessons deeply relatable, captivating, and unforgettable for students:
PRIORITIZE INDIA-RELATED REAL-WORLD INCIDENTS, FAMOUS PERSONALITIES, AND INDIAN MOVIE REFERENCES!
If using foreign references, they MUST ONLY be globally iconic legends of computing (Dennis Ritchie, Alan Turing, Linus Torvalds, Grace Hopper) or massive global historical events (WannaCry, Ariane 5). DO NOT use obscure foreign movies or unfamiliar foreign references.

For each scene, evaluate whether an authoritative connection exists in any of the 3 supported categories:

CATEGORY A: REAL-WORLD INCIDENTS (High-Stakes Production Events & Indian Tech Scale)
- What happened? When (verified year)? Who was involved? What technical concept failed or saved it? Why should students care?
- Key Examples:
  * Databases & ACID Transactions: UPI / NPCI Real-Time Distributed Payment Architecture → 14B+ monthly transactions, 2-phase commits across banks without double-spending.
  * Concurrency & Race Conditions: IRCTC Tatkal 10:00 AM Booking Rush → Millions of concurrent threads competing for seats, requiring row-level database locking and Redis queues.
  * Fault Tolerance & Exception Handling: ISRO Chandrayaan-3 Autonomous Descent → Failure-based software architecture with autonomous safe-mode recovery when sensors fail.
  * Scalability & Hash Indexing: Aadhaar (UIDAI) Biometric Engine → 1:N biometric deduplication across 1.4 billion residents using distributed hashing and spatial indexing.
  * Global Incidents (Iconic only): WannaCry Ransomware (unpatched ports), Ariane 5 (integer overflow), CrowdStrike (Ring 0 vs Ring 3).
- STRICT RULE: NEVER invent incidents, fake dates, statistics, or company statements!

CATEGORY B: FAMOUS PERSONALITIES & PIONEERS (The Human Story)
- Who is this person? What was their breakthrough? Why did they invent it? What can students learn?
- Key Examples:
  * Indian Mathematics & Algorithms: Srinivasa Ramanujan → Modular arithmetic and fast infinite series powering modern cryptography.
  * C Programming Foundations: Dennis Ritchie (Creating C & Unix at Bell Labs in 1972 with structured control flow).
  * Computing Foundations: Alan Turing (Universal Turing Machine & Enigma).
  * Operating Systems: Linus Torvalds (Linux monolithic kernel & Git).
  * Compilers: Grace Hopper (Inventing the first compiler and COBOL).
- STRICT RULE: Meaningful educational connection only. Never drop names just because they are famous.

CATEGORY C: INDIAN MOVIE REFERENCES & CINEMA ANALOGIES (Relatable Conceptual Anchors)
- Use popular Indian cinema analogies (especially Tamil cinema, South Indian & Bollywood blockbusters) to make abstract coding concepts click instantly!
- Key Canonical Examples:
  * Loops & Iteration (for / while / do-while): Film "Maanaadu" (2021)
    → Time Loop Analogy: Abdul Khaliq is trapped in a time loop where the exact same day repeats continuously until he finds the exit/break condition. Exactly like a while loop: without an updated state or valid break condition, you are stuck in an infinite loop!
  * If-Else & Conditional Branching: Film "Vikram Vedha" (2017)
    → Moral Dilemma Riddle Analogy: Vedha corners Vikram with a high-stakes riddle where Vikram has two clear options: Option 1 is shoot the innocent brother to catch the villain, or Option 2 is let the villain escape to save the brother. If condition is to save the brother, execute Option 2; else, execute Option 1. Both options are mutually exclusive and can never execute simultaneously!
  * Functions & Modular Reusability: Film "Jailer" (2023)
    → Pre-configured Snipers Analogy: Tiger Muthuvel Pandian (Rajinikanth) doesn't shoot the villains himself on the spot. Instead, he sets up a reusable sniper system beforehand with defined target coordinates (function definition with parameters). When villains confront him, he simply places a call—invoking the function with arguments!
  * Recursion & Divide-and-Conquer: Film "Enthiran / Robot" (2010)
    → Chitti Self-Assembly Analogy: Clones assembling recursively into self-similar structures (sphere, serpent, titan) until a base condition is satisfied.
- STRICT RULES FOR MOVIE REFERENCES:
  * CONCRETE STORYTELLING DIRECTIVE (FOR ALL MOVIES):
    - NEVER use vague or generic abstractions like 'Action A vs Action B', 'two paths', or 'one truth'!
    - Explicitly state the exact character, physical situation, and the TWO CONCRETE CHOICES, then map each choice 1:1 to code execution!
  * Clearly distinguish fiction from reality ("In the movie Vikram Vedha, Vedha presents a moral riddle... Similarly in programming, an if-else statement...").
  * Do not claim fictional movie events actually happened.
  * Do not quote copyrighted dialogue word-for-word.

RELEVANCE SCORING & PLACEMENT RULES:
1. MANDATORY TWO-TIER PEDAGOGICAL PLACEMENT (APPLIES TO ALL VIDEO DURATIONS: 5m, 15m, 30m, 40m, 60m):
   - TIER 1 (Concept Explanation Scenes / Slide 2):
     * Narration Step 1 (FIRST): Thoroughly explain the concept in depth: inner mechanics, syntax structure, indentation/blocks, and evaluation logic.
     * Narration Step 2 (THEN): Smoothly introduce an Indian cinema analogy (e.g. Vikram Vedha for if-else, Maanaadu for loops, Jailer for functions, Anniyan for validation rules). State the movie title, the concrete scene dilemma, and the two exact physical choices!
     * Notepad Bullets: Strictly clean technical syntax, rules, and logic! NEVER write movie stories on Notepad (AUDIO ONLY!).
     * Visual: Notepad callout card (realWorldVisual.enabled = false).
   - TIER 2 (Real-World Application Scenes / Slide 5):
     * Visual: Set realWorldVisual.enabled = true with an educational system/architecture diagram.
     * CRITICAL AUDIENCE RULE (SIMPLE & RELATABLE FOR SCHOOL & COLLEGE STUDENTS):
       - Explain the real-world application in simple, friendly everyday English that a 10th-grade school or 1st-year college student can easily understand in 10 seconds!
       - ABSOLUTELY NO dense aerospace, telemetry, or complex academic jargon! Avoid words like 'telemetry', 'attitude thruster anomalies', 'compound boolean heuristics', or 'state space evaluation'.
       - Keep it intuitive and relatable (e.g., airport smart gates opening if face matches ticket, stock market pausing if prices drop 10%, payment apps sending money if balance is sufficient).
       - FOCUS ON ONLY ONE SCENARIO PER SLIDE: The narration MUST match the visual diagram on screen exactly. NEVER talk about two different incidents in the same slide (e.g. do NOT talk about Chandrayaan-3 if the diagram shows DigiYatra)!
     * Narration Step 1 (FIRST): Thoroughly describe and explain the educational visual on screen in simple, clear terms (components, input triggers, flow, states).
     * Narration Step 2 (THEN): Detail an authentic real-world incident or Indian/Tamil famous pioneer (e.g. DigiYatra, UPI switch, IRCTC Tatkal, ISRO safe mode, NSE/BSE 10% circuit breakers, Ramanujan, or Dennis Ritchie for C), explaining what happened and the simple software takeaway.
     * Notepad Bullets: Strictly clean architectural principles and engineering takeaways! NEVER write narrative incident prose on Notepad (AUDIO ONLY!).
2. CRITICAL DIVERSITY DIRECTIVE — DYNAMIC VARIETY ACROSS VIDEOS:
   - DO NOT repeat the exact same reference for every video! Keep your teaching fresh, dynamic, and varied across generations.
   - For example, for if-else / conditionals, do NOT always use Vikram Vedha: you can use Anniyan (Garuda Purana strict rule validation), Indian Stock Market (NSE/BSE) 10% circuit breaker trading halt, DigiYatra airport biometric access gate, or Dennis Ritchie's structured control flow at Bell Labs.
   - For loops, draw from Maanaadu (time loop), 24 (watch time manipulation), or ISRO telemetry polling loops.
   - For functions, draw from Jailer (pre-configured snipers), Sivaji The Boss (delegated modular teams), etc.
   - Feel free to draw dynamically from across Indian cinema, space missions, banking architectures, and engineering milestones!
3. Relevance Scoring: Technical Relevance (40%) + Educational Value (30%) + Accuracy (20%) + Engagement (10%).
   - References must score >= 75.
4. Natural Teacher Narration:
   - Talk like a friendly Indian technical instructor explaining something exciting to students.
   - Weave the reference directly into the spoken narration of that scene!
   - Connect it directly back to the code or concept being learned!
5. Structured Output Format in each Scene Object:
   "realWorldConnection": {
     "hasConnection": true | false,
     "category": "real_world_incident" | "famous_personality" | "movie_reference",
     "title": "Short descriptive title (e.g. 'Vikram Vedha (The Moral Dilemma as If-Else Branching)' or 'UPI Real-Time Distributed Payment Switch')",
     "year": "YYYY (e.g. '2017')",
     "personOrEntity": "Person, company, or film name",
     "relevanceScore": 85,
     "technicalConcept": "Technical concept explained",
     "factualSummary": "Concise verified explanation",
     "teachingConnection": "How it directly explains this lesson",
     "takeaway": "Key engineering takeaway",
     "isFictional": false | true,
     "sourceVerification": "Official report, historical publication, or film citation"
   }
`.trim();
}

module.exports = {
  CATEGORIES,
  SCORING_WEIGHTS,
  MIN_RELEVANCE_THRESHOLD,
  VERIFIED_KNOWLEDGE_BASE,
  calculateScore,
  findBestConnection,
  enrichAndValidateSlide,
  ensureCourseConnection,
  buildSafeImagePrompt,
  getPromptInstructions
};
