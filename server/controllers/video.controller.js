const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const audioService = require('../services/audio.service');
const ffmpegService = require('../services/ffmpeg.service');
const subtitleService = require('../services/subtitle.service');
const { GoogleGenAI } = require('@google/genai');
const teachingEngine = require('../services/teachingEngine.service');
const storageService = require('../services/storage.service');

// Store background jobs
const jobs = new Map();
let currentRenderJob = null;

const getCurrentRenderJob = () => currentRenderJob;
const setCurrentRenderJob = (job) => { currentRenderJob = job; };

// Robust JSON extraction and cleaning utility
const cleanJsonString = (str) => {
  if (!str) return '';

  const arrayMatch = str.match(/\[\s*\{[\s\S]*\}\s*\]/);
  if (arrayMatch) {
    str = arrayMatch[0];
  } else {
    const objectMatch = str.match(/\{[\s\S]*\}/);
    if (objectMatch) {
      str = objectMatch[0];
    }
  }

  str = str.replace(/^```json\s*/gi, '').replace(/\s*```$/gi, '');
  str = str.replace(/\\(?!["\\/bfnrt]|u[0-9a-fA-F]{4})/g, '\\\\');

  return str.trim();
};

const generateVideo = async (req, res) => {
  try {
    const { text, format, languages, voiceId } = req.body;
    const backgroundPath = req.file ? req.file.path : null;
    let selectedLanguages = null;
    if (languages) {
      try {
        selectedLanguages = JSON.parse(languages);
      } catch(e) {
        console.error('Failed to parse languages from request');
      }
    }

    if (!text) {
      return res.status(400).json({ success: false, message: 'Text is required' });
    }

    const uniqueId = uuidv4();
    currentRenderJob = { id: uniqueId };

    const requestPayload = {
      text,
      format,
      voiceId,
      selectedLanguages
    };

    // Save job state to storage with queued status and request payload
    await storageService.saveJob(uniqueId, {
      id: uniqueId,
      status: 'queued',
      progress: 0,
      message: 'Video generation request queued...',
      requestPayload
    });

    // Trigger Cloud Run Job via starter service
    const cloudRunJobService = require('../services/cloudRunJob.service');
    try {
      await cloudRunJobService.triggerVideoJob(uniqueId);
    } catch (jobError) {
      console.error(`[VideoController] Failed to trigger Cloud Run Job for ${uniqueId}:`, jobError.message);
      await storageService.saveJob(uniqueId, { status: 'failed', error: jobError.message });
      return res.status(500).json({ success: false, message: 'Failed to start video generation job', error: jobError.message });
    }

    // Respond immediately with job ID (preserving existing API contract)
    res.status(202).json({ success: true, processing: true, jobId: uniqueId });
  } catch (error) {
    console.error('Video generation init error:', error);
    res.status(500).json({ success: false, message: 'Failed to start video generation', error: error.message });
  }
};

const getJobStatus = async (req, res) => {
  try {
    const { jobId } = req.params;
    const job = await storageService.getJob(jobId);

    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found or expired' });
    }

    res.json({ success: true, ...job });
  } catch (err) {
    console.error(`Error retrieving job status for ${req.params.jobId}:`, err);
    res.status(500).json({ success: false, message: 'Failed to retrieve job status', error: err.message });
  }
};

const generateScript = async (req, res) => {
  try {
    const { topic, subTopic, durationMinutes = 5 } = req.body;
    if (!topic) {
      return res.status(400).json({ success: false, message: 'Topic is required' });
    }

    const scriptResult = await teachingEngine.generateTeachingScript({
      topic,
      subTopic,
      durationMinutes
    });

    res.json({ success: true, data: scriptResult });
  } catch (error) {
    console.error('Script generation error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate teaching script', error: error.message });
  }
};

const generateAwsScript = async (req, res) => {
  try {
    const { topic, subTopic, durationMinutes = 5 } = req.body;
    if (!topic) {
      return res.status(400).json({ success: false, message: 'AWS Service / Topic is required' });
    }

    const targetMins = parseInt(durationMinutes, 10) || 5;
    const targetWords = targetMins * 140;

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    const clientConfig = {};
    if (apiKey && apiKey.trim()) {
      clientConfig.apiKey = apiKey.trim();
    } else {
      clientConfig.vertexai = true;
      clientConfig.project = process.env.GOOGLE_CLOUD_PROJECT || 'sky-meet-01';
      clientConfig.location = process.env.GOOGLE_CLOUD_LOCATION || 'asia-south1';
    }
    const client = new GoogleGenAI(clientConfig);

    const prompt = `
Imagine you are an experienced AWS instructor creating an automated screen-recording tutorial.

Your task is to generate a complete AWS Console automation script for: "${topic}".
Specific focus / task: "${subTopic || 'Basic Setup / Overview'}".

TARGET LESSON DURATION: ${targetMins} MINUTES (~${targetWords} words total narration).

Requirements:
- Provide a clear, step-by-step demonstration in the AWS Management Console.
- Your output must be a single JSON object.
- DO NOT INCLUDE ANY MARKDOWN formatting outside the JSON block.

**RECORDING OPTIMIZATION CRITERIA (CRITICAL):**
Your JSON will be executed by a Puppeteer-based recording engine. Optimize the recording for professional screen-capture quality:
1. Every navigation must wait for: networkidle, fonts loaded, images loaded, no loading spinner, and stable DOM for 500ms.
2. Before every click: highlight target first, then click.
3. Produce cinematic tutorial pacing suitable for YouTube.
4. **CRITICAL FLOW RULE:** ALWAYS start by navigating to the AWS Console Home (\`https://console.aws.amazon.com/console/home\`). NEVER jump directly to a service URL. Use the \`search\` action to type the service name, then \`click\` the service from dropdown results.

**SCROLL ACTION RULES (CRITICAL — strictly enforced, violations break the recording):**
5. A scroll action has EXACTLY two fields: "direction" and "distance". There is NO "value", "target" or "duration" field on a scroll action. This is INVALID and will break execution:
   { "action": "scroll", "value": "down" }
   This is the ONLY valid format:
   { "action": "scroll", "direction": "down", "distance": 300 }
6. "direction" must be the literal string "up" or "down". "distance" must be an integer number of pixels (typically 250–500), estimated based on how far the target element likely is from the current viewport.
7. NEVER emit two or more scroll actions back-to-back to reach the same target. Combine them into ONE scroll action with a larger "distance" instead.
8. Only insert a scroll action when the next target is very likely off-screen.
9. NEVER scroll to, or place the cursor near, the very top of the viewport (roughly y < 60px).
10. Do not immediately follow a scroll with another action targeting an element near the top of the viewport (y < 60px).
11. Do not chain unrelated \`highlight\`/\`click\` pairs back-to-back without a navigation or wait action in between.

**CRITICAL ELEMENT TARGETING RULES — VIOLATION = SCRIPT FAILURE:**
- The \`target.label\` MUST always be the **visible text label on the UI element itself**.
- **NEVER output a \`target\` with an empty or blank \`label\` field.**
- NEVER use a value you are about to type as a \`target.label\`.
- NEVER use a dynamic value unless that exact text is visibly rendered.
- After creating a resource, use \`waitForNetworkIdle\` first, then \`click\` the resource by its exact name.
- For the global search bar, use action \`search\` with just a \`value\` field.

**TARGET DISAMBIGUATION — \`target.context\`:**
- Every \`target\` object MUST include a \`context\` string field describing WHERE on the page the element is located.

The JSON MUST follow this exact structure:
{
  "type": "aws",
  "service": "${topic}",
  "title": "AWS Tutorial: ${topic} - ${subTopic || 'Overview'}",
  "narration": "Write the full spoken teaching script here, approximately ${targetWords} words.",
  "steps": [
    { "action": "goto", "url": "https://console.aws.amazon.com/console/home" },
    { "action": "waitForNetworkIdle" },
    { "action": "search", "value": "${topic}" },
    { "action": "waitForNetworkIdle" },
    { "action": "click", "target": { "label": "Amazon ${topic}", "type": "link", "context": "search results dropdown item, not the breadcrumb" } }
  ]
}
`;

    const jsonSchema = {
      type: 'object',
      properties: {
        type: { type: 'string' },
        service: { type: 'string' },
        title: { type: 'string' },
        narration: { type: 'string' },
        steps: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              action: { type: 'string' },
              url: { type: 'string' },
              value: { type: 'string' },
              duration: { type: 'integer' },
              target: {
                type: 'object',
                properties: {
                  label: { type: 'string' },
                  type: { type: 'string' },
                  context: { type: 'string' }
                },
                required: ['label', 'context']
              }
            },
            required: ['action']
          }
        }
      },
      required: ['type', 'service', 'title', 'narration', 'steps']
    };

    let result;
    let attempts = 0;
    const maxAttempts = 3;
    let delay = 15000;

    while (attempts < maxAttempts) {
      try {
        result = await client.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            responseSchema: jsonSchema
          }
        });
        if (result.usageMetadata) {
          console.log(`[Token Usage] Provider: vertex-ai, Model: gemini-2.5-flash, Input Tokens: ${result.usageMetadata.promptTokenCount}, Output Tokens: ${result.usageMetadata.candidatesTokenCount}, Total Tokens: ${result.usageMetadata.totalTokenCount}, Timestamp: ${new Date().toISOString()}`);
        }
        break;
      } catch (err) {
        attempts++;
        if (attempts >= maxAttempts) throw err;

        console.warn(`[AWS Script Gen] Attempt ${attempts} failed: ${err.message}. Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 1.5;
      }
    }

    let text = result.text;
    const cleanedText = cleanJsonString(text);
    res.status(200).json({ success: true, text: cleanedText });
  } catch (error) {
    console.error('AWS script generation error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate AWS script', error: error.message });
  }
};

const regenerateLanguageVideo = async (req, res) => {
  try {
    const { id, lang } = req.params;
    const outputDir = path.join(__dirname, '../output');
    const metadataPath = path.join(outputDir, `${id}_metadata.json`);
    const gcsMetadataObject = `videos/${id}/metadata.json`;

    // Retrieve metadata from local filesystem or GCS
    if (!fs.existsSync(metadataPath)) {
      if (storageService.isStorageConfigured()) {
        const exists = await storageService.fileExists(gcsMetadataObject);
        if (exists) {
          console.log(`[Storage] Metadata not found locally, downloading from gs://${process.env.GCS_BUCKET_NAME}/${gcsMetadataObject}...`);
          await storageService.downloadFile(gcsMetadataObject, metadataPath);
        }
      }
    }

    if (!fs.existsSync(metadataPath)) {
      return res.status(404).json({ success: false, message: 'Metadata not found for this video' });
    }

    const SUPPORTED_LANGUAGES = require('../config/languages');
    const langConfig = SUPPORTED_LANGUAGES[lang];
    if (!langConfig) {
      return res.status(400).json({ success: false, message: 'Unsupported language code' });
    }

    const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
    const { englishDurations, languages, voiceId: savedVoiceId } = metadata;
    const originalSlides = metadata.slides;
    const langSlides = languages && languages[lang] && languages[lang].slides 
                       ? languages[lang].slides 
                       : originalSlides;

    // Ensure real-world scenario images are downloaded locally for Puppeteer rendering
    const imagesDir = path.join(outputDir, 'images');
    for (let i = 0; i < langSlides.length; i++) {
      const slide = langSlides[i];
      if (slide.realWorldVisual && slide.realWorldVisual.enabled) {
        const imageFileName = `${id}_scene_${i}_scenario.jpg`;
        const localImgPath = slide.imagePath || path.join(imagesDir, imageFileName);
        slide.imagePath = localImgPath;
        if (!fs.existsSync(localImgPath) && storageService.isStorageConfigured()) {
          const gcsImgObject = slide.imageObject || `videos/${id}/images/${imageFileName}`;
          try {
            if (await storageService.fileExists(gcsImgObject)) {
              console.log(`[Storage] Downloading scenario image gs://${process.env.GCS_BUCKET_NAME}/${gcsImgObject} for Puppeteer...`);
              await storageService.downloadFile(gcsImgObject, localImgPath);
            }
          } catch (imgErr) {
            console.warn(`[Storage] Warning: Failed to download scenario image ${gcsImgObject}: ${imgErr.message}`);
          }
        }
      }
    }

    const translationService = require('../services/translation.service');
    const audioService = require('../services/audio.service');
    const ffmpegService = require('../services/ffmpeg.service');
    
    const audioDir = path.join(outputDir, 'audio');
    const videoDir = path.join(outputDir, 'video');
    if (!fs.existsSync(audioDir)) fs.mkdirSync(audioDir, { recursive: true });
    if (!fs.existsSync(videoDir)) fs.mkdirSync(videoDir, { recursive: true });

    // 1. Re-render silent video using localized slides
    console.log(`Re-rendering localized silent video for ${id} in ${lang}...`);
    const screenVideoPath = path.join(outputDir, `${id}_screen_regen_${lang}.mp4`);
    const rendererFactory = require('../renderer/rendererFactory');
    const type = (langSlides.length > 0 && langSlides[0].type) ? langSlides[0].type : 'programming';
    const renderer = rendererFactory.getRenderer(type);
    await renderer.renderVideo(langSlides, englishDurations, screenVideoPath);

    // 2. Generate target language audio using localized slides
    const masterLangAudioPath = path.join(audioDir, `${id}_${langConfig.fileName}`);
    const langChunks = [];

    const candidateVoiceId = (req.body && req.body.voiceId !== undefined) ? req.body.voiceId : savedVoiceId;
    const isCustomVoice = candidateVoiceId && typeof candidateVoiceId === 'string' && candidateVoiceId.trim() !== '' && candidateVoiceId !== 'default-computer' && candidateVoiceId !== 'default';
    const resolvedVoiceId = isCustomVoice ? candidateVoiceId.trim() : null;

    for (let i = 0; i < langSlides.length; i++) {
      const translatedNarration = await translationService.translateText(originalSlides[i].narration || ' ', langConfig.name);
      const rawChunkPath = path.join(outputDir, `${id}_rawchunk_${i}_${lang}.mp3`);
      await audioService.generateAudio(translatedNarration, rawChunkPath, langConfig.code, resolvedVoiceId);
      
      const adjustedChunkPath = path.join(outputDir, `${id}_chunk_${i}_${lang}.mp3`);
      await audioService.adjustAudioDuration(rawChunkPath, adjustedChunkPath, englishDurations[i]);
      langChunks.push(adjustedChunkPath);
      if (fs.existsSync(rawChunkPath)) fs.unlink(rawChunkPath, () => {});
    }

    await audioService.mergeAudioFiles(langChunks, masterLangAudioPath);
    
    // 3. Merge localized audio and video
    const langVideoFileName = `${id}_${langConfig.code}.mp4`;
    const langVideoPath = path.join(videoDir, langVideoFileName);
    
    console.log(`Merging regenerated video for ${lang}...`);
    await ffmpegService.mergeVideoAndAudio(screenVideoPath, masterLangAudioPath, langVideoPath);

    let finalLangUrl = `/output/video/${langVideoFileName}`;
    let finalLangObject = `videos/${id}/languages/${langConfig.code}.mp4`;

    if (storageService.isStorageConfigured()) {
      console.log(`[Storage] Uploading regenerated ${langConfig.name} video to GCS...`);
      const uploadRes = await storageService.uploadFile(langVideoPath, finalLangObject);
      if (uploadRes) {
        finalLangUrl = uploadRes.url;
        finalLangObject = uploadRes.objectName;
      }

      // Update metadata and re-upload to GCS
      if (!metadata.languages) metadata.languages = {};
      metadata.languages[lang] = {
        url: finalLangUrl,
        objectName: finalLangObject,
        language: langConfig.name,
        code: langConfig.code,
        slides: langSlides
      };

      fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
      await storageService.uploadFile(metadataPath, gcsMetadataObject);
    }

    // Cleanup temporary local files
    langChunks.forEach(p => { if (fs.existsSync(p)) fs.unlink(p, () => {}); });
    if (fs.existsSync(screenVideoPath)) fs.unlink(screenVideoPath, () => {});
    if (fs.existsSync(masterLangAudioPath)) fs.unlink(masterLangAudioPath, () => {});

    if (storageService.isStorageConfigured()) {
      if (fs.existsSync(langVideoPath)) fs.unlink(langVideoPath, () => {});
      if (fs.existsSync(metadataPath)) fs.unlink(metadataPath, () => {});
    }

    res.status(200).json({
      success: true,
      message: `${langConfig.name} video regenerated successfully`,
      data: {
        url: finalLangUrl,
        objectName: finalLangObject
      }
    });

  } catch (error) {
    console.error(`Regenerate video error for ${req.params.lang}:`, error);
    res.status(500).json({ success: false, message: 'Failed to regenerate language video', error: error.message });
  }
};

module.exports = {
  generateVideo,
  generateScript,
  generateAwsScript,
  regenerateLanguageVideo,
  getJobStatus,
  getCurrentRenderJob,
  setCurrentRenderJob
};