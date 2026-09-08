const { execSync } = require('child_process');
const path = require('path');

try {
  console.log('Checking puppeteer.service.js syntax...');
  require('./services/puppeteer.service');
  console.log('puppeteer.service.js loaded successfully!');

  console.log('Checking video.controller.js syntax...');
  require('./controllers/video.controller');
  console.log('video.controller.js loaded successfully!');

  console.log('Checking server.js syntax...');
  require('./server');
  console.log('server.js loaded successfully!');
} catch (err) {
  console.error('Syntax or import check failed:', err);
  process.exit(1);
}
