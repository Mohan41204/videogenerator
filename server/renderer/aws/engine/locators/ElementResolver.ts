import { Page, ElementHandle } from 'puppeteer';
import { ActionTarget, CandidateElement, ElementInfo } from '../types';
import { CandidateScorer } from './CandidateScorer';

export class ElementResolver {
  private page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  /**
   * Resolves the best candidate element for the given target.
   * If threshold is not met, throws an error.
   */
  public async resolve(target: ActionTarget, minScore: number = 70): Promise<CandidateElement> {
    const candidates = await this.findAllCandidates(target);

    if (candidates.length === 0) {
      throw new Error(`ElementResolver: No candidates found for target: ${JSON.stringify(target)}`);
    }

    // Sort descending by score
    candidates.sort((a, b) => b.score - a.score);
    const bestMatch = candidates[0];

    if (bestMatch.score < minScore) {
      throw new Error(
        `ElementResolver: Best candidate score (${bestMatch.score}) is below threshold (${minScore}) for target: ${JSON.stringify(target)}`
      );
    }

    return bestMatch;
  }

  /**
   * Uses multiple strategies to find all possible matching elements.
   */
  private async findAllCandidates(target: ActionTarget): Promise<CandidateElement[]> {
    const candidateMap = new Map<string, CandidateElement>();

    const evaluateAndAdd = async (elements: ElementHandle<Element>[]) => {
      for (const el of elements) {
        // Try to get a unique identifier for the element to avoid duplicates
        const uniqueId = await el.evaluate((e: Element) => {
           if (!e.getAttribute('data-automation-id')) {
              e.setAttribute('data-automation-id', Math.random().toString(36).substr(2, 9));
           }
           return e.getAttribute('data-automation-id')!;
        });

        if (candidateMap.has(uniqueId)) continue;

        const info = await this.extractElementInfo(el);
        if (info) {
          const score = CandidateScorer.score(info, target);
          candidateMap.set(uniqueId, { elementHandle: el, score, info });
        }
      }
    };

    // Strategy 1: Test ID (Highest priority if present)
    if (target.testId) {
      const els = await this.page.$$(`[data-testid="${target.testId}"]`);
      await evaluateAndAdd(els);
    }

    // Strategy 2: CSS Selector
    if (target.selector) {
      try {
        const els = await this.page.$$(target.selector);
        await evaluateAndAdd(els);
      } catch (e) {
        // Ignore invalid selectors
      }
    }

    // Strategy 3: XPath
    if (target.xpath) {
      try {
        const els = await this.page.$x(target.xpath) as ElementHandle<Element>[];
        await evaluateAndAdd(els);
      } catch (e) {
        // Ignore invalid xpath
      }
    }

    // Strategy 4: Role & Name (ARIA)
    // Puppeteer's ARIA handler: p-aria
    if (target.role || target.name) {
      let ariaSelector = '';
      if (target.name && target.role) {
        ariaSelector = `[name="${target.name}"][role="${target.role}"]`;
      } else if (target.name) {
        ariaSelector = `[name="${target.name}"]`;
      } else if (target.role) {
        ariaSelector = `[role="${target.role}"]`;
      }
      
      try {
        const els = await this.page.$$(`aria/${ariaSelector}`);
        await evaluateAndAdd(els);
      } catch (e) {
        // Fallback to searching all elements if aria handler fails
      }
    }

    // Strategy 5: Text Search (Shadow DOM Piercing)
    if (target.text || target.name) {
      const searchString = target.text || target.name;
      if (searchString) {
        const escapedText = searchString.replace(/"/g, '\\"');
        try {
          const els = await this.page.$$(`::-p-text(${escapedText})`);
          await evaluateAndAdd(els);
        } catch (e) {
          // Ignored
        }
      }
    }

    return Array.from(candidateMap.values());
  }

  /**
   * Extracts comprehensive info from an element handle by evaluating in browser context.
   */
  private async extractElementInfo(el: ElementHandle<Element>): Promise<ElementInfo | null> {
    try {
      return await el.evaluate((e: Element): ElementInfo => {
        const rect = e.getBoundingClientRect();
        const style = window.getComputedStyle(e);
        const htmlElement = e as HTMLElement;
        const buttonElement = e as HTMLButtonElement;

        const isVisible = (
          style.display !== 'none' &&
          style.visibility !== 'hidden' &&
          rect.width > 0 &&
          rect.height > 0
        );

        const isInViewport = (
          rect.top >= 0 &&
          rect.left >= 0 &&
          rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
          rect.right <= (window.innerWidth || document.documentElement.clientWidth)
        );

        return {
          tagName: e.tagName.toLowerCase(),
          role: e.getAttribute('role') || '',
          accessibleName: e.getAttribute('aria-label') || htmlElement.title || e.textContent?.trim() || '',
          textContent: e.textContent?.trim() || '',
          isVisible,
          isEnabled: !buttonElement.disabled && e.getAttribute('aria-disabled') !== 'true',
          isInViewport,
          isAttached: e.isConnected,
          className: e.className || '',
          id: e.id || ''
        };
      });
    } catch (e) {
      return null; // Element might have been detached
    }
  }
}
