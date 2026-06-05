const path = require('path');
const fs = require('fs');
const gTTS = require('gtts');
const ffmpeg = require('fluent-ffmpeg');
const ffprobePath = require('ffprobe-static').path;
const ffmpegPath = require('ffmpeg-static');

ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);

const generateSingleAudio = (text, outputPath) => {
  return new Promise((resolve, reject) => {
    try {
      const gtts = new gTTS(text, 'en');
      gtts.lang = 'en-in'; // Set to Indian English accent
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

const generateSilence = (duration, outputPath) => {
  return new Promise((resolve, reject) => {
    ffmpeg()
      .input('anullsrc=r=24000:cl=mono')
      .inputFormat('lavfi')
      .duration(duration)
      .audioCodec('libmp3lame')
      .audioBitrate('64k')
      .on('error', (err) => {
        console.error('Error generating silence:', err);
        reject(err);
      })
      .on('end', () => resolve(outputPath))
      .save(outputPath);
  });
};

const getPauseDuration = (punctuation) => {
  if (!punctuation) return 0.2;
  if (/[.!?]/.test(punctuation)) {
    return 1.25; // Slower, more deliberate teaching pause between sentences
  }
  if (/,|;|:/.test(punctuation)) {
    return 0.75; // Slower pause at commas / clauses for better pacing
  }
  return 0.4;
};

const generateAudio = async (text, outputPath) => {
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
      return await generateSingleAudio(' ', outputPath);
    }

    const tempFiles = [];
    try {
      for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        const speechPath = path.join(outputDir, `${uniqueId}_sub_${i}_speech.mp3`);

        await generateSingleAudio(seg.text, speechPath);
        tempFiles.push(speechPath);

        const pauseDur = getPauseDuration(seg.punctuation);
        if (pauseDur > 0) {
          const silencePath = path.join(outputDir, `${uniqueId}_sub_${i}_silence.mp3`);
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

    // Manually create concat file to avoid fluent-ffmpeg spawning 150+ ffprobe processes
    const listPath = outputPath + '.txt';
    const listContent = inputPaths.map(p => `file '${p.replace(/\\/g, '/')}'`).join('\n');
    fs.writeFileSync(listPath, listContent, 'utf8');

    ffmpeg()
      .input(listPath)
      .inputOptions(['-f concat', '-safe 0'])
      .outputOptions(['-c copy'])
      .on('error', err => {
        console.error('Error merging audio:', err);
        fs.unlink(listPath, () => { });
        reject(err);
      })
      .on('end', () => {
        fs.unlink(listPath, () => { });
        resolve(outputPath);
      })
      .save(outputPath);
  });
};

module.exports = {
  generateAudio,
  getAudioDuration,
  mergeAudioFiles
};
