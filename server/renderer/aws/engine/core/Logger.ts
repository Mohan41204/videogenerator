import { AutomationStep, CandidateElement } from '../types';

export class Logger {
  public static logStepStart(stepNumber: number, step: AutomationStep, currentState: string) {
    console.log(`\n====================================================`);
    console.log(`Step ${stepNumber}`);
    console.log(`Current State: ${currentState}`);
    console.log(`Target: ${JSON.stringify(step.target)}`);
    console.log(`Action: ${step.action.toUpperCase()}`);
    console.log(`====================================================`);
  }

  public static logCandidates(candidates: CandidateElement[]) {
    console.log(`Candidates: ${candidates.length}`);
    if (candidates.length > 0) {
      console.log(`Best Score: ${candidates[0].score}`);
      console.log(`Visible: ${candidates[0].info.isVisible ? 'YES' : 'NO'}`);
      console.log(`Enabled: ${candidates[0].info.isEnabled ? 'YES' : 'NO'}`);
    }
  }

  public static logActionSuccess(durationMs: number) {
    console.log(`Click/Type: SUCCESS`);
    console.log(`Execution Time: ${durationMs}ms`);
  }

  public static logVerification(expected: any, passed: boolean) {
    if (expected) {
      console.log(`Expected: ${JSON.stringify(expected)}`);
      console.log(`Verification: ${passed ? 'PASSED' : 'FAILED'}`);
    } else {
      console.log(`Verification: N/A`);
    }
  }

  public static logError(message: string) {
    console.error(`\n[ERROR] ${message}`);
  }
}
