const path = require('path');
const fs = require('fs');
const gTTS = require('gtts');
const ffmpeg = require('fluent-ffmpeg');
const ffprobePath = require('ffprobe-static').path;
const ffmpegPath = require('../utils/ffmpegPath');

ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);

let customVoiceProvider = null;
let geminiVoiceProvider = null;

const getCustomVoiceProvider = () => {
  if (!customVoiceProvider) {
    const GoogleCustomVoiceProvider = require('./tts/GoogleCustomVoiceProvider');
    customVoiceProvider = new GoogleCustomVoiceProvider();
  }
  return customVoiceProvider;
};

const getGeminiTTSProvider = () => {
  if (!geminiVoiceProvider) {
    const GeminiTTSProvider = require('./tts/GeminiTTSProvider');
    geminiVoiceProvider = new GeminiTTSProvider();
  }
  return geminiVoiceProvider;
};

const isGeminiTTSVoice = (voiceId) => {
  if (!voiceId || voiceId === 'default') return true; // Default to Gemini 3.8 Flash TTS
  if (typeof voiceId !== 'string') return false;
  const vid = voiceId.trim().toLowerCase();
  if (vid.startsWith('gemini') || vid.startsWith('voice_')) return true;
  if (['aoede', 'achird', 'alnilam', 'achernar', 'puck', 'charon', 'kore', 'fenrir'].includes(vid)) return true;

  try {
    const VOICES_FILE = path.join(__dirname, '..', 'voices.json');
    if (fs.existsSync(VOICES_FILE)) {
      const voices = JSON.parse(fs.readFileSync(VOICES_FILE, 'utf8'));
      if (voices[voiceId] || (voices[vid] && voices[vid].type === 'gemini-replicated')) {
        return true;
      }
    }
  } catch (e) {}

  return false;
};

const GTTS_SUPPORTED_LANGUAGES = ['en', 'ta', 'hi', 'ml', 'kn'];

const generateSingleAudioWithGTTS = (text, outputPath, langCode = 'en') => {
  return new Promise((resolve, reject) => {
    try {
      if (!GTTS_SUPPORTED_LANGUAGES.includes(langCode)) {
        return reject(new Error(`[gTTS] Language '${langCode}' is not supported by gTTS.`));
      }
      const gtts = new gTTS(text, langCode);
      if (langCode === 'en') {
        gtts.lang = 'en-in';
      } else {
        gtts.lang = langCode;
      }
      gtts.save(outputPath, function (err, result) {
        if (err) {
          reject(err);
        } else {
          resolve(outputPath);
        }
      });
    } catch (error) {
      reject(error);
    }
  });
};

const generateSingleAudio = async (text, outputPath, langCode = 'en', voiceId = null) => {
  // 1. Try Gemini 3.8 Flash TTS first if requested or default
  if (isGeminiTTSVoice(voiceId)) {
    try {
      const gemini = getGeminiTTSProvider();
      await gemini.generateSpeech({ text, language: langCode, voiceId, outputPath });
      return outputPath;
    } catch (geminiError) {
      console.warn(`[TTS] Gemini 3.8 Flash TTS single error: ${geminiError.message}. Falling back to Google Cloud TTS...`);
    }
  }

  // 2. Try Google Cloud TTS (Wavenet)
  try {
    const provider = getCustomVoiceProvider();
    const isCustomVoice = voiceId && typeof voiceId === 'string' && voiceId.trim() !== '' && voiceId !== 'default' && voiceId !== 'default-computer';
    const isGoogleCloud = voiceId && typeof voiceId === 'string' && voiceId.startsWith('google-cloud-tts');

    const passedVoiceId = isGoogleCloud ? null : (isCustomVoice ? voiceId : null);
    const voiceGender = isGoogleCloud && voiceId.includes('male') && !voiceId.includes('female') ? 'male' : 'female';

    await provider.generateSpeech({ text, language: langCode, voiceId: passedVoiceId, voiceGender, outputPath });
    return outputPath;
  } catch (error) {
    console.warn(`[TTS] Google Cloud TTS provider error for language "${langCode}" (${error.message}). Checking gTTS fallback...`);
    if (GTTS_SUPPORTED_LANGUAGES.includes(langCode)) {
      console.warn(`[TTS] Falling back to default computer voice (gTTS) for supported language "${langCode}"...`);
      return await generateSingleAudioWithGTTS(text, outputPath, langCode);
    }
    throw error;
  }
};

const generateSilence = (duration, outputPath) => {
  return new Promise((resolve, reject) => {
    try {
      const silentFrameHeader = Buffer.from([0xff, 0xfb, 0x90, 0x64]);
      const frameSize = 417;
      const singleFrame = Buffer.alloc(frameSize, 0);
      silentFrameHeader.copy(singleFrame, 0);

      const framesNeeded = Math.max(1, Math.ceil((duration || 0.5) * (44100 / 1152)));
      const mp3Buffer = Buffer.alloc(frameSize * framesNeeded);
      for (let i = 0; i < framesNeeded; i++) {
        singleFrame.copy(mp3Buffer, i * frameSize);
      }

      fs.writeFileSync(outputPath, mp3Buffer);
      resolve(outputPath);
    } catch (err) {
      console.error('Error generating silence:', err);
      reject(err);
    }
  });
};

const getPauseDuration = (punctuation) => {
  if (!punctuation) return 0.1;
  if (/[.!?]/.test(punctuation)) {
    return 0.6;
  }
  if (/,|;|:/.test(punctuation)) {
    return 0.3;
  }
  return 0.2;
};

const generateAudio = async (text, outputPath, langCode = 'en', voiceId = null) => {
  try {
    if (!text || text.trim() === '') {
      const res = await generateSilence(1, outputPath);
      const strObj = new String(res);
      strObj.outputPath = res;
      strObj.sentenceTimings = [];
      return strObj;
    }

    // 1. Direct High-Quality Gemini 3.8 Flash TTS Generation (Single-Call Prosody)
    if (isGeminiTTSVoice(voiceId)) {
      try {
        const gemini = getGeminiTTSProvider();
        await gemini.generateSpeech({
          text,
          language: langCode,
          voiceId,
          outputPath
        });

        const strObj = new String(outputPath);
        strObj.outputPath = outputPath;
        strObj.sentenceTimings = [];
        return strObj;
      } catch (geminiError) {
        console.warn(`[TTS] Gemini 3.8 Flash TTS generation error: ${geminiError.message}. Falling back to segmented Google Cloud TTS...`);
      }
    }

    // 2. Segmented TTS Pipeline for Legacy Google Cloud TTS Wavenet
    const uniqueId = path.basename(outputPath, '.mp3');
    const outputDir = path.dirname(outputPath);

    const parts = text.split(/([.,!?;]+(?=\s|$))/);
    const segments = [];

    for (let i = 0; i < parts.length; i += 2) {
      const speechText = parts[i] ? parts[i].trim() : '';
      const punctuation = parts[i + 1] ? parts[i + 1].trim() : '';

      if (speechText) {
        segments.push({
          text: speechText,
          punctuation: punctuation
        });
      } else if (segments.length > 0 && punctuation) {
        segments[segments.length - 1].punctuation += punctuation;
      }
    }

    if (segments.length === 0) {
      const res = await generateSilence(1, outputPath);
      const strObj = new String(res);
      strObj.outputPath = res;
      strObj.sentenceTimings = [];
      return strObj;
    }

    const tempFiles = [];
    const sentenceTimings = [];
    let currentTime = 0;
    let currentSentenceText = '';
    let currentSentenceStart = 0;

    try {
      for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        const speechPath = path.join(outputDir, `${uniqueId}_sub_${i}_speech_${langCode}.mp3`);

        await generateSingleAudio(seg.text, speechPath, langCode, voiceId);
        tempFiles.push(speechPath);

        let speechDur = 0;
        try {
          speechDur = await getAudioDuration(speechPath);
        } catch (e) {
          speechDur = Math.max(0.5, seg.text.length * 0.06);
        }

        currentSentenceText += (currentSentenceText ? ' ' : '') + seg.text + (seg.punctuation || '');
        currentTime += speechDur;

        const pauseDur = getPauseDuration(seg.punctuation);
        if (pauseDur > 0) {
          const silencePath = path.join(outputDir, `${uniqueId}_sub_${i}_silence_${langCode}.mp3`);
          await generateSilence(pauseDur, silencePath);
          tempFiles.push(silencePath);
          currentTime += pauseDur;
        }

        const isSentenceEnd = /[.!?]/.test(seg.punctuation) || (i === segments.length - 1);
        if (isSentenceEnd) {
          sentenceTimings.push({
            index: sentenceTimings.length,
            text: currentSentenceText.trim(),
            start: Number(currentSentenceStart.toFixed(2)),
            end: Number(currentTime.toFixed(2))
          });
          currentSentenceStart = currentTime;
          currentSentenceText = '';
        }
      }

      await mergeAudioFiles(tempFiles, outputPath);
    } catch (err) {
      console.error('Error generating audio segments:', err);
      throw err;
    } finally {
      tempFiles.forEach(p => {
        fs.unlink(p, () => { });
      });
    }

    const resultStr = new String(outputPath);
    resultStr.outputPath = outputPath;
    resultStr.sentenceTimings = sentenceTimings;
    return resultStr;
  } catch (error) {
    console.error('generateAudio main error:', error);
    throw error;
  }
};

const getAudioDuration = (filePath) => {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return reject(err);
      resolve(metadata.format.duration);
    });
  });
};

const mergeAudioFiles = (inputPaths, outputPath) => {
  return new Promise((resolve, reject) => {
    if (inputPaths.length === 0) return resolve(outputPath);

    const absOutputPath = path.resolve(outputPath);
    const listPath = absOutputPath + '.txt';
    const listContent = inputPaths.map(p => `file '${path.resolve(p).replace(/\\/g, '/')}'`).join('\n');
    fs.writeFileSync(listPath, listContent, 'utf8');

    ffmpeg()
      .input(listPath)
      .inputOptions(['-f', 'concat', '-safe', '0'])
      .outputOptions(['-c copy'])
      .on('error', err => {
        console.error('Error merging audio:', err);
        fs.unlink(listPath, () => { });
        reject(err);
      })
      .on('end', () => {
        fs.unlink(listPath, () => { });
        resolve(absOutputPath);
      })
      .save(absOutputPath);
  });
};

const adjustAudioDuration = (inputPath, outputPath, targetDurationSecs) => {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(inputPath, (err, metadata) => {
      if (err) return reject(err);
      const currentDuration = metadata.format.duration;
      if (!currentDuration || currentDuration <= 0) {
        return reject(new Error('Invalid audio duration'));
      }

      if (!targetDurationSecs || targetDurationSecs <= 0) {
        return fs.copyFile(inputPath, outputPath, (copyErr) => {
          if (copyErr) return reject(copyErr);
          resolve(outputPath);
        });
      }

      const rawSpeedFactor = currentDuration / targetDurationSecs;
      // Clamp tempo adjustment safely between 0.85x and 1.20x to prevent distorted robotic/slow audio
      const speedFactor = Math.max(0.85, Math.min(1.20, rawSpeedFactor));

      if (Math.abs(speedFactor - 1.0) < 0.05) {
        return fs.copyFile(inputPath, outputPath, (copyErr) => {
          if (copyErr) return reject(copyErr);
          resolve(outputPath);
        });
      }

      let filterString = `atempo=${Number(speedFactor.toFixed(3))}`;

      ffmpeg(inputPath)
        .audioFilters(filterString)
        .output(outputPath)
        .on('end', () => resolve(outputPath))
        .on('error', (filterErr) => {
          console.warn(`[FFmpeg] Audio tempo adjust failed (${filterErr.message}). Copying original file...`);
          fs.copyFile(inputPath, outputPath, (copyErr) => {
            if (copyErr) return reject(copyErr);
            resolve(outputPath);
          });
        })
        .run();
    });
  });
};

module.exports = {
  generateAudio,
  generateSingleAudio,
  generateSilence,
  getAudioDuration,
  mergeAudioFiles,
  adjustAudioDuration,
  getCustomVoiceProvider,
  getGeminiTTSProvider,
  isGeminiTTSVoice
};
