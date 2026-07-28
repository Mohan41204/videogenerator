import { Page } from 'puppeteer';
import { ActionTarget } from '../types';
import { ElementResolver } from '../locators/ElementResolver';

export class WaitManager {
  private page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  /**
   * Waits for a target element to be present and resolve successfully.
   */
  public async waitForTarget(target: ActionTarget, timeoutMs: number = 10000): Promise<void> {
    const resolver = new ElementResolver(this.page);
    const startTime = Date.now();
    let lastError: Error | null = null;

    while (Date.now() - startTime < timeoutMs) {
      try {
        await resolver.resolve(target, 50); // Lower threshold for simple existence check
        return; // Success, element is found
      } catch (e) {
        lastError = e as Error;
        await new Promise(r => setTimeout(r, 500)); // Poll every 500ms
      }
    }

    throw new Error(`WaitManager: Timeout waiting for target ${JSON.stringify(target)}. Last error: ${lastError?.message}`);
  }

  /**
   * Waits for a specific URL pattern.
   */
  public async waitForUrl(urlPattern: string, timeoutMs: number = 10000): Promise<void> {
    try {
      const regex = new RegExp(urlPattern);
      await this.page.waitForFunction((pattern: string) => {
        return new RegExp(pattern).test(window.location.href);
      }, { timeout: timeoutMs }, urlPattern);
    } catch (e) {
      throw new Error(`WaitManager: Timeout waiting for URL pattern: ${urlPattern}`);
    }
  }

  /**
   * Universal network idle wait (avoids failing if requests keep trickling in, bounded by timeout).
   */
  public async waitForNetwork(timeoutMs: number = 5000): Promise<void> {
    try {
      await this.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: timeoutMs });
    } catch (e) {
      // Ignore timeout, we just wait opportunistically
    }
  }
}
