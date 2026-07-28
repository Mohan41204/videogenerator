export class StateMachine {
  private currentState: string = 'Unknown';
  private stateHistory: string[] = [];

  /**
   * Updates the current state of the automation flow.
   */
  public transitionTo(newState: string): void {
    if (this.currentState !== newState) {
      this.stateHistory.push(this.currentState);
      this.currentState = newState;
    }
  }

  /**
   * Retrieves the current state.
   */
  public getCurrentState(): string {
    return this.currentState;
  }

  /**
   * Retrieves the history of states visited.
   */
  public getHistory(): string[] {
    return [...this.stateHistory];
  }

  /**
   * Verifies if the current state matches the expected state.
   */
  public isState(expectedState: string): boolean {
    return this.currentState === expectedState;
  }
}
