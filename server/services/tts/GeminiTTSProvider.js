const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
const { GoogleAuth } = require('google-auth-library');
const TTSProvider = require('./TTSProvider');
const ffmpegPath = require('../../utils/ffmpegPath');

// Style and Emotion Definitions (from root server.js)
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

function detectLanguage(requested, text) {
  const lang = String(requested || "").trim().toLowerCase();
  if (lang === "hindi" || lang === "hi") return "hindi";
  if (lang === "tamil" || lang === "ta") return "tamil";
  if (lang === "telugu" || lang === "te") return "telugu";
  if (lang === "kannada" || lang === "kn") return "kannada";
  if (lang === "malayalam" || lang === "ml") return "malayalam";
  if (lang) return lang;
  if (/[\u0900-\u097F]/.test(text)) return "hindi";
  if (/[\u0B80-\u0BFF]/.test(text)) return "tamil";
  if (/[\u0C00-\u0C7F]/.test(text)) return "telugu";
  if (/[\u0C80-\u0CFF]/.test(text)) return "kannada";
  if (/[\u0D00-\u0D7F]/.test(text)) return "malayalam";
  return "english";
}

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

function buildTamilStyleInstruction(emotionKey, intensityKey) {
  const emotion = EMOTION_PRESETS[emotionKey] || EMOTION_PRESETS.warm;
  const intensity = INTENSITY_TEXT[intensityKey] || INTENSITY_TEXT.medium;

  return [
    "Speak as a friendly online-class teacher explaining a lesson naturally in conversational Chennai Tamil, mixed with common English technical words.",
    "Pronounce English technical terms naturally and clearly as used by Indian software developers.",
    "Maintain the selected speaker's original voice identity, tone, and timbre.",
    `Emotion: ${emotion.description}`,
    intensity,
    "Use a clear, expressive voice with natural Chennai Tamil intonation and sentence flow. Stress key concepts smoothly.",
    "Do NOT add any filler or hesitation sounds such as umm, hmm, mmm, ah, or aaa. Do not trail off at the end of sentences and do not invent additional sentences.",
    "Speak fluently and smoothly, with only short natural pauses between ideas.",
    "Speak only the supplied text faithfully. Do not read out any instructions or bracketed tags."
  ].join(" ");
}

function buildStyleInstruction(deliveryStyle, emotionKey, intensityKey, language) {
  if (language === "hindi") {
    return buildHindiStyleInstruction(emotionKey, intensityKey);
  }
  if (language === "tamil") {
    return buildTamilStyleInstruction(emotionKey, intensityKey);
  }

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
  if (/\b(umm+|hmm+|ah+)\b/i.test(text)) return text;

  const rand = seededRandom(hashSeed(text));
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

  return processed.join(" ...\n\n");
}

function runFfmpeg(args, description) {
  return new Promise((resolve, reject) => {
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

class GeminiTTSProvider extends TTSProvider {
  constructor() {
    super();
    this.projectId = process.env.GOOGLE_CLOUD_PROJECT || "sky-meet-01";
    this.location = process.env.GEMINI_TTS_LOCATION || "global";
    this.model = process.env.GEMINI_TTS_MODEL || "gemini-3.8-flash-tts";
    this.auth = new GoogleAuth({
      scopes: ["https://www.googleapis.com/auth/cloud-platform"]
    });
  }

  async googleFetch(url, options = {}) {
    const client = await this.auth.getClient();
    const token = await client.getAccessToken();

    if (!token?.token) {
      throw new Error(
        "Google Cloud authentication failed. Check GOOGLE_APPLICATION_CREDENTIALS."
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
      console.error("[GeminiTTS] Google API error:", JSON.stringify(data, null, 2));
      throw new Error(
        data?.error?.message ||
        data?.message ||
        `Google API request failed: HTTP ${response.status}`
      );
    }

    return data;
  }

  /**
   * Converts any input audio buffer to mono, 24kHz, 16-bit PCM WAV required for voice replication.
   */
  async convertToRequiredWav(inputBuffer) {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "gemini-tts-wav-"));
    const inputPath = path.join(tempDir, "input.audio");
    const outputPath = path.join(tempDir, "output.wav");

    try {
      fs.writeFileSync(inputPath, inputBuffer);

      await runFfmpeg([
        "-hide_banner", "-loglevel", "error", "-y",
        "-i", inputPath,
        "-vn", "-ac", "1", "-ar", "24000",
        "-c:a", "pcm_s16le", "-f", "wav", outputPath
      ], "Input audio conversion to 24kHz WAV failed");

      const wav = fs.readFileSync(outputPath);

      if (
        wav.length < 44 ||
        wav.toString("ascii", 0, 4) !== "RIFF" ||
        wav.toString("ascii", 8, 12) !== "WAVE"
      ) {
        throw new Error("FFmpeg did not produce a valid WAV file.");
      }

      return wav;
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  }

  /**
   * Converts Gemini TTS WAV output to MP3 and applies tempo/loudness filters.
   */
  async convertWavToMp3(inputBuffer, outputPath, tempo = 0.96) {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "gemini-tts-mp3-"));
    const inputPath = path.join(tempDir, "input.wav");
    const t = Math.min(1.15, Math.max(0.85, tempo));

    const filters = [
      `atempo=${t}`,
      "highpass=f=70",
      "loudnorm=I=-18:TP=-1.5:LRA=14"
    ].join(",");

    try {
      fs.writeFileSync(inputPath, inputBuffer);

      const targetDir = path.dirname(outputPath);
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

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

      const stat = fs.statSync(outputPath);
      if (stat.size < 128) {
        throw new Error("The converted MP3 is empty or invalid.");
      }

      return outputPath;
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  }

  /**
   * Creates a replicated voice in Google Vertex AI using reference & consent audio.
   * @param {Object} params
   * @param {Buffer} params.referenceBuffer - Reference audio buffer of the speaker
   * @param {Buffer} params.consentBuffer - Consent audio buffer
   * @param {string} params.displayName - Name for the voice profile
   * @returns {Promise<string>} The created voiceId (e.g. voice_...)
   */
  async createReplicatedVoice({ referenceBuffer, consentBuffer, displayName }) {
    if (!referenceBuffer || !consentBuffer) {
      throw new Error("Both reference audio and consent audio are required for voice replication.");
    }

    const [sourceWav, consentWav] = await Promise.all([
      this.convertToRequiredWav(referenceBuffer),
      this.convertToRequiredWav(consentBuffer)
    ]);

    const url = `https://aiplatform.googleapis.com/v1beta1/projects/${encodeURIComponent(this.projectId)}/locations/${this.location}/voices`;

    const result = await this.googleFetch(url, {
      method: "POST",
      body: JSON.stringify({
        store: true,
        voice: {
          type: "VOICE_TYPE_REPLICATED",
          displayName: displayName || "Replicated Voice",
          replicated: {
            sourceAudio: {
              mimeType: "audio/wav",
              data: sourceWav.toString("base64")
            },
            consentAudio: {
              mimeType: "audio/wav",
              data: consentWav.toString("base64")
            }
          }
        }
      })
    });

    const voiceId = result.id;
    if (typeof voiceId !== "string" || !voiceId.startsWith("voice_")) {
      console.error("[GeminiTTS] Unexpected voice response:", result);
      throw new Error("Google Vertex AI did not return a valid stored Voice ID.");
    }

    console.log(`[GeminiTTS] Successfully replicated voice: ${voiceId} (${displayName})`);
    return voiceId;
  }

  /**
   * Generates speech using Gemini 3.8 Flash TTS and saves it as an MP3 file.
   */
  async generateSpeech({
    text,
    language = "en",
    voiceId = "aoede",
    voiceGender = "female",
    outputPath,
    emotion,
    intensity,
    deliveryStyle = "teacher",
    tempo,
    humanize
  }) {
    if (!text || text.trim() === "") {
      throw new Error("Text is required for speech generation.");
    }

    // Resolve prebuilt vs replicated voice ID
    let resolvedVoice = voiceId;
    if (!resolvedVoice || resolvedVoice === "default" || resolvedVoice.startsWith("gemini-3.8-flash-tts")) {
      // Map to prebuilt teacher voices
      if (resolvedVoice && resolvedVoice.includes("achird")) resolvedVoice = "achird";
      else if (resolvedVoice && resolvedVoice.includes("alnilam")) resolvedVoice = "alnilam";
      else if (resolvedVoice && resolvedVoice.includes("achernar")) resolvedVoice = "achernar";
      else if (resolvedVoice && resolvedVoice.includes("aoede")) resolvedVoice = "aoede";
      else {
        // Gender default
        resolvedVoice = voiceGender === "male" ? "achird" : "aoede";
      }
    }

    const detectedLang = detectLanguage(language, text);
    const isHindi = detectedLang === "hindi";
    const isTamil = detectedLang === "tamil";

    const effEmotion = emotion || (isHindi ? "confident" : "warm");
    const effIntensity = intensity || (isHindi ? "high" : "medium");

    const useHumanizer = !isHindi && !isTamil && humanize !== false;
    let spokenText = useHumanizer ? humanizeScript(text) : text;

    const defaultTempo = isHindi || isTamil ? 1.0 : 0.96;
    const effTempo = typeof tempo === "number" && tempo > 0 ? tempo : defaultTempo;

    const styleInstruction = buildStyleInstruction(
      deliveryStyle,
      effEmotion,
      effIntensity,
      detectedLang
    );

    const url = `https://aiplatform.googleapis.com/v1/projects/${encodeURIComponent(this.projectId)}/locations/${this.location}/publishers/google/models/${this.model}:generateContent`;

    console.log(`[GeminiTTS] Synthesizing speech with ${this.model} | Voice: ${resolvedVoice} | Lang: ${detectedLang} | Length: ${spokenText.length} chars`);

    const result = await this.googleFetch(url, {
      method: "POST",
      body: JSON.stringify({
        contents: [{
          role: "user",
          parts: [{
            text: spokenText,
            speechMetadata: {
              style: styleInstruction
            }
          }]
        }],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              voice: resolvedVoice
            }
          }
        }
      })
    });

    const parts = result.candidates?.[0]?.content?.parts || [];
    const audioPart = parts.find(p => p.inlineData?.data);

    if (!audioPart || !audioPart.inlineData?.data) {
      console.error("[GeminiTTS] No audio returned by model:", JSON.stringify(result));
      throw new Error(`The model ${this.model} returned no audio content.`);
    }

    const audioBuffer = Buffer.from(audioPart.inlineData.data, "base64");
    if (audioBuffer.length < 44) {
      throw new Error("[GeminiTTS] Returned audio buffer is too small or invalid.");
    }

    await this.convertWavToMp3(audioBuffer, outputPath, effTempo);
    return outputPath;
  }
}

module.exports = GeminiTTSProvider;

