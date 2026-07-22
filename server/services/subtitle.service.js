const fs = require('fs');

const highlightLine = (line) => {
  // Extract strings to prevent syntax highlighting inside quote boundaries
  const strings = [];
  let highlighted = line.replace(/(["'])(?:(?=(\\?))\2.)*?\1/g, (match) => {
    strings.push(match);
    return `___STR_${strings.length - 1}___`;
  });
  
  // Core syntax keywords (e.g. orange/yellow-orange &H0088FF&)
  const keywords = /\b(def|class|import|from|return|if|else|elif|for|while|in|as|try|except|finally|pass|lambda|assert|and|or|not|is|with|global|nonlocal|yield|var|const|let|function|new|instanceof|typeof|async|await)\b/g;
  highlighted = highlighted.replace(keywords, `{\\c&H0088FF&}$1{\\c&HFFFFFF&}`);
  
  // Built-ins and common methods (e.g. cyan/light-blue &HFFFF33&)
  const builtins = /\b(print|console|log|int|str|float|list|dict|set|len|range|self|this|__init__|__str__)\b/g;
  highlighted = highlighted.replace(builtins, `{\\c&HFFFF33&}$1{\\c&HFFFFFF&}`);

  // Numbers (&HFF88FF& - pink)
  highlighted = highlighted.replace(/\b(\d+)\b/g, `{\\c&HFF88FF&}$1{\\c&HFFFFFF&}`);

  // Comments (# or //) (&H888888& - elegant gray)
  highlighted = highlighted.replace(/(#.*|\/\/.*)/g, `{\\c&H888888&}$1{\\c&HFFFFFF&}`);

  // Restore quotes/strings, formatting them in soft green (&H55FF55&)
  for (let i = 0; i < strings.length; i++) {
    highlighted = highlighted.replace(`___STR_${i}___`, `{\\c&H55FF55&}${strings[i]}{\\c&HFFFFFF&}`);
  }
  
  // Remove redundant color tags (e.g. adjacent white resets)
  highlighted = highlighted.replace(/{\\c&H[0-9A-F]+&}\s*(?={\\c&H[0-9A-F]+&})/gi, '');
  
  return highlighted;
};

// Simple syntax highlighter for Python/JS code block formatting inside ASS subtitles
const highlightCode = (codeText) => {
  // Convert any literal double backslashes \\N into single \N first
  let cleanText = codeText.replace(/\\\\N/g, '\\N');
  
  // Split by \N, highlight each line with line numbers, and format Terminal Output sections!
  const lines = cleanText.split('\\N');
  let lineNum = 1;
  
  const formattedLines = lines.map(line => {
    if (line.includes('==== OUTPUT ====')) {
      return `{\\c&H00FFFF&}\\N💻 TERMINAL OUTPUT:{\\c&HFFFFFF&}`;
    }
    // Add VS Code line numbers
    const numPrefix = `{\\c&H666666&}${lineNum.toString().padStart(2, ' ')} | {\\c&HFFFFFF&}`;
    lineNum++;
    return numPrefix + highlightLine(line);
  });
  
  return `{\\c&HFFFFFF&}` + formattedLines.join('\\N');
};

// Format seconds into H:MM:SS.cs
const formatTime = (seconds) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const cs = Math.floor((seconds % 1) * 100);
  
  return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${cs.toString().padStart(2, '0')}`;
};

const generateAssFile = (slides, durations, outputPath, format = '16:9') => {
  return new Promise((resolve, reject) => {
    try {
      const isShorts = format === '9:16';
      const playResX = isShorts ? 1080 : 1920;
      const playResY = isShorts ? 1920 : 1080;
      
      const headingFontSize = isShorts ? 65 : 75;
      const subFontSize = isShorts ? 45 : 50;
      const bulletFontSize = isShorts ? 40 : 45;
      const codeFontSize = isShorts ? 28 : 34;
      
      let assContent = `[Script Info]
ScriptType: v4.00+
PlayResX: ${playResX}
PlayResY: ${playResY}
WrapStyle: 1

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: WindowHeader,Arial,${isShorts ? 36 : 42},&H0000FFFF,&H000000FF,&H00000000,&H00241E1E,-1,0,0,0,100,100,0,0,1,2,0,8,${isShorts ? 60 : 120},${isShorts ? 60 : 120},${isShorts ? 120 : 80},1
Style: Heading,Segoe UI,${headingFontSize},&H0033CCFF,&H000000FF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,2,1,8,${isShorts ? 80 : 150},${isShorts ? 80 : 150},${isShorts ? 220 : 150},1
Style: Subheading,Segoe UI,${subFontSize},&H00CCCCCC,&H000000FF,&H00000000,&H80000000,0,0,0,0,100,100,0,0,1,0,1,8,${isShorts ? 80 : 150},${isShorts ? 80 : 150},${isShorts ? 320 : 250},1
Style: Bullet,Segoe UI,${bulletFontSize},&H00FFFFFF,&H000000FF,&H00000000,&H001E1E1E,0,0,0,0,100,100,0,0,3,15,0,7,${isShorts ? 80 : 180},${isShorts ? 80 : 180},${isShorts ? 450 : 340},1
Style: CodeBlock,Consolas,${codeFontSize},&H00FFFFFF,&H000000FF,&H00000000,&H001E1E1E,0,0,0,0,100,100,0,0,3,15,0,7,${isShorts ? 60 : 150},${isShorts ? 60 : 150},${isShorts ? 420 : 320},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

      let currentTime = 0;
      
      slides.forEach((slide, i) => {
        const duration = durations[i];
        const startTimeStr = formatTime(currentTime);
        const endTimeStr = formatTime(currentTime + duration);
        
        // Escape strings
        const heading = (slide.heading || '').replace(/(\r\n|\n|\r)/gm, ' ');
        const subheading = (slide.subheading || '').replace(/(\r\n|\n|\r)/gm, ' ');
        
        const isCodeSlide = slide.isCode === true ||
                            slide.isCode === 'true' ||
                            /code|program|example|syntax/i.test(heading || subheading || '') ||
                            (slide.bullets && slide.bullets.length === 1 && (slide.bullets[0].includes('\\N') || slide.bullets[0].includes('\n')));

        // Render Screen Share Window Bar Header
        const fileName = slide.fileName || 'main.py';
        const windowTitle = isCodeSlide ? `🔴 🟡 🟢   📄 ${fileName} — Visual Studio Code (Live Class)` : "🔴 🟡 🟢   📝 notes.txt — Spoken Classroom Study Notes";
        assContent += `Dialogue: 0,${startTimeStr},${endTimeStr},WindowHeader,,0,0,0,,${windowTitle}\n`;

        if (heading) {
           assContent += `Dialogue: 0,${startTimeStr},${endTimeStr},Heading,,0,0,0,,${heading}\n`;
        }
        if (subheading) {
           assContent += `Dialogue: 0,${startTimeStr},${endTimeStr},Subheading,,0,0,0,,${subheading}\n`;
        }
        
        if (slide.bullets && Array.isArray(slide.bullets)) {
          if (isCodeSlide) {
            // Join bullets with \N, replace actual newlines with \N, and highlight the code text!
            const joinedText = slide.bullets.join('\\N');
            const cleanNewlines = joinedText.replace(/(\r\n|\n|\r)/gm, '\\N');
            const highlightedText = highlightCode(cleanNewlines);
            assContent += `Dialogue: 0,${startTimeStr},${endTimeStr},CodeBlock,,0,0,0,,${highlightedText}\n`;
          } else {
            // Join bullets with \N (ASS newline) with bullet dots inside Notepad window
            const bulletsText = slide.bullets.map(b => {
              const cleanText = b.replace(/(\r\n|\n|\r)/gm, ' ');
              return '• ' + cleanText;
            }).join('\\N\\N');
            
            if (bulletsText) {
               assContent += `Dialogue: 0,${startTimeStr},${endTimeStr},Bullet,,0,0,0,,${bulletsText}\n`;
            }
          }
        }
        
        currentTime += duration;
      });

      fs.writeFile(outputPath, assContent, 'utf8', (err) => {
        if (err) return reject(err);
        resolve(outputPath);
      });
    } catch (err) {
      reject(err);
    }
  });
};

module.exports = {
  generateAssFile
};
