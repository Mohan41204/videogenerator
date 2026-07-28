import { Page } from 'puppeteer';
import { AutomationStep, ExecutionOptions, ExecutionResult } from '../types';
import { ElementResolver } from '../locators/ElementResolver';
import { VisibilityChecker } from '../locators/VisibilityChecker';
import { ScreenRecorder } from '../media/ScreenRecorder';
import { StateMachine } from './StateMachine';
import { StateVerifier } from './StateVerifier';
import { WaitManager } from './WaitManager';
import { RetryManager } from '../recovery/RetryManager';
import { RecoveryManager } from '../recovery/RecoveryManager';
import { Logger } from './Logger';

export class ActionExecutor {
  private page: Page;
  private stateMachine: StateMachine;
  private waitManager: WaitManager;
  private stateVerifier: StateVerifier;
  private screenRecorder: ScreenRecorder;
  private recoveryManager: RecoveryManager;

  constructor(page: Page) {
    this.page = page;
    this.stateMachine = new StateMachine();
    this.waitManager = new WaitManager(page);
    this.stateVerifier = new StateVerifier(this.waitManager, this.stateMachine);
    this.screenRecorder = new ScreenRecorder(page);
    this.recoveryManager = new RecoveryManager(page);
  }

  /**
   * Executes a series of automation steps.
   */
  public async executeSteps(steps: AutomationStep[], options: ExecutionOptions = {}): Promise<void> {
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const stepNumber = i + 1;

      try {
        await this.executeStep(stepNumber, step, options);
      } catch (error) {
        // Recover and report error, then halt execution to prevent cascading failures
        const reportPath = await this.recoveryManager.generateDiagnosticReport(stepNumber, error as Error);
        Logger.logError(`Execution halted at step ${stepNumber}. Diagnostic report generated at: ${reportPath}`);
        throw error;
      }
    }
  }

  /**
   * Orchestrates a single step execution through the entire pipeline with retries.
   */
  private async executeStep(stepNumber: number, step: AutomationStep, options: ExecutionOptions): Promise<void> {
    const maxRetries = options.maxRetries || 3;
    
    Logger.logStepStart(stepNumber, step, this.stateMachine.getCurrentState());

    await RetryManager.executeWithRetry(`Step ${stepNumber}: ${step.action}`, maxRetries, async () => {
      const startTime = Date.now();
      const resolver = new ElementResolver(this.page);

      // 1. Resolve Element (if target is provided)
      let candidate = null;
      if (step.target) {
        candidate = await resolver.resolve(step.target);
        Logger.logCandidates([candidate]);

        // 2. Verify Visibility and Scroll
        await VisibilityChecker.ensureVisibleAndInteractable(candidate.elementHandle);

        // 3. Highlight and Animate Cursor
        if (options.recordVideo !== false) {
          await this.screenRecorder.animateAndHighlight(candidate.elementHandle, candidate.info);
        }
      }

      // 4. Perform Action
      if (options.slowMo) {
        await new Promise(r => setTimeout(r, options.slowMo));
      }

      if (step.action === 'click' && candidate) {
        await candidate.elementHandle.click();
      } else if (step.action === 'type' && candidate && step.value !== undefined) {
        // Clear before typing
        await candidate.elementHandle.click({ clickCount: 3 });
        await candidate.elementHandle.press('Backspace');
        await candidate.elementHandle.type(step.value, { delay: 50 });
      } else if (step.action === 'hover' && candidate) {
        await candidate.elementHandle.hover();
      } else if (step.action === 'navigate' && step.value) {
        await this.page.goto(step.value, { waitUntil: 'networkidle2' });
      }

      const durationMs = Date.now() - startTime;
      Logger.logActionSuccess(durationMs);

      // 5. Verify Expected State
      if (step.expected) {
        await this.stateVerifier.verify(step.expected);
        Logger.logVerification(step.expected, true);
      }
    });
  }
}
