import { Logger } from '../core/Logger';

export class RetryManager {
  /**
   * Executes an action with exponential backoff retries.
   *
   * @param actionName The name of the action being retried.
   * @param maxRetries Maximum number of retry attempts.
   * @param actionFn The async function to execute.
   */
  public static async executeWithRetry<T>(
    actionName: string,
    maxRetries: number,
    actionFn: (attempt: number) => Promise<T>
  ): Promise<T> {
    let lastError: Error = new Error('Unknown error in RetryManager');

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 1) {
          Logger.logError(`Retrying action "${actionName}" (Attempt ${attempt}/${maxRetries})...`);
        }
        
        return await actionFn(attempt);
        
      } catch (e) {
        lastError = e as Error;
        Logger.logError(`Action "${actionName}" failed on attempt ${attempt}: ${lastError.message}`);

        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt - 1) * 1000; // Exponential backoff: 1s, 2s, 4s...
          Logger.logError(`Waiting ${delay}ms before next attempt...`);
          await new Promise(r => setTimeout(r, delay));
        }
      }
    }

    throw new Error(`Action "${actionName}" completely failed after ${maxRetries} attempts. Last error: ${lastError.message}`);
  }
}
