import { ElementHandle } from 'puppeteer';

export class VisibilityChecker {
  /**
   * Verifies that the element is visible, enabled, stable, and brings it into viewport if necessary.
   */
  public static async ensureVisibleAndInteractable(element: ElementHandle<Element>): Promise<void> {
    // 1. Check if it's attached to the DOM
    const isAttached = await element.evaluate((e) => e.isConnected);
    if (!isAttached) {
      throw new Error('VisibilityChecker: Element is detached from DOM.');
    }

    // 2. Scroll into view if needed
    const isInViewport = await element.isIntersectingViewport();
    if (!isInViewport) {
      await element.scrollIntoView();
      // Brief pause for any smooth scrolling animations to finish
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // 3. Check bounding box (it should have area)
    const box = await element.boundingBox();
    if (!box || box.width === 0 || box.height === 0) {
      throw new Error('VisibilityChecker: Element has no bounding box (invisible).');
    }

    // 4. Check if covered by another element (optional but recommended for clickability)
    const isObscured = await element.evaluate((e: Element) => {
      const rect = e.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      const topElement = document.elementFromPoint(x, y);
      
      // If no element at that point, or it is the element itself or a descendant
      if (!topElement) return false;
      if (e.contains(topElement) || topElement.contains(e)) return false;

      // Some AWS overlays use opacity or pointer-events: none, which might still be the "top" element
      const topStyle = window.getComputedStyle(topElement);
      if (topStyle.pointerEvents === 'none') return false;

      return true;
    });

    if (isObscured) {
      throw new Error('VisibilityChecker: Element is obscured by another element.');
    }

    // 5. Check if it's disabled
    const isDisabled = await element.evaluate((e: Element) => {
      return (e as HTMLButtonElement).disabled || e.getAttribute('aria-disabled') === 'true';
    });

    if (isDisabled) {
      throw new Error('VisibilityChecker: Element is disabled.');
    }
  }
}
