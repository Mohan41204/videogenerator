const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

async function testBadgeRender() {
  console.log('Testing Real-World Connection Badge rendering in screen_share.html...');
  const tempProfile = path.join(require('os').tmpdir(), `pup_test_badge_${Date.now()}`);
  const browser = await puppeteer.launch({
    headless: 'new',
    userDataDir: tempProfile,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });

    const htmlPath = path.resolve('server/templates/screen_share.html');
    await page.goto(`file://${htmlPath.replace(/\\/g, '/')}`, { waitUntil: 'load' });

    // Test slide with Category A connection (WannaCry)
    const incidentSlide = {
      isCode: false,
      heading: 'Cybersecurity',
      subheading: 'Unpatched Network Vulnerabilities',
      bullets: [
        'Unpatched SMB ports permit remote code execution without authentication.',
        'Network segmentation and defense-in-depth prevent lateral movement.',
        'Continuous patch management is the primary defense against automated worms.'
      ],
      narration: 'Now let me share an important real-world incident with you. In 2017, the WannaCry ransomware struck...',
      realWorldConnection: {
        hasConnection: true,
        category: 'real_world_incident',
        title: 'WannaCry Ransomware Attack',
        year: '2017',
        personOrEntity: 'Microsoft / UK NHS',
        relevanceScore: 95,
        technicalConcept: 'Unpatched Network Ports & Vulnerability Management'
      }
    };

    console.log('1. Loading incident slide with badge...');
    await page.evaluate((s) => window.loadSlide(s), incidentSlide);
    await page.evaluate(() => window.renderFrame(10.0, 10.0));

    // Verify badge in DOM
    const badgeText = await page.evaluate(() => {
      const el = document.querySelector('.wb-connection-badge');
      return el ? el.textContent : null;
    });

    console.log('Rendered Badge text:', badgeText);
    if (!badgeText || !badgeText.includes('WannaCry')) {
      throw new Error(`Badge not found or incorrect text: "${badgeText}"`);
    }

    const screenshotDir = path.resolve('server/scratch/test_frames');
    if (!fs.existsSync(screenshotDir)) fs.mkdirSync(screenshotDir, { recursive: true });
    const screenPath = path.join(screenshotDir, 'realworld_badge_rendered.png');
    await page.screenshot({ path: screenPath });
    console.log('Saved screenshot to:', screenPath);

    // Test slide with Category C connection (JARVIS movie reference)
    const movieSlide = {
      isCode: false,
      heading: 'Artificial Intelligence',
      subheading: 'Conversational Context & Tool Calling',
      bullets: [
        'Context windows store short-term dialogue history for multi-turn reasoning.',
        'Tool calling enables language models to query external databases and APIs.',
        'Autonomous agents execute structured plans through feedback loops.'
      ],
      narration: 'Think of how Tony Stark interacts with JARVIS in Iron Man...',
      realWorldConnection: {
        hasConnection: true,
        category: 'movie_reference',
        title: 'JARVIS AI Assistant',
        year: '2008',
        personOrEntity: 'Iron Man (Marvel Studios)',
        relevanceScore: 90,
        isFictional: true
      }
    };

    console.log('2. Loading movie analogy slide with badge...');
    await page.evaluate((s) => window.loadSlide(s), movieSlide);
    await page.evaluate(() => window.renderFrame(10.0, 10.0));

    const movieBadgeText = await page.evaluate(() => {
      const el = document.querySelector('.wb-connection-badge');
      return el ? el.textContent : null;
    });

    console.log('Rendered Movie Badge text:', movieBadgeText);
    if (!movieBadgeText || !movieBadgeText.includes('JARVIS')) {
      throw new Error(`Movie Badge not found or incorrect text: "${movieBadgeText}"`);
    }

    const movieScreenPath = path.join(screenshotDir, 'movie_analogy_badge_rendered.png');
    await page.screenshot({ path: movieScreenPath });
    console.log('Saved screenshot to:', movieScreenPath);

    console.log('\nAll badge rendering tests passed successfully!');
  } finally {
    await browser.close();
  }
}

testBadgeRender().catch(err => {
  console.error('Badge render test failed:', err);
  process.exit(1);
});
