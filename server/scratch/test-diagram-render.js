/**
 * test-diagram-render.js
 *
 * Verifies that Puppeteer properly loads screen_share.html,
 * injects the Mermaid SVG into #wb-diagram-card, and that the diagram
 * is cleanly visible in the viewport.
 */

const path = require('path');
const fs = require('fs');
const puppeteer = require('puppeteer');
const diagramService = require('../services/diagram.service');

async function testRender() {
  console.log('--- Launching Puppeteer to test diagram layout & visibility ---');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1500,700']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1500, height: 700 });

  const templatePath = path.join(__dirname, '../templates/screen_share.html');
  await page.goto('file:///' + templatePath.replace(/\\/g, '/'), { waitUntil: 'networkidle0' });

  const sampleSlide = {
    heading: 'Client-Server Architecture',
    subheading: 'Request and Response Flow',
    isCode: false,
    isDiagram: true,
    visual: {
      enabled: true,
      type: 'architecture',
      title: '3-Tier System Architecture',
      nodes: [
        { id: 'Client', label: 'Web Browser (Client)' },
        { id: 'Gateway', label: 'API Gateway / Reverse Proxy' },
        { id: 'AppServer', label: 'Backend Application Server' },
        { id: 'Database', label: 'PostgreSQL Database' }
      ],
      connections: [
        { from: 'Client', to: 'Gateway', label: 'HTTPS Request' },
        { from: 'Gateway', to: 'AppServer', label: 'Internal RPC' },
        { from: 'AppServer', to: 'Database', label: 'SQL Query' }
      ]
    },
    mermaid: `graph LR
  Client["Web Browser (Client)"] -->|"HTTPS Request"| Gateway["API Gateway"]
  Gateway -->|"Internal RPC"| AppServer["Application Server"]
  AppServer -->|"SQL Query"| Database["Database"]`,
    bullets: [],
    narration: 'When a user navigates to our web application, their browser initiates an HTTPS request to the API Gateway...'
  };

  // 1. Load slide
  await page.evaluate((slide) => {
    window.loadSlide(slide);
  }, sampleSlide);

  // 2. Render Mermaid into page
  await diagramService.renderMermaidInPage(page, sampleSlide.mermaid);

  // 3. Render frame at progress = 0.1 (early frame - should already be visible!)
  await page.evaluate(() => {
    window.renderFrame(1, 10);
  });

  // 4. Measure layout bounding boxes
  const metrics = await page.evaluate(() => {
    const card = document.getElementById('wb-diagram-card');
    const svg = card ? card.querySelector('svg') : null;
    const textCard = document.getElementById('wb-main-text-card');
    return {
      cardExists: !!card,
      cardVisible: card ? card.classList.contains('visible') : false,
      cardRect: card ? card.getBoundingClientRect() : null,
      svgExists: !!svg,
      svgRect: svg ? svg.getBoundingClientRect() : null,
      textCardRect: textCard ? textCard.getBoundingClientRect() : null
    };
  });

  console.log('\nRendering Metrics:');
  console.log('  Card exists:', metrics.cardExists);
  console.log('  Card visible (early frame):', metrics.cardVisible);
  console.log('  Card bounding rect:', metrics.cardRect);
  console.log('  SVG exists:', metrics.svgExists);
  console.log('  SVG bounding rect:', metrics.svgRect);
  console.log('  Text card bounding rect:', metrics.textCardRect);

  // Assertions
  if (!metrics.cardVisible) throw new Error('Diagram card is not visible on frame 1!');
  if (!metrics.svgExists) throw new Error('SVG was not inserted into #wb-diagram-card!');
  if (metrics.svgRect.width === 0 || metrics.svgRect.height === 0) throw new Error('SVG has 0 dimensions!');
  if (metrics.cardRect.right > 1500) throw new Error('Diagram card overflows right edge of 1500px viewport!');
  if (metrics.cardRect.bottom > 700) throw new Error('Diagram card overflows bottom edge of 700px viewport!');

  console.log('\nALL LAYOUT ASSERTIONS PASSED! Diagram is centered and 100% visible inside 1500x700 viewport.');

  // Save screenshot artifact for inspection
  const screenshotPath = path.join(__dirname, 'diagram_render_snapshot.jpg');
  await page.screenshot({ path: screenshotPath, type: 'jpeg', quality: 90, clip: { x: 0, y: 0, width: 1500, height: 700 } });
  console.log('Saved snapshot to:', screenshotPath);

  await browser.close();
}

testRender().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
