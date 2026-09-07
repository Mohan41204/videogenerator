const fs = require('fs');

function resolveFFmpegPath() {
  // 1. Check system ffmpeg binary (e.g. /usr/bin/ffmpeg in Linux/Docker)
  if (fs.existsSync('/usr/bin/ffmpeg')) {
    return '/usr/bin/ffmpeg';
  }
  if (fs.existsSync('/usr/local/bin/ffmpeg')) {
    return '/usr/local/bin/ffmpeg';
  }

  // 2. Check ffmpeg-static package binary
  try {
    const staticPath = require('ffmpeg-static');
    if (staticPath && typeof staticPath === 'string' && fs.existsSync(staticPath)) {
      return staticPath;
    }
  } catch (e) {}

  // 3. Fallback to system command name
  return 'ffmpeg';
}

module.exports = resolveFFmpegPath();
