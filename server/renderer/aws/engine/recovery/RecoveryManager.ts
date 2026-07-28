import { Page } from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';

export class RecoveryManager {
  private page: Page;
  private outputDir: string;

  constructor(page: Page, outputDir: string = './diagnostics') {
    this.page = page;
    this.outputDir = outputDir;

    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  /**
   * Generates a comprehensive diagnostic report when a step fails.
   */
  public async generateDiagnosticReport(stepNumber: number, error: Error): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const prefix = `step_${stepNumber}_${timestamp}`;
    const reportPath = path.join(this.outputDir, `${prefix}_report.txt`);

    let reportContent = `--- DIAGNOSTIC REPORT ---\n`;
    reportContent += `Timestamp: ${new Date().toISOString()}\n`;
    reportContent += `Step: ${stepNumber}\n`;
    reportContent += `Error: ${error.message}\n`;
    reportContent += `Stack: ${error.stack}\n\n`;

    try {
      const url = this.page.url();
      reportContent += `Current URL: ${url}\n`;
    } catch (e) {
      reportContent += `Current URL: [Failed to retrieve]\n`;
    }

    try {
      const title = await this.page.title();
      reportContent += `Page Title: ${title}\n`;
    } catch (e) {
      reportContent += `Page Title: [Failed to retrieve]\n`;
    }

    try {
      const screenshotPath = path.join(this.outputDir, `${prefix}_screenshot.png`);
      await this.page.screenshot({ path: screenshotPath, fullPage: true });
      reportContent += `Screenshot: ${screenshotPath}\n`;
    } catch (e) {
      reportContent += `Screenshot: [Failed to capture]\n`;
    }

    try {
      const html = await this.page.content();
      const htmlPath = path.join(this.outputDir, `${prefix}_dom.html`);
      fs.writeFileSync(htmlPath, html);
      reportContent += `DOM Snapshot: ${htmlPath}\n`;
    } catch (e) {
      reportContent += `DOM Snapshot: [Failed to capture]\n`;
    }

    fs.writeFileSync(reportPath, reportContent);
    return reportPath;
  }
}
