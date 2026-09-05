const path = require('path');
const fs = require('fs');
const gTTS = require('gtts');
const ffmpeg = require('fluent-ffmpeg');
const ffprobePath = require('ffprobe-static').path;
const ffmpegPath = require('ffmpeg-static');

ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);

let customVoiceProvider = null;
const getCustomVoiceProvider = () => {
  if (!customVoiceProvider) {
    const GoogleCustomVoiceProvider = require('./tts/GoogleCustomVoiceProvider');
    customVoiceProvider = new GoogleCustomVoiceProvider();
  }
  return customVoiceProvider;
};

const generateSingleAudioWithGTTS = (text, outputPath, langCode = 'en') => {
  return new Promise((resolve, reject) => {
    try {
      const gtts = new gTTS(text, langCode);
      if (langCode === 'en') {
        gtts.lang = 'en-in'; // Set to Indian English accent
      } else {
        // gTTS supports 'ta', 'hi', 'ml', 'te', 'kn' directly
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
  // If no voice is selected or default computer voice is selected, DO NOT call Google TTS!
  const isCustomVoice = voiceId && typeof voiceId === 'string' && voiceId.trim() !== '' && voiceId !== 'default' && voiceId !== 'default-computer';

  if (!isCustomVoice) {
    return await generateSingleAudioWithGTTS(text, outputPath, langCode);
  }

  // If a custom voice is selected, try using GoogleCustomVoiceProvider with fallback to default
  try {
    const provider = getCustomVoiceProvider();
    const isGoogleCloud = voiceId && typeof voiceId === 'string' && voiceId.startsWith('google-cloud-tts');
    const passedVoiceId = isGoogleCloud ? null : voiceId;
    const voiceGender = isGoogleCloud && voiceId.includes('male') && !voiceId.includes('female') ? 'male' : 'female';
    
    await provider.generateSpeech({ text, language: langCode, voiceId: passedVoiceId, voiceGender, outputPath });
    return outputPath;
  } catch (error) {
    console.warn(`[TTS] Custom voice provider failed for voice "${voiceId}" (${error.message}). Falling back to default computer voice (gTTS)...`);
    return await generateSingleAudioWithGTTS(text, outputPath, langCode);
  }
};

const generateSilence = (duration, outputPath) => {
  return new Promise((resolve, reject) => {
    try {
      // Generate genuine silent MP3 frames (MPEG-1 Layer 3, 44100 Hz, 128 kbps, Joint Stereo)
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
  if (!punctuation) return 0.2;
  if (/[.!?]/.test(punctuation)) {
    return 1.75; // Extra slow, deliberate teaching pause between sentences
  }
  if (/,|;|:/.test(punctuation)) {
    return 1.0; // Extra slow pause at commas / clauses for better pacing
  }
  return 0.5;
};

const generateAudio = async (text, outputPath, langCode = 'en', voiceId = null) => {
  try {
    const uniqueId = path.basename(outputPath, '.mp3');
    const outputDir = path.dirname(outputPath);

    // Split the text into speech segments and punctuation, keeping sentence/clause structures
    // using a lookahead to only split on punctuation followed by space or end of string.
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
      return await generateSilence(1, outputPath);
    }

    const tempFiles = [];
    try {
      for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        const speechPath = path.join(outputDir, `${uniqueId}_sub_${i}_speech_${langCode}.mp3`);

        await generateSingleAudio(seg.text, speechPath, langCode, voiceId);
        tempFiles.push(speechPath);

        const pauseDur = getPauseDuration(seg.punctuation);
        if (pauseDur > 0) {
          const silencePath = path.join(outputDir, `${uniqueId}_sub_${i}_silence_${langCode}.mp3`);
          await generateSilence(pauseDur, silencePath);
          tempFiles.push(silencePath);
        }
      }

      // Concatenate speech and silence chunks using the fast copy method
      await mergeAudioFiles(tempFiles, outputPath);
    } catch (err) {
      console.error('Error generating audio segments:', err);
      throw err;
    } finally {
      // Clean up temporary segment files
      tempFiles.forEach(p => {
        fs.unlink(p, () => { });
      });
    }

    return outputPath;
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

    // Manually create concat file using resolved absolute paths
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
      if (Math.abs(currentDuration - targetDurationSecs) < 0.1) {
         // Close enough, just copy
         fs.copyFileSync(inputPath, outputPath);
         return resolve(outputPath);
      }
      
      const ratio = currentDuration / targetDurationSecs;
      
      // FFmpeg atempo filter works between 0.5 and 2.0.
      let filter = `atempo=${ratio}`;
      if (ratio > 2.0) {
        filter = `atempo=2.0,atempo=${ratio/2.0}`;
      } else if (ratio < 0.5) {
        filter = `atempo=0.5,atempo=${ratio/0.5}`;
      }
      
      ffmpeg(inputPath)
        .audioFilter(filter)
        .on('error', (err) => {
          console.error('Error adjusting audio duration:', err);
          reject(err);
        })
        .on('end', () => resolve(outputPath))
        .save(outputPath);
    });
  });
};

module.exports = {
  generateAudio,
  getAudioDuration,
  mergeAudioFiles,
  adjustAudioDuration
};
