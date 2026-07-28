import { Page, ElementHandle } from 'puppeteer';
import { ElementInfo } from '../types';

export class ScreenRecorder {
  private page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  /**
   * Animates mouse movement to the target, pauses briefly, and highlights it.
   */
  public async animateAndHighlight(element: ElementHandle<Element>, info: ElementInfo): Promise<void> {
    if (!info.isVisible || !info.isInViewport) {
      return; // Never highlight invisible elements
    }

    const box = await element.boundingBox();
    if (!box) return;

    const targetX = box.x + box.width / 2;
    const targetY = box.y + box.height / 2;

    // Smooth mouse movement to the center of the element
    await this.page.mouse.move(targetX, targetY, { steps: 15 });

    // Pause briefly before click
    await new Promise(r => setTimeout(r, 200));

    // Highlight the element
    await this.page.evaluate((el: Element) => {
      const originalOutline = (el as HTMLElement).style.outline;
      const originalBoxShadow = (el as HTMLElement).style.boxShadow;
      const originalTransition = (el as HTMLElement).style.transition;

      (el as HTMLElement).style.transition = 'all 0.2s ease-in-out';
      (el as HTMLElement).style.outline = '3px solid #ff0000';
      (el as HTMLElement).style.boxShadow = '0 0 10px 3px rgba(255, 0, 0, 0.5)';

      // Remove highlight after a short delay
      setTimeout(() => {
        (el as HTMLElement).style.outline = originalOutline;
        (el as HTMLElement).style.boxShadow = originalBoxShadow;
        (el as HTMLElement).style.transition = originalTransition;
      }, 500);
    }, element);

    // Wait for the highlight animation to start
    await new Promise(r => setTimeout(r, 100));
  }
}
