/**
 * ElementResolver.js
 *
 * Replaces the old loose text-matching system.
 * Uses ConfidenceScorer to evaluate all candidates and enforces a strict
 * confidence threshold before returning an element.
 */

const ConfidenceScorer = require('./ConfidenceScorer');

class LowConfidenceMatchError extends Error {
  constructor(message, candidates) {
    super(message);
    this.name = 'LowConfidenceMatchError';
    this.candidates = candidates;
  }
}

class ElementResolver {
  /**
   * Extract comprehensive information about an element for scoring.
   * This is executed inside the browser context.
   */
  static _extractElementInfo(e) {
    const rect = e.getBoundingClientRect();
    const style = window.getComputedStyle(e);
    const tag = e.tagName.toLowerCase();
    
    // Check if element or ancestor is inside a navigation container
    let isInNav = false;
    let ancestor = e;
    for (let i = 0; i < 10 && ancestor; i++) {
      const aTag = ancestor.tagName?.toLowerCase() || '';
      const role = ancestor.getAttribute?.('role') || '';
      const cls = ancestor.className || '';
      if (aTag === 'nav' || role === 'navigation' || 
          /side[-_]?nav|sidebar|navigation/i.test(cls) ||
          /side[-_]?nav|sidebar|navigation/i.test(ancestor.id || '')) {
        isInNav = true;
        break;
      }
      ancestor = ancestor.parentElement;
    }

    // Check viewport visibility
    const isInViewport = (
      rect.top >= 0 &&
      rect.left >= 0 &&
      rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
      rect.right <= (window.innerWidth || document.documentElement.clientWidth)
    );

    return {
      tagName: tag,
      textContent: (e.textContent || '').trim(),
      inputValue: (tag === 'input' || tag === 'textarea') ? (e.value || '') : '',
      placeholder: e.getAttribute('placeholder') || '',
      ariaLabel: e.getAttribute('aria-label') || '',
      role: e.getAttribute('role') || '',
      rect: { width: rect.width, height: rect.height, top: rect.top, left: rect.left },
      // NOTE: opacity is intentionally excluded — AWS tab panels use opacity:0 for animations
      //       and we should still be able to click elements during transitions.
      isHidden: style.display === 'none' || style.visibility === 'hidden',
      isDisabled: e.disabled === true || e.getAttribute('aria-disabled') === 'true',
      isInNav,
      isInViewport
    };
  }

  /**
   * Resolve an element by selector or text, enforcing a confidence threshold.
   *
   * @param {import('puppeteer').Page} page
   * @param {object} params - { selector?, text? }
   * @param {number} [threshold=70] - Minimum confidence score required
   * @returns {Promise<import('puppeteer').ElementHandle>}
   */
  static async resolve(page, params, threshold = 70) {
    if (params.selector) {
      // If a strict CSS selector is provided, trust it (for backward compatibility)
      // but try to pierce shadow DOM
      try {
        let el = await page.$(params.selector) || await page.$(`>>> ${params.selector}`);
        if (el) return el;
      } catch (err) { /* ignore */ }
    }

    const targetText = params.text || params.target?.label;

    if (!targetText) {
      throw new Error('ElementResolver: Neither selector nor text/target.label provided.');
    }

    const escapedText = targetText.replace(/"/g, '\\"');
    let allCandidates = [];

    // Search across all iframes
    for (const frame of page.frames()) {
      if (frame.isDetached()) continue;
      
      try {
        // Query elements containing the text (Shadow DOM pierced via ::-p-text)
        const elements = await frame.$$(`::-p-text(${escapedText})`);
        
        for (const el of elements) {
          const info = await frame.evaluate(ElementResolver._extractElementInfo, el).catch(() => null);
          if (info) {
            const score = ConfidenceScorer.score(info, targetText);
            allCandidates.push({ el, info, score });
          }
        }

        // Fallback: also search input/textarea elements by their value attribute.
        // ::-p-text() only matches textContent, not input.value, so typed-in values
        // (e.g., bucket names, resource names) would be missed without this.
        const inputElements = await frame.$$(`input, textarea`);
        for (const el of inputElements) {
          // Skip if we already have this element from the ::-p-text search
          const alreadyFound = allCandidates.some(c => c.el === el);
          if (alreadyFound) continue;

          const info = await frame.evaluate(ElementResolver._extractElementInfo, el).catch(() => null);
          if (info && info.inputValue) {
            const score = ConfidenceScorer.score(info, targetText);
            if (score > 0) {
              allCandidates.push({ el, info, score });
            }
          }
        }
      } catch (err) {
        // Ignored
      }
    }

    if (allCandidates.length === 0) {
      throw new Error(`ElementResolver: No candidates found for text "${targetText}"`);
    }

    // Sort descending by score
    allCandidates.sort((a, b) => b.score - a.score);
    const bestMatch = allCandidates[0];

    // Log candidates for debugging
    console.log(`\n[ElementResolver] Target: "${targetText}" | Found ${allCandidates.length} candidates`);
    allCandidates.slice(0, 3).forEach((c, i) => {
      const displayText = c.info.inputValue
        ? `value="${c.info.inputValue.substring(0, 40)}"`
        : `"${c.info.textContent.substring(0, 40)}"`;
      console.log(`  Candidate ${i + 1} | Score: ${c.score} | <${c.info.tagName}> ${displayText} | Exact: ${c.info.textContent === targetText} | Visible: ${!c.info.isHidden}`);
    });

    // Enforce Threshold
    if (bestMatch.score < threshold) {
      const msg = `Low confidence match for "${targetText}". Best score: ${bestMatch.score} (Requires: ${threshold}). Rejected candidate: <${bestMatch.info.tagName}> "${bestMatch.info.textContent.substring(0, 40)}"`;
      throw new LowConfidenceMatchError(msg, allCandidates);
    }

    console.log(`[ElementResolver] Selected Candidate 1 (Score: ${bestMatch.score})\n`);
    
    // If the best match is a non-interactive text node but its parent is a link/button, return the parent
    if (!['button', 'a', 'input'].includes(bestMatch.info.tagName)) {
      try {
        const parentInteractive = await bestMatch.el.evaluateHandle(e => {
          let check = e.parentElement;
          for (let i=0; i<5 && check; i++) {
            if (['a', 'button'].includes(check.tagName.toLowerCase()) || check.getAttribute('role') === 'button') {
              return check;
            }
            check = check.parentElement;
          }
          return null;
        });
        
        if (parentInteractive.asElement()) {
           return parentInteractive.asElement();
        }
      } catch { /* Fallback to bestMatch.el */ }
    }

    return bestMatch.el;
  }
}

module.exports = { ElementResolver, LowConfidenceMatchError };
