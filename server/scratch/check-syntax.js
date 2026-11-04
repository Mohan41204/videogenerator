const fs = require('fs');
const html = fs.readFileSync('server/templates/screen_share.html', 'utf8');
const scriptStartIdx = html.indexOf('<script>');
const scriptContent = html.substring(scriptStartIdx + 8, html.lastIndexOf('</script>'));
const scriptStartLine = html.substring(0, scriptStartIdx).split('\n').length;

const lines = scriptContent.split('\n');

let braceStack = [];

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  for (let j = 0; j < line.length; j++) {
    const c = line[j];
    if (c === '{') braceStack.push(i + 1);
    else if (c === '}') {
      if (braceStack.length === 0) {
        console.log(`Extra '}' at script line ${i + 1} (HTML line ${scriptStartLine + i}): ${line}`);
      } else {
        braceStack.pop();
      }
    }
  }
}
console.log(`Unclosed '{' count: ${braceStack.length}`);
if (braceStack.length > 0) {
  for (const l of braceStack) {
    console.log(`Unclosed '{' at script line ${l} (HTML line ${scriptStartLine + l - 1}): ${lines[l - 1].trim()}`);
  }
}
