/**
 * ElementResolver.js
 *
 * Resolves DOM elements for action scripts using a multi-stage pipeline:
 *
 *   1. Gather raw candidates  (::-p-text, input value search, shadow DOM walk)
 *   2. Hard visibility filter  → remove hidden / disabled / zero-size
 *   3. Context scoping         → restrict to container if target.context provided
 *   4. Action-type filter      → isValidCandidateForAction()
 *   5. Label-to-input remap    → for "type" actions on label elements
 *   6. Score survivors          → ConfidenceScorer.score()
 *   7. Sort by score + tie-breakers
 *   8. Threshold check (70)    → accept or reject
 *
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

// ── Action-Type Filtering ─────────────────────────────────────────────────

/**
 * Determine if a candidate element is a valid target for the given action type.
 * This filters BEFORE scoring so wrong-type elements never enter the score pool.
 *
 * @param {object} info - Extracted element info from _extractElementInfo
 * @param {string} action - The action intent ('type', 'click', 'select', etc.)
 * @param {object} [target] - The target descriptor from the action JSON
 * @returns {boolean}
 */
function isValidCandidateForAction(info, action, target = {}) {
  const tag = (info.tagName || '').toLowerCase();
  const role = (info.role || '').toLowerCase();
  const actionLower = (action || '').toLowerCase();

  switch (actionLower) {
    case 'type':
      return (
        tag === 'input' ||
        tag === 'textarea' ||
        info.contentEditable === 'true' ||
        info.contentEditable === '' ||
        role === 'textbox' ||
        role === 'combobox' ||    // Cloudscape search inputs use role="combobox"
        role === 'searchbox'
      );

    case 'click':
    case 'highlight':
    case 'doubleclick': {
      // If the script explicitly says the target is a textbox, allow inputs
      const isInputTarget = target?.type === 'textbox' || target?.type === 'input';
      if (isInputTarget) return true;
      // For click/highlight, exclude bare input/textarea (unless role overrides)
      if ((tag === 'input' || tag === 'textarea') && !['button', 'link', 'menuitem', 'tab', 'option'].includes(role)) {
        return false;
      }
      return true;
    }

    case 'select':
      return (
        tag === 'select' ||
        role === 'combobox' ||
        role === 'listbox' ||
        (role === 'button' && info.ariaHasPopup === 'listbox')
      );

    case 'check':
      return (
        (tag === 'input' && info.inputType === 'checkbox') ||
        role === 'checkbox'
      );

    case 'radio':
      return (
        (tag === 'input' && info.inputType === 'radio') ||
        role === 'radio'
      );

    default:
      // Unknown or no action — allow all
      return true;
  }
}

/**
 * Widened filter — one level broader than isValidCandidateForAction.
 * Used when the strict filter returns zero candidates.
 */
function isValidCandidateWidened(info, action, target = {}) {
  const tag = (info.tagName || '').toLowerCase();
  const role = (info.role || '').toLowerCase();
  const actionLower = (action || '').toLowerCase();

  // First check if the strict filter passes
  if (isValidCandidateForAction(info, action, target)) return true;

  switch (actionLower) {
    case 'type':
      // Widen: also allow contenteditable divs, spans with role=textbox
      return (
        info.contentEditable === 'true' ||
        info.contentEditable === '' ||
        tag === 'div' && role === 'textbox'
      );

    case 'click':
    case 'highlight':
    case 'doubleclick':
      // Widen: allow inputs if they look clickable (button-type inputs)
      return (
        (tag === 'input' && (info.inputType === 'button' || info.inputType === 'submit')) ||
        info.cursorPointer === true
      );

    case 'select':
      // Widen: allow any element with aria-haspopup
      return !!info.ariaHasPopup;

    case 'check':
    case 'radio':
      // Widen: allow label elements near checkboxes
      return tag === 'label';

    default:
      return true;
  }
}

// ── Hard Visibility Filter ────────────────────────────────────────────────

/**
 * Hard visibility check — disqualifies elements that cannot be interacted with.
 * This is a filter, not a scoring signal.
 *
 * @param {object} info - Extracted element info
 * @returns {boolean} true if the element is interactable
 */
function passesVisibilityFilter(info) {
  if (!info) return false;
  if (info.isHidden) return false;
  if (info.isDisabled) return false;
  // Disqualify only if element has no dimensions at all
  if (info.rect.width === 0 && info.rect.height === 0) return false;
  return true;
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
    // Uses getRootNode().host to cross shadow DOM boundaries
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
      // Cross shadow DOM boundary if parentElement is null
      ancestor = ancestor.parentElement || (ancestor.getRootNode?.()?.host) || null;
    }

    // Check if element is inside the AWS unified search dropdown/results container.
    // IMPORTANT: Must NOT match the account-switcher panel, region selector, or
    // breadcrumb dropdowns — those contain account names like "2GO (513...)" that
    // would get a false +200 bonus and beat the real target element.
    // Only the actual [Alt+S] unified search results panel qualifies.
    let isInSearchDropdown = false;
    let searchAncestor = e;
    for (let i = 0; i < 10 && searchAncestor; i++) {
      const cls = typeof searchAncestor.className === 'string' ? searchAncestor.className : '';
      const id = searchAncestor.id || '';
      const testId = searchAncestor.getAttribute?.('data-testid') || '';
      
      // Only match the actual AWS Console unified search results panel.
      // Deliberately exclude: 'dropdown' (too broad — matches account/region pickers),
      //                       'popover'  (too broad — matches tooltip-style menus),
      //                       'portal'   (too broad — matches modal overlays).
      const isSearchResult = (
        /search-result|search__result|search-container/i.test(cls) ||
        /search-result|search__result|search-container/i.test(id) ||
        /search-result|search-results/i.test(testId) ||
        // AWS unified search panel specific identifiers
        /awsc-nav-search|unified-search|global-search/i.test(cls) ||
        /awsc-nav-search|unified-search|global-search/i.test(id) ||
        testId === 'awsc-nav-search-results' ||
        testId === 'search-results-panel'
      );

      // Explicitly exclude the account/region/breadcrumb switcher areas
      // which also use dropdown-like containers but are NOT search results.
      const isAccountOrRegionSwitcher = (
        /account|region|breadcrumb|switcher|profile|organization/i.test(cls) ||
        /account|region|breadcrumb|switcher|profile|organization/i.test(id) ||
        /awsc-nav-account|awsc-nav-region|nav-account|nav-region/i.test(cls) ||
        /awsc-nav-account|awsc-nav-region|nav-account|nav-region/i.test(id) ||
        searchAncestor.getAttribute?.('data-testid') === 'awsc-nav-account-menu' ||
        searchAncestor.getAttribute?.('data-testid') === 'awsc-nav-regions'
      );

      if (isSearchResult && !isAccountOrRegionSwitcher) {
        isInSearchDropdown = true;
        break;
      }
      searchAncestor = searchAncestor.parentElement || (searchAncestor.getRootNode?.()?.host) || null;
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
      inputType: tag === 'input' ? (e.type || '').toLowerCase() : '',
      placeholder: e.getAttribute('placeholder') || '',
      ariaLabel: e.getAttribute('aria-label') || '',
      ariaHasPopup: e.getAttribute('aria-haspopup') || '',
      contentEditable: e.getAttribute('contenteditable') || '',
      role: e.getAttribute('role') || '',
      rect: { width: rect.width, height: rect.height, top: rect.top, left: rect.left },
      // NOTE: opacity is intentionally excluded — AWS tab panels use opacity:0 for animations
      //       and we should still be able to click elements during transitions.
      isHidden: style.display === 'none' || style.visibility === 'hidden',
      isDisabled: e.disabled === true || e.getAttribute('aria-disabled') === 'true',
      isInNav,
      isInViewport,
      isInSearchDropdown,
      cursorPointer: style.cursor === 'pointer'
    };
  }

  /**
   * Attempt to scope candidate search to a context container.
   * If target.context is provided, find a container element matching that
   * context text and return its handle. Returns null if no container found.
   *
   * @param {import('puppeteer').Frame} frame
   * @param {string} contextText
   * @returns {Promise<import('puppeteer').ElementHandle|null>}
   */
  static async _findContextContainer(frame, contextText) {
    if (!contextText || !contextText.trim()) return null;

    try {
      // Strategy: find elements whose text/aria-label matches the context description.
      // Look for section-like containers (section, div, form, fieldset, etc.)
      const container = await frame.evaluateHandle((ctx) => {
        const ctxLower = ctx.toLowerCase().trim();
        const candidates = [];

        // Search for common container elements
        const containerTags = ['section', 'div', 'form', 'fieldset', 'main', 'article', 'aside', 'details'];
        for (const tag of containerTags) {
          const els = document.querySelectorAll(tag);
          for (const el of els) {
            const ariaLabel = (el.getAttribute('aria-label') || '').toLowerCase();
            const heading = el.querySelector('h1, h2, h3, h4, h5, h6, legend, [class*="header"], [class*="title"]');
            const headingText = heading ? (heading.textContent || '').trim().toLowerCase() : '';
            const testId = (el.getAttribute('data-testid') || '').toLowerCase();
            const cls = (typeof el.className === 'string' ? el.className : '').toLowerCase();

            if (ariaLabel.includes(ctxLower) || ctxLower.includes(ariaLabel) ||
                headingText.includes(ctxLower) || ctxLower.includes(headingText) ||
                testId.includes(ctxLower.replace(/\s+/g, '-')) ||
                cls.includes(ctxLower.replace(/\s+/g, '-'))) {
              candidates.push({ el, specificity: (el.textContent || '').length });
            }
          }
        }

        // Prefer the most specific (smallest) container
        candidates.sort((a, b) => a.specificity - b.specificity);
        return candidates.length > 0 ? candidates[0].el : null;
      }, contextText);

      const el = container.asElement();
      if (el) return el;
    } catch { /* ignore */ }

    return null;
  }

  /**
   * Resolve an element by selector or text, enforcing a confidence threshold.
   *
   * @param {import('puppeteer').Page} page
   * @param {object} params - { selector?, text?, target?, action? }
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
    const intent = params.action || '';
    const target = params.target || {};

    if (!targetText) {
      throw new Error('ElementResolver: Neither selector nor text/target.label provided.');
    }

    const escapedText = targetText.replace(/"/g, '\\"');
    let alternateText = null;
    if (targetText.toLowerCase().startsWith('amazon ')) {
      alternateText = targetText.substring(7).trim();
    }

    // ══════════════════════════════════════════════════════════════════
    // STAGE 1: Gather Raw Candidates
    // ══════════════════════════════════════════════════════════════════
    let rawCandidates = [];

    for (const frame of page.frames()) {
      if (frame.isDetached()) continue;
      
      try {
        // ── Strategy 1: ::-p-text() — fast, works on most pages ──────────
        const elements = await frame.$$(`::-p-text(${escapedText})`);
        
        for (const el of elements) {
          const info = await frame.evaluate(ElementResolver._extractElementInfo, el).catch(() => null);
          if (info) {
            rawCandidates.push({ el, info, frame });
          }
        }

        if (alternateText) {
          const escapedAlt = alternateText.replace(/"/g, '\\"');
          const altElements = await frame.$$(`::-p-text(${escapedAlt})`);
          for (const el of altElements) {
            const alreadyFound = rawCandidates.some(c => c.el === el);
            if (alreadyFound) continue;
            const info = await frame.evaluate(ElementResolver._extractElementInfo, el).catch(() => null);
            if (info) {
              rawCandidates.push({ el, info, frame });
            }
          }
        }

        // ── Strategy 2: Input value search ──────────────────────────────
        const searchLower = targetText.toLowerCase();
        const inputElements = await frame.$$(`input, textarea`);
        for (const el of inputElements) {
          const alreadyFound = rawCandidates.some(c => c.el === el);
          if (alreadyFound) continue;

          const info = await frame.evaluate(ElementResolver._extractElementInfo, el).catch(() => null);
          if (info && info.inputValue) {
            const valLower = info.inputValue.toLowerCase();
            if (valLower === searchLower || valLower.includes(searchLower) || searchLower.includes(valLower)) {
              rawCandidates.push({ el, info, frame });
            }
          }
        }

        // ── Strategy 3: Deep shadow DOM walk ─────────────────────────────
        const hasGoodMatch = rawCandidates.some(c => {
          const score = ConfidenceScorer.score(c.info, targetText, intent);
          return score >= 70;
        });

        if (!hasGoodMatch) {
          const deepElements = await frame.evaluateHandle((searchText) => {
            const results = [];
            const searchLower = searchText.toLowerCase().trim();
            
            function walkNode(root) {
              if (root.shadowRoot) {
                walkNode(root.shadowRoot);
              }
              
              const children = root.children || root.childNodes;
              for (let i = 0; i < children.length; i++) {
                const child = children[i];
                if (child.nodeType !== 1) continue;
                
                const tag = child.tagName?.toLowerCase() || '';
                if (['script', 'style', 'noscript', 'meta', 'link'].includes(tag)) continue;
                
                const directText = (child.textContent || '').trim();
                const directTextLower = directText.toLowerCase();
                
                if (directTextLower === searchLower || 
                    directTextLower.includes(searchLower)) {
                  const childTextNodes = child.childElementCount;
                  if (childTextNodes <= 3 || directText.length < searchText.length * 3) {
                    results.push(child);
                  }
                }
                
                const ariaLabel = (child.getAttribute('aria-label') || '').toLowerCase();
                if (ariaLabel === searchLower || ariaLabel.includes(searchLower)) {
                  results.push(child);
                }
                
                if (child.shadowRoot) {
                  walkNode(child.shadowRoot);
                }
                if (child.children && child.children.length > 0) {
                  walkNode(child);
                }
              }
            }
            
            walkNode(document);
            
            const unique = [];
            for (const el of results) {
              const isDuplicate = unique.some(u => u.contains(el) || el.contains(u));
              if (!isDuplicate) {
                unique.push(el);
              } else {
                const containerIdx = unique.findIndex(u => u.contains(el));
                if (containerIdx >= 0) {
                  unique[containerIdx] = el;
                }
              }
            }
            
            return unique.slice(0, 20);
          }, targetText);

          const props = await deepElements.getProperties();
          for (const [, handle] of props) {
            const el = handle.asElement();
            if (!el) continue;
            
            const alreadyFound = rawCandidates.some(c => {
              try { return c.el === el; } catch { return false; }
            });
            if (alreadyFound) continue;

            const info = await frame.evaluate(ElementResolver._extractElementInfo, el).catch(() => null);
            if (info) {
              rawCandidates.push({ el, info, frame });
            }
          }
        }
      } catch (err) {
        // Ignored — continue to next frame
      }
    }

    // ══════════════════════════════════════════════════════════════════
    // STAGE 2: Hard Visibility Filter
    // ══════════════════════════════════════════════════════════════════
    let candidates = rawCandidates.filter(c => passesVisibilityFilter(c.info));

    // ══════════════════════════════════════════════════════════════════
    // STAGE 3: Context Scoping
    // ══════════════════════════════════════════════════════════════════
    if (target.context && target.context.trim()) {
      const contextText = target.context.trim();
      // Try to find a container matching the context
      for (const frame of page.frames()) {
        if (frame.isDetached()) continue;
        const container = await ElementResolver._findContextContainer(frame, contextText);
        if (container) {
          // Filter candidates to only those inside this container
          const scopedCandidates = [];
          for (const c of candidates) {
            try {
              const isInside = await frame.evaluate((el, containerEl) => {
                return containerEl.contains(el);
              }, c.el, container);
              if (isInside) {
                scopedCandidates.push(c);
              }
            } catch { /* skip */ }
          }
          // Only use scoped candidates if we found any
          if (scopedCandidates.length > 0) {
            console.log(`  [ElementResolver] Context scoped to "${contextText}" — ${scopedCandidates.length}/${candidates.length} candidates`);
            candidates = scopedCandidates;
          }
          break;
        }
      }
    }

    // ══════════════════════════════════════════════════════════════════
    // STAGE 4: Action-Type Filter
    // ══════════════════════════════════════════════════════════════════
    let filteredCandidates = candidates;
    let widened = false;

    if (intent) {
      filteredCandidates = candidates.filter(c => isValidCandidateForAction(c.info, intent, target));

      // If strict filter yields nothing, widen by one level
      if (filteredCandidates.length === 0 && candidates.length > 0) {
        filteredCandidates = candidates.filter(c => isValidCandidateWidened(c.info, intent, target));
        if (filteredCandidates.length > 0) {
          widened = true;
          console.warn(`  [ElementResolver] ⚠ WIDENED: Strict filter for "${intent}" yielded 0 candidates. Widened to ${filteredCandidates.length} candidates.`);
        }
      }
    }

    // ══════════════════════════════════════════════════════════════════
    // STAGE 5: Label-to-Input Remap (for "type" action)
    // ══════════════════════════════════════════════════════════════════
    if (intent === 'type' && filteredCandidates.length === 0 && candidates.length > 0) {
      // The strict filter removed everything because all matches are labels/divs.
      // Try to find a nearby input for each label-like candidate.
      console.log(`  [ElementResolver] Label-to-input remap: searching for inputs near ${candidates.length} label candidates...`);

      const remappedCandidates = [];
      for (const candidate of candidates) {
        if (['input', 'textarea'].includes(candidate.info.tagName)) {
          // Already an input — should have passed the filter, but include just in case
          remappedCandidates.push(candidate);
          continue;
        }
        try {
          const inputHandle = await candidate.el.evaluateHandle((el) => {
            // Strategy A: <label for="id"> → getElementById
            const htmlFor = el.getAttribute('for');
            if (htmlFor) {
              const target = document.getElementById(htmlFor);
              if (target && ['input', 'textarea'].includes(target.tagName.toLowerCase())) {
                return target;
              }
            }
            // Strategy B: child input
            const child = el.querySelector('input, textarea, [contenteditable="true"], [role="textbox"]');
            if (child) return child;
            // Strategy C: sibling/parent walk
            let parent = el.parentElement;
            for (let i = 0; i < 5 && parent; i++) {
              const input = parent.querySelector('input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]), textarea, [contenteditable="true"], [role="textbox"]');
              if (input && input !== el) return input;
              parent = parent.parentElement;
            }
            return null;
          });
          const inputEl = inputHandle.asElement();
          if (inputEl) {
            const info = await page.evaluate(ElementResolver._extractElementInfo, inputEl).catch(() => null);
            if (info && passesVisibilityFilter(info)) {
              remappedCandidates.push({
                el: inputEl,
                info,
                frame: candidate.frame,
                remappedFrom: candidate.info.textContent
              });
            }
          }
        } catch (err) { /* ignore */ }
      }

      if (remappedCandidates.length > 0) {
        console.log(`  [ElementResolver] Label-to-input remap: found ${remappedCandidates.length} inputs`);
        filteredCandidates = remappedCandidates;
      }
    }

    if (filteredCandidates.length === 0) {
      throw new Error(`ElementResolver: No candidates found for text "${targetText}" (action: ${intent || 'none'})`);
    }

    // ══════════════════════════════════════════════════════════════════
    // STAGE 6: Score All Surviving Candidates
    // ══════════════════════════════════════════════════════════════════
    let allCandidates = filteredCandidates.map(c => {
      const score = ConfidenceScorer.score(c.info, targetText, intent);
      // If this was remapped from a label, give a bonus for the label match
      let remapBonus = 0;
      if (c.remappedFrom) {
        const remapText = c.remappedFrom.toLowerCase().trim();
        const searchLower = targetText.toLowerCase().trim();
        if (remapText === searchLower || remapText.includes(searchLower)) {
          remapBonus = 30; // The label matched, so the associated input is likely correct
        }
      }
      return { ...c, score: score + remapBonus };
    });

    // ══════════════════════════════════════════════════════════════════
    // STAGE 7: Sort by Score + Tie-Breakers
    // ══════════════════════════════════════════════════════════════════
    const searchLower = targetText.toLowerCase().trim();

    allCandidates.forEach(c => {
      const info = c.info;
      const text = (info.textContent || '').trim().toLowerCase();
      const val = (info.inputValue || '').trim().toLowerCase();
      const label = (info.ariaLabel || '').trim().toLowerCase();
      
      c.exact = (text === searchLower) || (val === searchLower) || (label === searchLower);
      c.visible = !info.isHidden && info.isInViewport;
      c.isInput = ['input', 'textarea'].includes(info.tagName);
      c.clickable = ['button', 'a'].includes(info.tagName) || 
                   ['button', 'link', 'menuitem', 'option', 'tab'].includes(info.role?.toLowerCase());
    });

    allCandidates.sort((a, b) => {
      // 1. Higher score wins
      if (b.score !== a.score) return b.score - a.score;
      
      // 2. Exact text match wins
      if (a.exact !== b.exact) return (b.exact ? 1 : 0) - (a.exact ? 1 : 0);
      
      // 3. Visible element wins
      if (a.visible !== b.visible) return (b.visible ? 1 : 0) - (a.visible ? 1 : 0);
      
      // 4. For click: clickable element wins. For type: input wins.
      if (intent === 'type') {
        if (a.isInput !== b.isInput) return (b.isInput ? 1 : 0) - (a.isInput ? 1 : 0);
      } else {
        if (a.clickable !== b.clickable) return (b.clickable ? 1 : 0) - (a.clickable ? 1 : 0);
        if (a.isInput !== b.isInput) return (a.isInput ? 1 : 0) - (b.isInput ? 1 : 0);
      }
      
      return 0;
    });

    const bestMatch = allCandidates[0];

    // Log candidates for debugging
    const widenedTag = widened ? ' [WIDENED]' : '';
    console.log(`\n[ElementResolver] Target: "${targetText}" (${intent || 'any'})${widenedTag} | Found ${allCandidates.length} candidates`);
    allCandidates.slice(0, 3).forEach((c, i) => {
      const displayText = c.info.inputValue
        ? `value="${c.info.inputValue.substring(0, 40)}"`
        : `"${c.info.textContent.substring(0, 40)}"`;
      const remapNote = c.remappedFrom ? ` [remapped from: "${c.remappedFrom.substring(0, 30)}"]` : '';
      console.log(`  Candidate ${i + 1} | Score: ${c.score} | <${c.info.tagName}> ${displayText} | Exact: ${c.exact} | Visible: ${!c.info.isHidden}${remapNote}`);
    });

    // Enforce Threshold
    if (bestMatch.score < threshold) {
      const msg = `Low confidence match for "${targetText}". Best score: ${bestMatch.score} (Requires: ${threshold}). Rejected candidate: <${bestMatch.info.tagName}> "${bestMatch.info.textContent.substring(0, 40)}"`;
      throw new LowConfidenceMatchError(msg, allCandidates);
    }

    console.log(`[ElementResolver] Selected Candidate 1 (Score: ${bestMatch.score})\n`);
    
    // If the best match is a non-interactive text node but its parent is a link/button, return the parent
    if (intent !== 'type' && !['button', 'a', 'input'].includes(bestMatch.info.tagName)) {
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

module.exports = { ElementResolver, LowConfidenceMatchError, isValidCandidateForAction, passesVisibilityFilter };
