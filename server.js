import "dotenv/config";

import express from "express";
import multer from "multer";
import ffmpegPath from "ffmpeg-static";
import { GoogleAuth } from "google-auth-library";
import { spawn } from "node:child_process";
import {
  mkdir,
  readFile,
  mkdtemp,
  rm,
  writeFile
} from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import os from "node:os";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();

const PORT = Number(process.env.PORT || 3000);
const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT;
const LOCATION = "global";
const MODEL = "gemini-3.8-flash-tts";

// Set STYLE_IN_TEXT=true in .env if speechMetadata.style seems to be ignored.
// The style sentence is then placed at the start of the text instead.
const STYLE_IN_TEXT = process.env.STYLE_IN_TEXT === "true";

// Set USE_EMOTION_TAGS=true in .env to also put a short emotion tag such as
// [warmly] at the start of each paragraph. Only enable this if your model
// follows bracket tags; if it reads them aloud, leave it off.
const USE_EMOTION_TAGS = process.env.USE_EMOTION_TAGS === "true";

const PUBLIC_DIR = path.join(__dirname, "public");
const GENERATED_DIR = path.join(PUBLIC_DIR, "generated");

if (!PROJECT_ID || PROJECT_ID === "YOUR_ACTUAL_PROJECT_ID") {
  throw new Error("Set GOOGLE_CLOUD_PROJECT in your .env file.");
}

if (!ffmpegPath) {
  throw new Error("FFmpeg is unavailable. Check ffmpeg-static installation.");
}

app.use(express.json({ limit: "1mb" }));

app.use((req, res, next) => {
  console.log(`[HTTP] ${req.method} ${req.url}`);
  res.on("finish", () => {
    console.log(`[HTTP] ${req.method} ${req.url} -> ${res.statusCode}`);
  });
  next();
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024,
    files: 2
  }
});

const auth = new GoogleAuth({
  scopes: ["https://www.googleapis.com/auth/cloud-platform"]
});

async function googleFetch(url, options = {}) {
  const client = await auth.getClient();
  const token = await client.getAccessToken();

  if (!token?.token) {
    throw new Error(
      "Google Cloud authentication failed. Run gcloud auth application-default login."
    );
  }

  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token.token}`,
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });

  const raw = await response.text();
  let data;

  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    data = { raw };
  }

  if (!response.ok) {
    console.error("Google API error:", JSON.stringify(data, null, 2));
    throw new Error(
      data?.error?.message ||
      data?.message ||
      `Google API request failed: HTTP ${response.status}`
    );
  }

  return data;
}

// ==========================================
// LANGUAGE DETECTION
// ==========================================
// The client can send { language: "hindi" } or { language: "tamil" }.
// If it does not, the language is detected from the script:
//   Devanagari letters -> Hindi
//   Tamil letters      -> Tamil
// Everything else keeps the normal (English) behaviour.

function detectLanguage(requested, text) {
  const lang = String(requested || "").trim().toLowerCase();
  if (lang === "hindi" || lang === "hi") return "hindi";
  if (lang === "tamil" || lang === "ta") return "tamil";
  if (lang) return lang;
  if (/[\u0900-\u097F]/.test(text)) return "hindi";
  if (/[\u0B80-\u0BFF]/.test(text)) return "tamil";
  return "english";
}

// ==========================================
// EMOTION PRESETS
// ==========================================
// Each preset describes HOW the voice should feel. The client can send
// { emotion: "excited", intensity: "high" } in /api/generate-speech.
// "tag" is only used when USE_EMOTION_TAGS=true.

const EMOTION_PRESETS = {
  warm: {
    description:
      "Warm, friendly and genuinely engaged, with a gentle smile in the voice. " +
      "Sound like you enjoy explaining this and care that the listener understands.",
    tag: "[warmly]"
  },
  confident: {
    description:
      "Confident, bold and commanding. Strong, firm voice with full authority, " +
      "like an experienced teacher who knows the subject completely.",
    tag: "[confidently]"
  },
  excited: {
    description:
      "Energetic, enthusiastic and upbeat, with bright rising intonation. " +
      "Sound thrilled to share this, like discovering something cool together.",
    tag: "[excited]"
  },
  encouraging: {
    description:
      "Supportive, positive and reassuring, like a teacher cheering a student on. " +
      "Lift the voice on praise and sound proud and kind.",
    tag: "[encouraging]"
  },
  calm: {
    description:
      "Calm, soothing and gentle, with soft, slow-flowing intonation. " +
      "Relaxed and patient, but still alive and expressive, never flat.",
    tag: "[calmly]"
  },
  serious: {
    description:
      "Serious, focused and emphatic. Lower, steady tone with firm stress on " +
      "important words, as when warning about a common mistake.",
    tag: "[seriously]"
  },
  storytelling: {
    description:
      "Expressive storyteller. Change pace and pitch with the drama of each moment, " +
      "build curiosity, slow down for suspense and lighten up for fun parts.",
    tag: "[dramatic]"
  },
  sad: {
    description:
      "Soft, heavy and sorrowful. Lower pitch, slower pace, slight breathiness, " +
      "with a feeling of holding back emotion.",
    tag: "[sadly]"
  },
  playful: {
    description:
      "Light, playful and amused, with a teasing smile in the voice and quick, " +
      "bouncy rhythm. A little humour in the delivery.",
    tag: "[playfully]"
  }
};

const INTENSITY_TEXT = {
  low: "Keep the emotion subtle and natural.",
  medium: "Show the emotion clearly in the voice.",
  high: "Make the emotion very strong and clearly audible, with big changes in pitch, volume and pace."
};

// ---------- HINDI ONLY: confident, bold, Bihari-style teacher ----------
function buildHindiStyleInstruction(emotionKey, intensityKey) {
  const emotion = EMOTION_PRESETS[emotionKey] || EMOTION_PRESETS.confident;
  const intensity = INTENSITY_TEXT[intensityKey] || INTENSITY_TEXT.high;

  return [
    "Speak as a confident, bold and authoritative teacher explaining a lesson in natural spoken Hindi mixed with common English technical words, the way teachers from Bihar speak.",
    "Use a natural Bihari-accented Hindi with the rhythm and intonation of the Bihar region. Keep it natural, not exaggerated and not a caricature. Do not use a South Indian accent.",
    "Keep the cloned speaker's own voice and timbre.",
    `Emotion: ${emotion.description}`,
    intensity,
    "Speak with full confidence and strong projection, like an experienced teacher who knows the subject completely. Never sound shy, hesitant, uncertain or like a beginner.",
    "Use a firm, steady, powerful voice. Deliver statements as facts, ending sentences with a strong, settled, falling tone instead of a tentative rising tone.",
    "Put heavy stress on key words and important points. Use short, punchy phrasing with a brisk, decisive pace.",
    "Do not add filler sounds such as umm, hmm or ah, and do not trail off at the end of sentences.",
    "Pause only briefly for emphasis, then continue boldly.",
    "Speak only the supplied text. Do not read out any instructions or bracketed tags."
  ].join(" ");
}

// ---------- TAMIL ONLY: clear, expressive teacher, NO filler sounds ----------
function buildTamilStyleInstruction(emotionKey, intensityKey) {
  const emotion = EMOTION_PRESETS[emotionKey] || EMOTION_PRESETS.warm;
  const intensity = INTENSITY_TEXT[intensityKey] || INTENSITY_TEXT.medium;

  return [
    "Speak as a friendly, clear teacher explaining a lesson in natural spoken Tamil, mixed with common English technical words where needed.",
    "Use natural Tamil pronunciation and intonation. Keep it natural, not exaggerated. Keep the cloned speaker's own voice and timbre.",
    `Emotion: ${emotion.description}`,
    intensity,
    "Use a clear, expressive voice with natural pitch variation. Stress the important words in each sentence.",
    "Do NOT add any filler or hesitation sounds such as umm, hmm, mmm, ah or aaa. Do not trail off at the end of sentences.",
    "Speak fluently and smoothly, with only short natural pauses between ideas.",
    "Speak only the supplied text. Do not read out any instructions or bracketed tags."
  ].join(" ");
}

function buildStyleInstruction(deliveryStyle, emotionKey, intensityKey, language) {
  // Hindi gets its own confident Bihari-style prompt.
  if (language === "hindi") {
    return buildHindiStyleInstruction(emotionKey, intensityKey);
  }

  // Tamil gets its own prompt with no filler sounds.
  if (language === "tamil") {
    return buildTamilStyleInstruction(emotionKey, intensityKey);
  }

  // Everything below is unchanged for English and all other languages.
  const emotion = EMOTION_PRESETS[emotionKey] || EMOTION_PRESETS.warm;
  const intensity = INTENSITY_TEXT[intensityKey] || INTENSITY_TEXT.medium;

  if (deliveryStyle !== "teacher") {
    return [
      "Speak naturally and conversationally, like a real person talking, not reading.",
      emotion.description,
      intensity,
      "Speak only the supplied text."
    ].join(" ");
  }

  return [
    "Speak as a friendly computer science teacher from Chennai explaining a lesson to beginners in an online class.",
    "Natural South Indian English accent, not exaggerated. Keep the cloned speaker's own voice and timbre.",
    `Emotion: ${emotion.description}`,
    intensity,
    "Do NOT sound like someone reading a book or an announcer. Sound like a real person talking live to students.",
    "Use a wide, expressive pitch range. Raise the pitch and energy on key words, important terms and good news.",
    "Stress the important word in each sentence. Let the voice rise on questions and fall softly at the end of statements.",
    "React emotionally to the content: sound curious at questions, pleased at good results, careful at warnings, amused at funny examples.",
    "Vary speed naturally: slightly faster on easy parts, slower on definitions and important points.",
    "Pause briefly between ideas and wait a moment after questions.",
    "Read hesitation sounds such as umm, hmm and ah softly and naturally, as a quick thought, not as emphasized words.",
    "Speak only the supplied text. Do not read out any instructions or bracketed tags."
  ].join(" ");
}

// ==========================================
// AUDIO CONVERSION
// ==========================================

async function runFfmpeg(args, description) {
  await new Promise((resolve, reject) => {
    const child = spawn(ffmpegPath, args, {
      stdio: ["ignore", "ignore", "pipe"]
    });

    const errors = [];
    child.stderr.on("data", chunk => errors.push(chunk));
    child.on("error", reject);

    child.on("close", code => {
      if (code !== 0) {
        reject(new Error(
          `${description}: ${Buffer.concat(errors).toString("utf8")}`
        ));
      } else {
        resolve();
      }
    });
  });
}

async function convertToRequiredWav(inputBuffer) {
  const tempDir = await mkdtemp(
    path.join(os.tmpdir(), "voice-replication-")
  );

  const inputPath = path.join(tempDir, "input.audio");
  const outputPath = path.join(tempDir, "output.wav");

  try {
    await writeFile(inputPath, inputBuffer);

    await runFfmpeg([
      "-hide_banner", "-loglevel", "error", "-y",
      "-i", inputPath,
      "-vn", "-ac", "1", "-ar", "24000",
      "-c:a", "pcm_s16le", "-f", "wav", outputPath
    ], "Input audio conversion failed");

    const wav = await readFile(outputPath);

    if (
      wav.length < 44 ||
      wav.toString("ascii", 0, 4) !== "RIFF" ||
      wav.toString("ascii", 8, 12) !== "WAVE"
    ) {
      throw new Error("FFmpeg did not produce a valid WAV file.");
    }

    return wav;
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

// Converts Gemini's WAV output to MP3 and optionally adjusts speed.
// atempo changes speed WITHOUT changing pitch, so the voice identity is kept.
// Heavy slowing makes speech sound flat, so the default is close to 1.
async function convertWavToMp3(inputBuffer, tempo = 0.96) {
  const tempDir = await mkdtemp(
    path.join(os.tmpdir(), "voice-replication-mp3-")
  );

  const inputPath = path.join(tempDir, "input.wav");
  const outputPath = path.join(tempDir, "output.mp3");

  const t = Math.min(1.1, Math.max(0.85, tempo));

  // Light cleanup + loudness normalisation only. No EQ that would alter timbre.
  const filters = [
    `atempo=${t}`,
    "highpass=f=70",
    "loudnorm=I=-18:TP=-1.5:LRA=14"
  ].join(",");

  try {
    await writeFile(inputPath, inputBuffer);

    await runFfmpeg([
      "-hide_banner", "-loglevel", "error", "-y",
      "-i", inputPath,
      "-vn",
      "-af", filters,
      "-codec:a", "libmp3lame",
      "-b:a", "128k",
      "-ar", "24000",
      "-ac", "1",
      outputPath
    ], "MP3 conversion failed");

    const mp3 = await readFile(outputPath);

    if (mp3.length < 128) {
      throw new Error("The converted MP3 is empty or invalid.");
    }

    return mp3;
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

async function readAudioUpload(file, fieldName) {
  if (!file) {
    throw new Error(`Please upload the ${fieldName} recording.`);
  }

  const wav = await convertToRequiredWav(file.buffer);

  const sampleRate = wav.readUInt32LE(24);
  const channels = wav.readUInt16LE(22);
  const bitsPerSample = wav.readUInt16LE(34);

  console.log(`[${fieldName}]`, {
    sampleRate,
    channels,
    bitsPerSample,
    bytes: wav.length
  });

  if (sampleRate !== 24000 || channels !== 1 || bitsPerSample !== 16) {
    throw new Error(
      `${fieldName} audio must be mono, 24 kHz, 16-bit PCM WAV.`
    );
  }

  return {
    mimeType: "audio/wav",
    data: wav.toString("base64")
  };
}

// ==========================================
// SCRIPT HUMANIZER (fillers, pauses) - ENGLISH ONLY
// ==========================================

function hashSeed(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function seededRandom(seed) {
  let s = seed || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function humanizeScript(text) {
  // If the author already wrote fillers, leave the script alone.
  if (/\b(umm+|hmm+|ah+)\b/i.test(text)) return text;

  const rand = seededRandom(hashSeed(text)); // same text -> same result
  const paragraphs = text.split(/\n{2,}/);

  const thinking = ["Umm...", "Hmm...", "Ah,", "Umm,", "Hmm,"];
  const connectors = ["Okay, so", "So,", "Now see,", "Okay,", "Now,"];
  const transitionStart =
    /^(so|now|let's|let us|suppose|imagine|for example|for instance|next|here|see|look)\b/i;

  let lastFiller = null;
  let sinceLast = 99;
  let fillerCount = 0;

  const pick = (list) => {
    let choice;
    let tries = 0;
    do {
      choice = list[Math.floor(rand() * list.length)];
      tries++;
    } while (choice === lastFiller && tries < 6);
    lastFiller = choice;
    return choice;
  };

  const processed = paragraphs.map((para, pIndex) => {
    const sentences =
      para.match(/[^.!?]+[.!?]+["')\]]*|\S[^.!?]*$/g) || [para];
    const maxInPara = Math.max(1, Math.ceil(sentences.length / 4));
    let usedInPara = 0;

    const out = sentences.map((raw, i) => {
      let s = raw.trim();
      if (!s) return s;

      const words = s.split(/\s+/).length;
      sinceLast++;

      // Give students a beat after a question.
      if (/\?["')\]]*$/.test(s)) {
        s = s.replace(/\?(["')\]]*)$/, "?$1 ...");
      }

      const isFirstEver = pIndex === 0 && i === 0;
      const canInsert =
        !isFirstEver &&
        sinceLast >= 3 &&
        usedInPara < maxInPara &&
        fillerCount < 12;

      const isTransition = transitionStart.test(s);
      const isLong = words > 16;

      if (canInsert && (isTransition || isLong) && rand() < 0.65) {
        const filler = isTransition
          ? pick(thinking)
          : pick([...thinking, ...connectors]);

        // Lowercase the first letter unless it is "I" or an acronym.
        const lowered = /^(I\b|[A-Z]{2,})/.test(s)
          ? s
          : s[0].toLowerCase() + s.slice(1);

        s = `${filler} ${isTransition ? s : lowered}`;
        sinceLast = 0;
        usedInPara++;
        fillerCount++;
      }

      return s;
    });

    return out.join(" ");
  });

  // Longer pause between paragraphs.
  return processed.join(" ...\n\n");
}

// Optional: put an emotion tag at the start of each paragraph.
// Skips paragraphs where the author already wrote a [tag].
function addEmotionTags(text, emotionKey) {
  const preset = EMOTION_PRESETS[emotionKey] || EMOTION_PRESETS.warm;

  return text
    .split(/\n{2,}/)
    .map(p => {
      const trimmed = p.trim();
      if (!trimmed) return trimmed;
      if (/^\[[^\]]+\]/.test(trimmed)) return trimmed;
      return `${preset.tag} ${trimmed}`;
    })
    .join("\n\n");
}

// ==========================================
// HEALTH CHECK
// ==========================================

app.get("/api/health", (_req, res) => {
  res.json({
    success: true,
    message: "Voice Replication server is running",
    model: MODEL,
    location: LOCATION,
    emotions: Object.keys(EMOTION_PRESETS),
    intensities: Object.keys(INTENSITY_TEXT)
  });
});

// ==========================================
// CREATE AND STORE REPLICATED VOICE
// ==========================================
// TIP: the emotion of your REFERENCE recording matters a lot. Record the
// reference with real expression (smiling, varied pitch), not flat reading.

app.post(
  "/api/create-voice",
  upload.fields([
    { name: "referenceAudio", maxCount: 1 },
    { name: "consentAudio", maxCount: 1 }
  ]),
  async (req, res) => {
    try {
      const referenceFile = req.files?.referenceAudio?.[0];
      const consentFile = req.files?.consentAudio?.[0];

      const displayName = String(
        req.body.displayName || "My Replicated Voice"
      ).trim().slice(0, 100);

      if (!referenceFile || !consentFile) {
        return res.status(400).json({
          success: false,
          error: "Upload both the reference recording and consent recording."
        });
      }

      const [sourceAudio, consentAudio] = await Promise.all([
        readAudioUpload(referenceFile, "reference"),
        readAudioUpload(consentFile, "consent")
      ]);

      const url =
        "https://aiplatform.googleapis.com/v1beta1/projects/" +
        `${encodeURIComponent(PROJECT_ID)}/locations/${LOCATION}/voices`;

      const result = await googleFetch(url, {
        method: "POST",
        body: JSON.stringify({
          store: true,
          voice: {
            type: "VOICE_TYPE_REPLICATED",
            displayName,
            replicated: {
              sourceAudio,
              consentAudio
            }
          }
        })
      });

      const voiceId = result.id;

      if (
        typeof voiceId !== "string" ||
        !voiceId.startsWith("voice_")
      ) {
        console.error("Unexpected voice response:", result);
        throw new Error("Google did not return a valid stored Voice ID.");
      }

      console.log("Voice created successfully:", voiceId);

      return res.json({
        success: true,
        voiceId,
        message: "Voice replication completed successfully."
      });
    } catch (error) {
      console.error("Create voice error:", error);

      return res.status(500).json({
        success: false,
        error: error.message || "Voice creation failed."
      });
    }
  }
);

// ==========================================
// GENERATE SPEECH AND SAVE AS MP3
// ==========================================
// Request body (all optional except text and voiceId):
// {
//   text, voiceId,
//   language: "hindi" | "tamil" | "english" | ...
//             (Hindi and Tamil are auto-detected from their scripts)
//   deliveryStyle: "teacher" | "natural",
//   emotion: "warm" | "confident" | "excited" | "encouraging" | "calm" |
//            "serious" | "storytelling" | "sad" | "playful",
//   intensity: "low" | "medium" | "high",
//   humanize: true | false,
//   tempo: 0.85 - 1.1
// }
//
// HINDI defaults: emotion "confident", intensity "high", humanizer OFF,
// tempo 1.0.
// TAMIL defaults: emotion "warm", intensity "medium", humanizer OFF
// (no umm / hmm / mmm fillers), tempo 1.0.
// Other languages keep their previous defaults.

app.post("/api/generate-speech", async (req, res) => {
  try {
    const text = String(req.body?.text || "").trim();
    const voiceId = String(req.body?.voiceId || "").trim();

    const deliveryStyle = String(
      req.body?.deliveryStyle || "teacher"
    ).trim().toLowerCase();

    const language = detectLanguage(req.body?.language, text);
    const isHindi = language === "hindi";
    const isTamil = language === "tamil";

    const emotion = String(
      req.body?.emotion || (isHindi ? "confident" : "warm")
    ).trim().toLowerCase();

    const intensity = String(
      req.body?.intensity || (isHindi ? "high" : "medium")
    ).trim().toLowerCase();

    if (!text) {
      return res.status(400).json({
        success: false,
        error: "Enter the text you want the voice to speak."
      });
    }

    if (!/^voice_[A-Za-z0-9_-]+$/.test(voiceId)) {
      return res.status(400).json({
        success: false,
        error: "Enter a valid Voice ID beginning with voice_."
      });
    }

    if (text.length > 4000) {
      return res.status(400).json({
        success: false,
        error: "Keep the text under 4,000 characters."
      });
    }

    const url =
      "https://aiplatform.googleapis.com/v1/projects/" +
      `${encodeURIComponent(PROJECT_ID)}/locations/${LOCATION}/publishers/google/models/` +
      `${MODEL}:generateContent`;

    // The humanizer inserts English fillers (Umm, Hmm...), so it is always
    // OFF for Hindi and Tamil. For other languages it follows the "humanize" flag.
    const useHumanizer =
      !isHindi && !isTamil && req.body?.humanize !== false;

    let spokenText = useHumanizer ? humanizeScript(text) : text;

    if (USE_EMOTION_TAGS) {
      spokenText = addEmotionTags(spokenText, emotion);
    }

    // Hindi and Tamil: normal speed (1.0). Others: slightly slower.
    const requestedTempo = Number(req.body?.tempo);
    const defaultTempo = isHindi || isTamil ? 1.0 : 0.96;
    const tempo = requestedTempo > 0 ? requestedTempo : defaultTempo;

    const styleInstruction = buildStyleInstruction(
      deliveryStyle,
      emotion,
      intensity,
      language
    );

    const part = STYLE_IN_TEXT
      ? { text: `${styleInstruction}\n\n${spokenText}` }
      : { text: spokenText, speechMetadata: { style: styleInstruction } };

    console.log(
      "Language:", language,
      "| Emotion:", emotion,
      "| Intensity:", intensity,
      "| Humanizer:", useHumanizer
    );
    console.log("Spoken text sent to TTS:\n", spokenText);

    const result = await googleFetch(url, {
      method: "POST",
      body: JSON.stringify({
        contents: [{
          role: "user",
          parts: [part]
        }],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              voice: voiceId
            }
          }
        }
      })
    });

    const parts = result.candidates?.[0]?.content?.parts || [];
    const audioPart = parts.find(p => p.inlineData?.data);

    if (!audioPart) {
      console.error("No audio returned by Google:", JSON.stringify(result));
      throw new Error(
        "The model returned no audio. Check model access and the API response."
      );
    }

    const audioBuffer = Buffer.from(audioPart.inlineData.data, "base64");

    if (
      audioBuffer.length < 44 ||
      audioBuffer.toString("ascii", 0, 4) !== "RIFF" ||
      audioBuffer.toString("ascii", 8, 12) !== "WAVE"
    ) {
      console.error("Unexpected audio format:", {
        bytes: audioBuffer.length,
        mimeType: audioPart.inlineData.mimeType
      });

      throw new Error(
        "Google did not return WAV audio. Check the response audio format."
      );
    }

    await mkdir(GENERATED_DIR, { recursive: true });

    const mp3Buffer = await convertWavToMp3(audioBuffer, tempo);
    const filename = `${randomUUID()}.mp3`;
    const filepath = path.join(GENERATED_DIR, filename);

    await writeFile(filepath, mp3Buffer);

    console.log("MP3 audio saved:", filepath, {
      bytes: mp3Buffer.length,
      tempo
    });

    return res.json({
      success: true,
      audioUrl: `/generated/${filename}`,
      audioType: "audio/mpeg",
      filename,
      language,
      emotion,
      intensity,
      message: "Speech generated successfully as MP3."
    });
  } catch (error) {
    console.error("Generate speech error:", error);

    return res.status(500).json({
      success: false,
      error: error.message || "Speech generation failed."
    });
  }
});

// ==========================================
// ERROR HANDLER
// ==========================================

app.use((error, _req, res, next) => {
  if (res.headersSent) return next(error);

  if (error instanceof multer.MulterError) {
    return res.status(400).json({
      success: false,
      error: error.code === "LIMIT_FILE_SIZE"
        ? "Each audio upload must be 20 MB or smaller."
        : error.message
    });
  }

  console.error("Unexpected server error:", error);

  return res.status(500).json({
    success: false,
    error: error.message || "Unexpected server error."
  });
});

// ==========================================
// STATIC FRONTEND AND GENERATED AUDIO
// ==========================================

app.use(express.static(PUBLIC_DIR));

// ==========================================
// START SERVER
// ==========================================

app.listen(PORT, () => {
  console.log(`Voice Replication app: http://localhost:${PORT}`);
  console.log(`Project: ${PROJECT_ID}`);
  console.log(`Model: ${MODEL}`);
  console.log(`Location: ${LOCATION}`);
});