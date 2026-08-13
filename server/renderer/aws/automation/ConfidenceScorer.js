/**
 * ConfidenceScorer.js
 *
 * Implements a heuristic scoring algorithm to determine how likely
 * a given DOM element is the correct target for an action.
 *
 * Evaluates candidates across multiple dimensions (text match, ARIA, visibility, interactivity)
 * to assign a confidence score.
 *
 * SCORING STRATEGY (additive accumulation):
 *   Each signal contributes independently — an element can earn points from
 *   multiple sources (e.g., exact text + aria-label + visibility + interactivity).
 *   Hidden/disabled/zero-size elements are hard-disqualified (return 0).
 */

class ConfidenceScorer {
  /**
   * Calculate a confidence score for a single element candidate.
   *
   * @param {object} info - Information extracted from the DOM about the candidate.
   * @param {string} targetText - The text the engine is looking for.
   * @param {string} [action] - The action intent ('click', 'type', 'select', etc.)
   * @returns {number} Score from 0 upward. 0 = disqualified.
   */
  static score(info, targetText, action = '') {
    if (!info) return 0;

    const searchTarget = (targetText || '').trim().toLowerCase();

    // ── Hard Disqualifiers ───────────────────────────────────────────
    // These override everything — element cannot be interacted with.
    if (info.isHidden) {
      return 0;
    }
    if (info.isDisabled) {
      return 0;
    }
    // Zero-dimension elements are not interactable
    if (info.rect.width === 0 && info.rect.height === 0) {
      return 0;
    }

    let score = 0;

    // ── Text & Label Matching (Additive) ─────────────────────────────
    // Each signal contributes independently.
    const textContent = (info.textContent || '').trim();
    const textLower = textContent.toLowerCase();
    const ariaLabel = (info.ariaLabel || '').trim().toLowerCase();
    const inputValue = (info.inputValue || '').trim().toLowerCase();
    const placeholder = (info.placeholder || '').trim().toLowerCase();

    // Signal 1: Exact text match (case-sensitive first, then case-insensitive)
    // Weight is 50 (was 40) so that exact + visible + small-element = 50+20+5 = 75,
    // which clears the 70 threshold even on bare <span>/<div> elements (Cloudscape pattern).
    let exactTextMatch = false;
    if (textContent === targetText) {
      score += 50;
      exactTextMatch = true;
    } else if (textLower === searchTarget) {
      score += 45;
      exactTextMatch = true;
    } else if (textLower.includes(searchTarget)) {
      // Partial text match — bonus by length proximity
      const lengthDiff = Math.abs(textLower.length - searchTarget.length);
      score += Math.max(5, 15 - lengthDiff);
    }

    // Signal 2: Aria-label match
    if (ariaLabel === searchTarget) {
      score += 35;
    } else if (ariaLabel && ariaLabel.includes(searchTarget)) {
      score += 12;
    }

    // Signal 3: Placeholder match
    if (placeholder === searchTarget) {
      score += 20;
    } else if (placeholder && placeholder.includes(searchTarget)) {
      score += 8;
    }

    // Signal 4: Input value match
    if (inputValue && inputValue === searchTarget) {
      score += 30;
    } else if (inputValue && (inputValue.includes(searchTarget) || searchTarget.includes(inputValue))) {
      const lengthDiff = Math.abs(inputValue.length - searchTarget.length);
      score += Math.max(3, 10 - lengthDiff);
    }

    // ── Interactivity & Role (Action-Aware) ──────────────────────────
    const tag = info.tagName.toLowerCase();
    const role = (info.role || '').toLowerCase();
    const actionLower = (action || '').toLowerCase();

    // Base interactivity scores
    if (tag === 'button' || role === 'button') {
      score += actionLower === 'click' || actionLower === 'highlight' ? 30 : 15;
    } else if (tag === 'a' || role === 'link') {
      score += actionLower === 'click' || actionLower === 'highlight' ? 30 : 15;
    } else if (role === 'menuitem' || role === 'tab') {
      score += actionLower === 'click' || actionLower === 'highlight' ? 25 : 12;
    } else if (tag === 'option' || role === 'option') {
      score += actionLower === 'select' ? 25 : 12;
    } else if (tag === 'input' || tag === 'textarea') {
      score += actionLower === 'type' ? 30 : 5;
    } else if (tag === 'select') {
      score += actionLower === 'select' ? 25 : 10;
    } else if (tag === 'label') {
      score += 5;
    }

    // ── Context & Visibility (Bonus Weight) ──────────────────────────
    if (info.isInViewport) {
      score += 20; // Visibly on screen right now
    }

    // Composite bonus: exact text match + currently visible in viewport.
    // AWS Cloudscape wraps button labels in <span> elements that have no button
    // role themselves. Without this bonus, an exact-match visible <span> only
    // reaches 50+20+5 = 75 which is fine, but this bonus also ensures that
    // elements near the viewport edge (isInViewport=false) can still qualify
    // when they are an exact match (e.g. scrolled-to elements).
    if (exactTextMatch && !info.isHidden) {
      score += 10; // Exact-match visible element bonus
    }

    if (info.isInNav) {
      score += 15; // Elements in sidebars/navbars are common targets
    }

    if (info.isInSearchDropdown) {
      score += 200; // Prioritize dropdown elements over general page content
    }

    // Cursor-pointer bonus for click/highlight: AWS buttons, links, and
    // clickable rows often set cursor:pointer even on inner <span> elements.
    if ((actionLower === 'click' || actionLower === 'highlight') && info.cursorPointer) {
      score += 10;
    }

    // Specificity Bonus: Smaller elements (like buttons) score slightly higher
    // than massive container divs
    if (info.rect.width > 0 && info.rect.width < 500 && info.rect.height < 100) {
      score += 5;
    }

    // Small penalty for zero-width OR zero-height (but not both, which was hard-disqualified above).
    // AWS Shadow DOM elements sometimes report 0 width/height on inner spans.
    // EXCEPTION: skip this penalty when there is an exact text match — short labels
    // like "0","1","2","3" (used in VPC subnet pickers, EC2 AZ counts, RDS replica
    // selectors, etc.) are legitimately very narrow elements and must not lose points
    // just for their size. If the text is right, the size doesn't matter.
    if ((info.rect.width === 0 || info.rect.height === 0) && !exactTextMatch) {
      score -= 15;
    }

    return score;
  }
}

module.exports = ConfidenceScorer;
