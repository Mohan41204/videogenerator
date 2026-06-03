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
  
  // Split by \N, highlight each line, and join back with \N
  const lines = cleanText.split('\\N');
  const highlightedLines = lines.map(line => highlightLine(line));
  
  return `{\\c&HFFFFFF&}` + highlightedLines.join('\\N');
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
      
      const headingFontSize = isShorts ? 90 : 100;
      const subFontSize = isShorts ? 60 : 70;
      const bulletFontSize = isShorts ? 50 : 60;
      const codeFontSize = isShorts ? 32 : 38;
      
      let assContent = `[Script Info]
ScriptType: v4.00+
PlayResX: ${playResX}
PlayResY: ${playResY}
WrapStyle: 1

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Heading,Arial,${headingFontSize},&H0033CCFF,&H000000FF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,3,2,8,100,100,${isShorts ? 300 : 150},1
Style: Subheading,Arial,${subFontSize},&H00000000,&H000000FF,&H00000000,&H80000000,0,0,0,0,100,100,0,0,1,0,1,8,100,100,${isShorts ? 450 : 300},1
Style: Bullet,Arial,${bulletFontSize},&H00000000,&H000000FF,&H00000000,&H80000000,0,0,0,0,100,100,0,0,1,0,1,7,${isShorts ? 100 : 200},100,${isShorts ? 600 : 450},1
Style: CodeBlock,Courier New,${codeFontSize},&H00FFFFFF,&H000000FF,&H00000000,&H00111111,0,0,0,0,100,100,0,0,3,15,0,7,${isShorts ? 80 : 150},${isShorts ? 80 : 150},${isShorts ? 600 : 450},1

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
        
        if (heading) {
           assContent += `Dialogue: 0,${startTimeStr},${endTimeStr},Heading,,0,0,0,,${heading}\n`;
        }
        if (subheading) {
           assContent += `Dialogue: 0,${startTimeStr},${endTimeStr},Subheading,,0,0,0,,${subheading}\n`;
        }
        
        if (slide.bullets && Array.isArray(slide.bullets)) {
          // Check if this slide is presenting code examples/programs
          const isCodeSlide = slide.isCode === true ||
                              slide.isCode === 'true' ||
                              /code|program|example|syntax/i.test(heading || subheading || '') ||
                              (slide.bullets.length === 1 && (slide.bullets[0].includes('\\N') || slide.bullets[0].includes('\n')));
          
          if (isCodeSlide) {
            // Join bullets with \N, replace actual newlines with \N, and highlight the code text!
            const joinedText = slide.bullets.join('\\N');
            const cleanNewlines = joinedText.replace(/(\r\n|\n|\r)/gm, '\\N');
            const highlightedText = highlightCode(cleanNewlines);
            assContent += `Dialogue: 0,${startTimeStr},${endTimeStr},CodeBlock,,0,0,0,,${highlightedText}\n`;
          } else {
            // Join bullets with \N (ASS newline) with bullet dots
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
