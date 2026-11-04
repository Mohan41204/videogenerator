const fs = require('fs');
const path = require('path');

const targetFile = path.resolve(__dirname, '../templates/screen_share.html');
let content = fs.readFileSync(targetFile, 'utf8');

const isCRLF = content.includes('\r\n');
content = content.replace(/\r\n/g, '\n');

// 1. Ensure CSS has .wb-erase-whiteout
content = content.replace(
  /\.wb-erase-layer\s*\{[^}]*\}/g,
  `.wb-erase-whiteout {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 0px;
      z-index: 45;
      background: #ffffff;
      pointer-events: none;
      overflow: hidden;
    }
    .wb-erase-whiteout.hidden {
      display: none !important;
    }`
);

// 2. Ensure HTML has #wb-erase-whiteout
content = content.replace(
  'id="wb-erase-layer"',
  'id="wb-erase-whiteout" class="wb-erase-whiteout hidden"'
);

// 3. Update loadSlide and add _buildWhiteboardSlide
const oldBuildStart = '    // Clear and build the whiteboard canvas elements';
const buildStartIdx = content.indexOf(oldBuildStart);

const oldBuildEnd = '    // Adjust canvas padding for maximum visual display area when diagram or real-world image is shown';
// Let's see how the whiteboard building is structured in loadSlide:
// We can wrap the building logic into function _buildWhiteboardSlide(slide)

fs.writeFileSync('server/scratch/temp_content.txt', content, 'utf8');
console.log('Saved temp content');

