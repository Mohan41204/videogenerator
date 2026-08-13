/**
 * aws.config.js
 *
 * Central configuration for AWS Console automation.
 * Contains service URLs, timing parameters, viewport settings,
 * and Chrome browser configuration.
 */

const path = require('path');

module.exports = {
  // ── AWS Console Service URLs ─────────────────────────────────────────
  consoleBaseUrl: 'https://console.aws.amazon.com',
  ssoStartUrl: process.env.AWS_SSO_START_URL || '',

  serviceUrls: {
    IAM:            'https://console.aws.amazon.com/iam',
    EC2:            'https://console.aws.amazon.com/ec2',
    S3:             'https://s3.console.aws.amazon.com/s3',
    Lambda:         'https://console.aws.amazon.com/lambda',
    SNS:            'https://console.aws.amazon.com/sns',
    SQS:            'https://console.aws.amazon.com/sqs',
    RDS:            'https://console.aws.amazon.com/rds',
    DynamoDB:       'https://console.aws.amazon.com/dynamodbv2',
    CloudWatch:     'https://console.aws.amazon.com/cloudwatch',
    VPC:            'https://console.aws.amazon.com/vpc',
    Route53:        'https://console.aws.amazon.com/route53',
    APIGateway:     'https://console.aws.amazon.com/apigateway',
    ECR:            'https://console.aws.amazon.com/ecr',
    ECS:            'https://console.aws.amazon.com/ecs',
    CloudFormation: 'https://console.aws.amazon.com/cloudformation',
    SecretsManager: 'https://console.aws.amazon.com/secretsmanager',
    ACM:            'https://console.aws.amazon.com/acm',
    Cognito:        'https://console.aws.amazon.com/cognito',
    Amplify:        'https://console.aws.amazon.com/amplify',
  },

  // ── Supported AWS Services (for frontend dropdown) ───────────────────
  supportedServices: [
    'IAM', 'EC2', 'S3', 'Lambda', 'SNS', 'SQS', 'RDS', 'DynamoDB',
    'CloudWatch', 'VPC', 'Route53', 'API Gateway', 'ECR', 'ECS',
    'CloudFormation', 'Secrets Manager', 'ACM', 'Cognito', 'Amplify',
  ],

  // ── Viewport ─────────────────────────────────────────────────────────
  viewport: {
    width: 1500,
    height: 700,
    deviceScaleFactor: 1,
  },

  // ── Human-like Timing (milliseconds) ─────────────────────────────────
  timing: {
    typingDelayMin: 45,       // Min delay between key presses
    typingDelayMax: 140,      // Max delay between key presses
    clickPauseMin: 200,       // Min pause after a click
    clickPauseMax: 600,       // Max pause after a click
    actionPauseMin: 400,      // Min pause between distinct actions
    actionPauseMax: 1200,     // Max pause between distinct actions
    pageLoadWait: 3000,       // Max wait for page navigation
    scrollStepPx: 60,         // Pixels per scroll step
    scrollStepDelay: 30,      // Delay between scroll steps (ms)
    mouseMoveDuration: 400,   // Duration for mouse travel (ms)
    highlightDuration: 1500,  // How long to show element highlight (ms)
    tooltipDuration: 2000,    // How long to show tooltip overlay (ms)
  },

  // ── Chrome Browser Configuration ─────────────────────────────────────
  chrome: {
    profilePath: process.env.CHROME_PROFILE_PATH ||
                 path.join(__dirname, '..', 'chrome-profile'),
    launchArgs: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--disable-infobars',
      '--window-size=1500,700',
      // Scale the AWS Console content to 75% so all UI elements (sidebar,
      // action buttons, long forms, success banners) fit vertically within 1500x700 
      // without overflowing or being cut off at the bottom.
      '--force-device-scale-factor=0.75',
      '--disable-extensions',
      '--disable-dev-shm-usage',
      '--lang=en-US',
      // Prevent rendering from pausing when window loses focus or is minimized:
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
    ],
    headless: false,  // Must be false for real AWS console recording
  },

  // ── Recording ────────────────────────────────────────────────────────
  recording: {
    // FPS must match actual screenshot capture rate. At 1920x1080, each Puppeteer
    // screenshot takes ~300-500ms, giving us ~2-3 real FPS. Setting this higher
    // than the capture rate causes FFmpeg to duplicate frames → visible flickering.
    fps: 3,
    screenshotQuality: 85,    // JPEG quality for frame capture
    screenshotType: 'jpeg',
  },

  // ── Retry Configuration ──────────────────────────────────────────────
  retry: {
    maxAttempts: 3,
    baseDelayMs: 1000,
    selectorTimeoutMs: 15000,  // Wait for a selector before failing (AWS Console is slow)
  },
};
