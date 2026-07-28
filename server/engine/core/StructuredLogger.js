/**
 * core/StructuredLogger.js
 *
 * Professional structured logging system.
 * Replaces basic console.log with formatted, traceable logs.
 * Supports timing actions and logging structured JSON for debugging.
 */

class StructuredLogger {
  constructor(moduleName) {
    this.moduleName = moduleName;
  }

  _formatMessage(level, message, meta = {}) {
    const timestamp = new Date().toISOString();
    const metaString = Object.keys(meta).length ? ` | ${JSON.stringify(meta)}` : '';
    return `[${timestamp}] [${level}] [${this.moduleName}] ${message}${metaString}`;
  }

  info(message, meta) {
    console.log(this._formatMessage('INFO', message, meta));
  }

  warn(message, meta) {
    console.warn(this._formatMessage('WARN', message, meta));
  }

  error(message, error, meta = {}) {
    const errorMeta = {
      ...meta,
      errorMessage: error?.message,
      stack: error?.stack,
    };
    console.error(this._formatMessage('ERROR', message, errorMeta));
  }

  debug(message, meta) {
    if (process.env.DEBUG === 'true' || process.env.DEBUG_ENGINE === 'true') {
      console.debug(this._formatMessage('DEBUG', message, meta));
    }
  }

  /**
   * Utility to track the execution time and outcome of an action.
   * @param {string} actionName 
   * @param {Function} asyncFn - The action to execute
   * @param {object} initialMeta - Additional metadata (e.g., retries)
   */
  async trackAction(actionName, asyncFn, initialMeta = {}) {
    const startTime = Date.now();
    this.info(`Action Started: ${actionName}`, initialMeta);

    try {
      const result = await asyncFn();
      const duration = Date.now() - startTime;
      this.info(`Action Finished: ${actionName}`, { ...initialMeta, durationMs: duration, success: true });
      return result;
    } catch (err) {
      const duration = Date.now() - startTime;
      this.error(`Action Failed: ${actionName}`, err, { ...initialMeta, durationMs: duration, success: false });
      throw err;
    }
  }
}

module.exports = StructuredLogger;
