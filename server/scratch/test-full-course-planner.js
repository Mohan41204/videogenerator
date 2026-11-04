const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '..', '.env') });
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

const { GoogleGenAI } = require('@google/genai');

function parseUserSubtopics(subTopicRaw) {
  if (!subTopicRaw || typeof subTopicRaw !== 'string' || subTopicRaw.trim() === '') {
    return [];
  }

  let candidates = [];
  if (subTopicRaw.includes('\n')) {
    candidates = subTopicRaw.split('\n');
  } else if (/\s{2,}/.test(subTopicRaw)) {
    candidates = subTopicRaw.split(/\s{2,}/);
  } else if (subTopicRaw.includes(';')) {
    candidates = subTopicRaw.split(';');
  } else if (subTopicRaw.includes(' | ')) {
    candidates = subTopicRaw.split(' | ');
  } else if (/\d+\.\s+/.test(subTopicRaw)) {
    candidates = subTopicRaw.split(/\d+\.\s+/);
  } else if (subTopicRaw.includes(',')) {
    candidates = subTopicRaw.split(',');
  } else {
    candidates = [subTopicRaw];
  }

  return candidates
    .map(s => s.trim().replace(/^[\d+.*\-•\s]+/, '').trim())
    .filter(s => s.length > 2);
}

function createBatchSyllabus(topic, userSubtopics, totalSceneCount, avgWordsPerScene) {
  const syllabus = [];
  
  syllabus.push({
    sceneIndex: 1,
    subheading: userSubtopics.length > 0 ? userSubtopics[0] : `${topic} Foundations`,
    teachingStage: 'introduction',
    sceneType: 'hook',
    targetWords: avgWordsPerScene
  });

  const intermediateCount = totalSceneCount - 2;
  const pool = userSubtopics.length > 1 ? userSubtopics.slice(1) : userSubtopics;
  
  for (let i = 0; i < intermediateCount; i++) {
    const sceneNum = i + 2;
    let subTitle = '';
    if (pool.length > 0) {
      if (i < pool.length) {
        subTitle = pool[i];
      } else {
        const baseSub = pool[i % pool.length];
        subTitle = `${baseSub} - Deep Dive`;
      }
    } else {
      subTitle = `Module ${i + 1}: Key Principles & Architecture`;
    }

    let stage = 'concept_explanation';
    let type = 'concept';
    if (i % 3 === 1) {
      stage = 'technical_visual';
      type = 'diagram';
    } else if (i % 3 === 2) {
      stage = 'example';
      type = 'example';
    }

    syllabus.push({
      sceneIndex: sceneNum,
      subheading: subTitle,
      teachingStage: stage,
      sceneType: type,
      targetWords: avgWordsPerScene
    });
  }

  syllabus.push({
    sceneIndex: totalSceneCount,
    subheading: `${topic} - Final Summary & Key Takeaways`,
    teachingStage: 'recap',
    sceneType: 'summary',
    targetWords: avgWordsPerScene
  });

  return syllabus;
}

async function testFull() {
  const rawSubtopics = "Introduction to Data Analytics   What are the Tools Used in Data Analytics?   Dealing with Different Types of Data   Data Visualization for Decision Making   Overview of Data Science and Machine Learning   Application of Data Analytics in different sectors   Data Mining and Data Profiling   Data Wrangling   Sampling Techniques in Data Analytics   Analytics Framework in and Latest Trends";
  
  const parsed = parseUserSubtopics(rawSubtopics);
  console.log(`Parsed ${parsed.length} user subtopics`);

  const totalScenes = 20;
  const avgWords = 280;
  const syllabus = createBatchSyllabus("Data Analytics", parsed, totalScenes, avgWords);

  console.log(`Generated full syllabus for ${syllabus.length} scenes:`);
  syllabus.forEach(s => {
    console.log(`  [Scene ${s.sceneIndex}] ${s.subheading} (${s.teachingStage})`);
  });

  // Verify chunking into batches of 5
  const BATCH_SIZE = 5;
  const batches = [];
  for (let i = 0; i < syllabus.length; i += BATCH_SIZE) {
    batches.push(syllabus.slice(i, i + BATCH_SIZE));
  }
  console.log(`\nSplit into ${batches.length} batches of max ${BATCH_SIZE} scenes each.`);
  batches.forEach((b, idx) => {
    console.log(` Batch ${idx+1}: Scenes ${b[0].sceneIndex} to ${b[b.length-1].sceneIndex} (${b.length} scenes)`);
  });
}

testFull();