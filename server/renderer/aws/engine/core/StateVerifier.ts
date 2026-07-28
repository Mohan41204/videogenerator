import { ExpectedState } from '../types';
import { WaitManager } from './WaitManager';
import { StateMachine } from './StateMachine';

export class StateVerifier {
  private waitManager: WaitManager;
  private stateMachine: StateMachine;

  constructor(waitManager: WaitManager, stateMachine: StateMachine) {
    this.waitManager = waitManager;
    this.stateMachine = stateMachine;
  }

  /**
   * Verifies that the expected state has been reached after an action.
   */
  public async verify(expected: ExpectedState): Promise<void> {
    const timeout = expected.timeout || 10000;

    // 1. Verify URL pattern if specified
    if (expected.urlPattern) {
      await this.waitManager.waitForUrl(expected.urlPattern, timeout);
    }

    // 2. Verify element presence if specified
    if (expected.element) {
      await this.waitManager.waitForTarget(expected.element, timeout);
    }

    // 3. Update logical state machine if specified
    if (expected.pageState) {
      this.stateMachine.transitionTo(expected.pageState);
    }
  }
}
