import { ActionTarget, ElementInfo } from '../types';

export class CandidateScorer {
  /**
   * Evaluates an element against the target criteria and returns a score.
   * Higher score means a better match.
   */
  public static score(info: ElementInfo, target: ActionTarget): number {
    let score = 0;

    // 1. Role match (+40)
    if (target.role && info.role.toLowerCase() === target.role.toLowerCase()) {
      score += 40;
    } else if (target.role && info.tagName.toLowerCase() === target.role.toLowerCase()) {
      // Fallback: If role wasn't explicitly set but tag name matches requested role (e.g., 'button' -> <button>)
      score += 30;
    }

    // 2. Accessible Name match (+30)
    if (target.name) {
      if (info.accessibleName.toLowerCase() === target.name.toLowerCase()) {
        score += 30;
      } else if (target.fuzzy && info.accessibleName.toLowerCase().includes(target.name.toLowerCase())) {
        score += 15;
      }
    }

    // 3. Text match (Exact: +15, Partial: +10, Fuzzy: +5)
    if (target.text) {
      const targetTextLower = target.text.toLowerCase().trim();
      const infoTextLower = info.textContent.toLowerCase().trim();

      if (infoTextLower === targetTextLower) {
        score += 15;
      } else if (infoTextLower.includes(targetTextLower)) {
        score += 10;
      } else if (target.fuzzy && this.fuzzyMatch(infoTextLower, targetTextLower)) {
        score += 5;
      }
    }

    // 4. Visibility (+15)
    if (info.isVisible && info.isAttached) {
      score += 15;
    }

    // 5. Enabled (+10)
    if (info.isEnabled) {
      score += 10;
    }

    // 6. In viewport (+5)
    if (info.isInViewport) {
      score += 5;
    }

    return score;
  }

  /**
   * Simple fuzzy match implementation (e.g., Levenshtein or just normalized comparison).
   * For now, just removing spaces and ignoring case.
   */
  private static fuzzyMatch(actual: string, target: string): boolean {
    const normalize = (str: string) => str.replace(/\s+/g, '').toLowerCase();
    const normActual = normalize(actual);
    const normTarget = normalize(target);
    return normActual.includes(normTarget) || normTarget.includes(normActual);
  }
}
