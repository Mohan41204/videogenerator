const sanitizeJsonControlChars = (str) => {
  if (!str) return '';
  let inString = false;
  let escaped = false;
  let result = '';

  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    const code = str.charCodeAt(i);

    if (escaped) {
      result += ch;
      escaped = false;
      continue;
    }

    if (ch === '\\') {
      escaped = true;
      result += ch;
      continue;
    }

    if (ch === '"') {
      inString = !inString;
      result += ch;
      continue;
    }

    if (inString) {
      if (ch === '\n') {
        result += '\\n';
      } else if (ch === '\r') {
        result += '\\r';
      } else if (ch === '\t') {
        result += '\\t';
      } else if (code < 32 || (code >= 127 && code <= 159)) {
        result += ' ';
      } else {
        result += ch;
      }
    } else {
      result += ch;
    }
  }

  return result;
};

// Test bad JSON containing unescaped newline and control char
const badJson = '{\n  "heading": "Python",\n  "narration": "Line 1\nLine 2\x01\x02End"\n}';
console.log('--- Original Bad JSON ---');
try {
  JSON.parse(badJson);
} catch (e) {
  console.log('Native JSON.parse failed as expected:', e.message);
}

const fixed = sanitizeJsonControlChars(badJson);
const parsed = JSON.parse(fixed);
console.log('--- Fixed JSON Parsed Successfully! ---');
console.log('heading:', parsed.heading);
console.log('narration:', parsed.narration);

