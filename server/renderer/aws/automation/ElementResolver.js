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

    // Check if element is inside the AWS unified search dropdown/results container
    let isInSearchDropdown = false;
    let searchAncestor = e;
    for (let i = 0; i < 10 && searchAncestor; i++) {
      const cls = typeof searchAncestor.className === 'string' ? searchAncestor.className : '';
      const id = searchAncestor.id || '';
      const testId = searchAncestor.getAttribute?.('data-testid') || '';
      const ariaLabel = searchAncestor.getAttribute?.('aria-label') || '';
      
      if (/search-result|search__result|dropdown|popover|portal|search-container/i.test(cls) ||
          /search-result|search__result|dropdown|popover|portal|search-container/i.test(id) ||
          /search-result|search-results/i.test(testId) ||
          /search/i.test(ariaLabel)) {
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
      placeholder: e.getAttribute('placeholder') || '',
      ariaLabel: e.getAttribute('aria-label') || '',
      role: e.getAttribute('role') || '',
      rect: { width: rect.width, height: rect.height, top: rect.top, left: rect.left },
      // NOTE: opacity is intentionally excluded — AWS tab panels use opacity:0 for animations
      //       and we should still be able to click elements during transitions.
      isHidden: style.display === 'none' || style.visibility === 'hidden',
      isDisabled: e.disabled === true || e.getAttribute('aria-disabled') === 'true',
      isInNav,
      isInViewport,
      isInSearchDropdown
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
    const intent = params.action || '';

    if (!targetText) {
      throw new Error('ElementResolver: Neither selector nor text/target.label provided.');
    }

    const escapedText = targetText.replace(/"/g, '\\"');
    let alternateText = null;
    if (targetText.toLowerCase().startsWith('amazon ')) {
      alternateText = targetText.substring(7).trim();
    }
    let allCandidates = [];

    // Search across all iframes
    for (const frame of page.frames()) {
      if (frame.isDetached()) continue;
      
      try {
        // ── Strategy 1: ::-p-text() — fast, works on most pages ──────────
        const elements = await frame.$$(`::-p-text(${escapedText})`);
        
        for (const el of elements) {
          const info = await frame.evaluate(ElementResolver._extractElementInfo, el).catch(() => null);
          if (info) {
            const score = ConfidenceScorer.score(info, targetText);
            allCandidates.push({ el, info, score });
          }
        }

        if (alternateText) {
          const escapedAlt = alternateText.replace(/"/g, '\\"');
          const altElements = await frame.$$(`::-p-text(${escapedAlt})`);
          for (const el of altElements) {
            const alreadyFound = allCandidates.some(c => c.el === el);
            if (alreadyFound) continue;

            const info = await frame.evaluate(ElementResolver._extractElementInfo, el).catch(() => null);
            if (info) {
              const score = ConfidenceScorer.score(info, alternateText);
              allCandidates.push({ el, info, score });
            }
          }
        }

        // ── Strategy 2: Input value search (only if value matches target) ──
        // ::-p-text() doesn't match input.value, so we search inputs separately.
        // IMPORTANT: Only include inputs whose value actually relates to the target text.
        const searchLower = targetText.toLowerCase();
        const inputElements = await frame.$$(`input, textarea`);
        for (const el of inputElements) {
          const alreadyFound = allCandidates.some(c => c.el === el);
          if (alreadyFound) continue;

          const info = await frame.evaluate(ElementResolver._extractElementInfo, el).catch(() => null);
          if (info && info.inputValue) {
            const valLower = info.inputValue.toLowerCase();
            // Only include if the input value actually matches the search target
            if (valLower === searchLower || valLower.includes(searchLower) || searchLower.includes(valLower)) {
              const score = ConfidenceScorer.score(info, targetText);
              if (score > 0) {
                allCandidates.push({ el, info, score });
              }
            }
          }
        }

        // ── Strategy 3: Deep shadow DOM walk ─────────────────────────────
        // AWS Console (Cloudscape) uses Web Components with shadow DOM that
        // ::-p-text() often fails to pierce. Do a manual recursive DOM walk
        // to find elements containing the target text inside shadow roots.
        const hasGoodMatch = allCandidates.some(c => c.score >= 70);
        if (!hasGoodMatch) {
          const deepElements = await frame.evaluateHandle((searchText) => {
            const results = [];
            const searchLower = searchText.toLowerCase().trim();
            
            function walkNode(root) {
              // Check shadow roots
              if (root.shadowRoot) {
                walkNode(root.shadowRoot);
              }
              
              const children = root.children || root.childNodes;
              for (let i = 0; i < children.length; i++) {
                const child = children[i];
                if (child.nodeType !== 1) continue; // Only Element nodes
                
                const tag = child.tagName?.toLowerCase() || '';
                // Skip script, style, svg internals
                if (['script', 'style', 'noscript', 'meta', 'link'].includes(tag)) continue;
                
                // Check this element's direct text (not deeply nested children's text)
                const directText = (child.textContent || '').trim();
                const directTextLower = directText.toLowerCase();
                
                if (directTextLower === searchLower || 
                    directTextLower.includes(searchLower)) {
                  // Prefer more specific (leaf-like) elements
                  const childTextNodes = child.childElementCount;
                  if (childTextNodes <= 3 || directText.length < searchText.length * 3) {
                    results.push(child);
                  }
                }
                
                // Also check aria-label
                const ariaLabel = (child.getAttribute('aria-label') || '').toLowerCase();
                if (ariaLabel === searchLower || ariaLabel.includes(searchLower)) {
                  results.push(child);
                }
                
                // Recurse into shadow roots and children
                if (child.shadowRoot) {
                  walkNode(child.shadowRoot);
                }
                // Recurse into children (but limit depth to avoid performance issues)
                if (child.children && child.children.length > 0) {
                  walkNode(child);
                }
              }
            }
            
            walkNode(document);
            
            // Deduplicate — keep the most specific (smallest textContent) version
            const unique = [];
            for (const el of results) {
              const isDuplicate = unique.some(u => u.contains(el) || el.contains(u));
              if (!isDuplicate) {
                unique.push(el);
              } else {
                // If this element is more specific (contained by existing), replace
                const containerIdx = unique.findIndex(u => u.contains(el));
                if (containerIdx >= 0) {
                  unique[containerIdx] = el; // Replace with more specific element
                }
              }
            }
            
            return unique.slice(0, 20); // Cap to prevent performance issues
          }, targetText);

          // Convert JSHandles to ElementHandles and score them
          const props = await deepElements.getProperties();
          for (const [, handle] of props) {
            const el = handle.asElement();
            if (!el) continue;
            
            const alreadyFound = allCandidates.some(c => {
              try { return c.el === el; } catch { return false; }
            });
            if (alreadyFound) continue;

            const info = await frame.evaluate(ElementResolver._extractElementInfo, el).catch(() => null);
            if (info && !info.isHidden) {
              const score = ConfidenceScorer.score(info, targetText);
              if (score > 0) {
                allCandidates.push({ el, info, score });
              }
            }
          }
        }
      } catch (err) {
        // Ignored — continue to next frame
      }
    }

    // ── 1. Separate actions by intent ─────────────────────────────────────
    if (intent === 'type') {
      const mappedCandidates = [];
      for (const candidate of allCandidates) {
        if (['input', 'textarea'].includes(candidate.info.tagName)) {
          mappedCandidates.push(candidate);
        } else {
          try {
            const inputHandle = await candidate.el.evaluateHandle((el) => {
              const htmlFor = el.getAttribute('for');
              if (htmlFor) {
                const target = document.getElementById(htmlFor);
                if (target && ['input', 'textarea'].includes(target.tagName.toLowerCase())) {
                  return target;
                }
              }
              const child = el.querySelector('input, textarea');
              if (child) return child;
              let parent = el.parentElement;
              for (let i = 0; i < 4 && parent; i++) {
                const input = parent.querySelector('input, textarea');
                if (input) return input;
                parent = parent.parentElement;
              }
              return null;
            });
            const inputEl = inputHandle.asElement();
            if (inputEl) {
              const info = await page.evaluate(ElementResolver._extractElementInfo, inputEl).catch(() => null);
              if (info) {
                mappedCandidates.push({
                  el: inputEl,
                  info,
                  score: candidate.score
                });
              }
            }
          } catch (err) {
            // Ignore
          }
        }
      }
      allCandidates = mappedCandidates;
    }

    if (intent === 'click' || intent === 'highlight') {
      const isInputTarget = params.target?.type === 'textbox' || params.target?.type === 'input';
      if (!isInputTarget) {
        allCandidates = allCandidates.filter(c => !['input', 'textarea'].includes(c.info.tagName));
      }
    } else if (intent === 'type') {
      allCandidates = allCandidates.filter(c => ['input', 'textarea'].includes(c.info.tagName));
    }

    if (allCandidates.length === 0) {
      throw new Error(`ElementResolver: No candidates found for text "${targetText}"`);
    }

    // ── 2. Add deterministic tie-breakers ────────────────────────────────
    const searchLower = targetText.toLowerCase().trim();
    
    // Pre-calculate properties for sorting
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

    // Sort using tie-breakers
    allCandidates.sort((a, b) => {
      // 1. Higher score wins
      if (b.score !== a.score) return b.score - a.score;
      
      // 2. Exact text match wins
      if (a.exact !== b.exact) return (b.exact ? 1 : 0) - (a.exact ? 1 : 0);
      
      // 3. Visible element wins
      if (a.visible !== b.visible) return (b.visible ? 1 : 0) - (a.visible ? 1 : 0);
      
      // 4. Clickable element wins
      if (a.clickable !== b.clickable) return (b.clickable ? 1 : 0) - (a.clickable ? 1 : 0);
      
      // 5. Prefer non-input elements for generic clicks
      if (a.isInput !== b.isInput) return (a.isInput ? 1 : 0) - (b.isInput ? 1 : 0);
      
      return 0;
    });

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
