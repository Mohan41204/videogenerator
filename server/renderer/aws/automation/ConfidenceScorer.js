/**
 * ConfidenceScorer.js
 *
 * Implements a heuristic scoring algorithm to determine how likely
 * a given DOM element is the correct target for an action.
 *
 * Evaluates candidates across multiple dimensions (text match, ARIA, visibility, interactivity)
 * to assign a confidence score.
 */

class ConfidenceScorer {
  /**
   * Calculate a confidence score for a single element candidate.
   * 
   * @param {object} info - Information extracted from the DOM about the candidate.
   * @param {string} targetText - The text the engine is looking for.
   * @returns {number} Score from -100 to ~200+
   */
  static score(info, targetText) {
    let score = 0;
    const searchTarget = (targetText || '').trim().toLowerCase();
    
    if (!info) return -100;

    // ── Negative Indicators (Disqualifiers) ─────────────────────────
    if (info.isHidden) {
      return -100; // Completely hidden via display/visibility
    }
    
    // AWS Shadow DOM elements sometimes report 0 width/height on inner spans.
    // We shouldn't instantly disqualify them, but we should penalize them 
    // so larger, clickable parents win if they exist.
    if (info.rect.width === 0 || info.rect.height === 0) {
      score -= 30;
    }
    if (info.isDisabled) {
      score -= 100; // Do not interact with disabled elements unless absolutely necessary
    }

    // ── Text & Label Matching (Highest Weight) ──────────────────────
    const textContent = (info.textContent || '').trim();
    const textLower = textContent.toLowerCase();
    const ariaLabel = (info.ariaLabel || '').trim().toLowerCase();
    const inputValue = (info.inputValue || '').trim().toLowerCase();
    const placeholder = (info.placeholder || '').trim().toLowerCase();
    
    // 1. Exact Match (textContent)
    if (textContent === targetText) {
      score += 100;
    } 
    // 2. Normalized Exact Match (case-insensitive)
    else if (textLower === searchTarget) {
      score += 90;
    }
    // 3. Input value exact match (for typed-in values like bucket names)
    else if (inputValue && inputValue === searchTarget) {
      score += 85;
    }
    // 4. ARIA Label Match
    else if (ariaLabel === searchTarget) {
      score += 80;
    }
    // 5. Placeholder exact match
    else if (placeholder && placeholder === searchTarget) {
      score += 75;
    }
    // 6. Partial Text Match (textContent, ariaLabel, inputValue, placeholder)
    else if (textLower.includes(searchTarget) || ariaLabel.includes(searchTarget) ||
             inputValue.includes(searchTarget) || placeholder.includes(searchTarget)) {
      score += 10;
      // Bonus if the partial match is the prefix or very close in length
      const matchSource = inputValue.includes(searchTarget) ? inputValue :
                          textLower.includes(searchTarget) ? textLower : ariaLabel;
      const lengthDiff = Math.abs(matchSource.length - searchTarget.length);
      if (lengthDiff < 10) {
        score += (10 - lengthDiff); // Smaller difference = higher bonus
      }
    }

    // ── Interactivity & Role (Medium Weight) ──────────────────────
    const tag = info.tagName.toLowerCase();
    const isInteractiveTag = ['button', 'a', 'input', 'select', 'textarea'].includes(tag);
    
    if (isInteractiveTag) {
      score += 20; // It's natively clickable
    }
    
    if (info.role === 'button' || info.role === 'link' || info.role === 'tab' || info.role === 'menuitem') {
      score += 20; // Explicitly declared as clickable via ARIA
    }

    // ── Context & Visibility (Bonus Weight) ─────────────────────────
    if (info.isInViewport) {
      score += 20; // Visibly on screen right now
    }
    
    if (info.isInNav) {
      score += 15; // Elements in sidebars/navbars are common targets
    }

    // Specificity Bonus: Smaller elements (like buttons) score slightly higher than massive container divs
    if (info.rect.width > 0 && info.rect.width < 500 && info.rect.height < 100) {
      score += 5;
    }

    return score;
  }
}

module.exports = ConfidenceScorer;
