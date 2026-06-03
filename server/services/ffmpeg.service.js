const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');

// Set ffmpeg path
ffmpeg.setFfmpegPath(ffmpegPath);

const formatSubtitlePath = (filePath) => {
  // Windows absolute paths in FFmpeg filters need backslashes replaced with forward slashes
  // and colons escaped (e.g. D:\path -> D\:/path)
  return filePath.replace(/\\/g, '/').replace(':', '\\:');
};

const generateVideo = (audioPath, backgroundPath, assFilePath, outputPath, format = '16:9') => {
  return new Promise((resolve, reject) => {
    
    // Default resolutions
    const resolution = format === '9:16' ? '1080x1920' : '1920x1080';
    
    let command = ffmpeg();

    if (!backgroundPath) {
      // Generate white background using lavfi color filter
      command = command
        .input(`color=c=white:s=${resolution}:r=1`)
        .inputFormat('lavfi');
    } else {
      const isVideo = backgroundPath.toLowerCase().endsWith('.mp4') || backgroundPath.toLowerCase().endsWith('.mov');
      if (isVideo) {
        // Loop the video background at reduced framerate
        command = command.input(backgroundPath).inputOptions(['-stream_loop -1', '-r 15']);
      } else {
        // Loop the image background at low framerate for presentation style
        command = command.input(backgroundPath).inputOptions(['-loop 1', '-r 1']);
      }
    }

    const subPathFormatted = formatSubtitlePath(assFilePath);

    command = command
      .input(audioPath)
      .outputOptions([
        '-c:v libx264',
        '-preset ultrafast',
        '-tune stillimage',
        '-threads 0',
        '-c:a aac',
        '-b:a 192k',
        '-pix_fmt yuv420p',
        '-shortest', // Finish encoding when the shortest input stream ends
        `-s ${resolution}`, // Set resolution
        `-vf subtitles='${subPathFormatted}'` // Apply ASS subtitles
      ])
      .on('progress', (progress) => {
        console.log('FFmpeg Processing: ' + progress.percent + '% done');
      })
      .on('end', () => {
        resolve(outputPath);
      })
      .on('error', (err) => {
        console.error('Error generating video:', err);
        reject(err);
      })
      .save(outputPath);
  });
};

module.exports = {
  generateVideo
};
