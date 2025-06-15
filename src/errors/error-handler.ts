import { HookEngineError } from './base';
import { ErrorContext, ErrorReporter, ErrorHandlerConfig, ErrorHandlingStrategy } from '../types/errors';

/**
 * Centralized error handler for the hook engine
 */
export class ErrorHandler {
  private config: ErrorHandlerConfig;
  private reporter?: ErrorReporter;
  private errorCounts = new Map<string, number>();
  private lastErrorTime = new Map<string, number>();

  constructor(config: ErrorHandlerConfig, reporter?: ErrorReporter) {
    this.config = config;
    this.reporter = reporter;
  }

  /**
   * Handle an error with context and strategy
   */
  async handle(error: Error, context: ErrorContext): Promise<void> {
    // Convert to HookEngineError if needed
    const hookError = this.normalizeError(error, context);
    
    // Log the error
    this.logError(hookError, context);
    
    // Report to external service if configured
    if (this.reporter) {
      try {
        await this.reporter.report(hookError, context);
      } catch (reportError) {
        console.error('Failed to report error:', reportError);
      }
    }

    // Track error frequency
    this.trackError(hookError, context);

    // Execute strategy
    await this.executeStrategy(hookError, context);
  }

  /**
   * Handle batch of errors
   */
  async handleBatch(errors: Array<{ error: Error; context: ErrorContext }>): Promise<void> {
    if (this.reporter) {
      try {
        const normalizedErrors = errors.map(({ error, context }) => ({
          error: this.normalizeError(error, context),
          context
        }));
        await this.reporter.reportBatch(normalizedErrors);
      } catch (reportError) {
        console.error('Failed to report batch errors:', reportError);
      }
    }

    // Handle each error individually for strategy execution
    for (const { error, context } of errors) {
      await this.handle(error, context);
    }
  }

  /**
   * Check if error should be retried based on strategy
   */
  shouldRetry(error: Error, attempt: number): boolean {
    if (!(error instanceof HookEngineError)) {
      return false;
    }

    if (!error.retryable) {
      return false;
    }

    if (this.config.maxRetries && attempt >= this.config.maxRetries) {
      return false;
    }

    // Check if we're in a circuit breaker state
    if (this.isCircuitBreakerOpen(error.code)) {
      return false;
    }

    return true;
  }

  /**
   * Get retry delay based on strategy
   */
  getRetryDelay(attempt: number): number {
    return this.config.retryDelay || 1000 * Math.pow(2, attempt - 1);
  }

  /**
   * Reset error tracking for a specific error type
   */
  resetErrorTracking(errorCode: string): void {
    this.errorCounts.delete(errorCode);
    this.lastErrorTime.delete(errorCode);
  }

  /**
   * Get error statistics
   */
  getErrorStats(): Record<string, { count: number; lastOccurrence: number }> {
    const stats: Record<string, { count: number; lastOccurrence: number }> = {};
    
    for (const [errorCode, count] of this.errorCounts.entries()) {
      stats[errorCode] = {
        count,
        lastOccurrence: this.lastErrorTime.get(errorCode) || 0
      };
    }

    return stats;
  }

  private normalizeError(error: Error, context: ErrorContext): HookEngineError {
    if (error instanceof HookEngineError) {
      return error;
    }

    // Convert standard errors to HookEngineError
    return new (class extends HookEngineError {
      constructor() {
        super(error.message, 'UNKNOWN_ERROR', context, false);
        this.stack = error.stack;
      }
    })();
  }

  private logError(error: HookEngineError, context: ErrorContext): void {
    const logData = {
      timestamp: new Date().toISOString(),
      error: error.toJSON(),
      context,
      strategy: this.config.strategy
    };

    switch (this.config.strategy) {
      case 'fail-fast':
        console.error('❌ FAIL-FAST Error:', logData);
        break;
      case 'retry':
        console.warn('🔄 RETRY Error:', logData);
        break;
      case 'ignore':
        console.debug('🔇 IGNORED Error:', logData);
        break;
      case 'dead-letter':
        console.error('💀 DEAD-LETTER Error:', logData);
        break;
    }
  }

  private trackError(error: HookEngineError, context: ErrorContext): void {
    const errorCode = error.code;
    const currentCount = this.errorCounts.get(errorCode) || 0;
    
    this.errorCounts.set(errorCode, currentCount + 1);
    this.lastErrorTime.set(errorCode, Date.now());
  }

  private async executeStrategy(error: HookEngineError, context: ErrorContext): Promise<void> {
    switch (this.config.strategy) {
      case 'fail-fast':
        throw error;
      
      case 'retry':
        // Retry logic is handled by the retry system
        break;
      
      case 'ignore':
        // Do nothing, just log
        break;
      
      case 'dead-letter':
        await this.sendToDeadLetter(error, context);
        break;
    }

    // Execute fallback action if configured
    if (this.config.fallbackAction) {
      try {
        await this.config.fallbackAction();
      } catch (fallbackError) {
        console.error('Fallback action failed:', fallbackError);
      }
    }

    // Send notification if configured
    if (this.config.notifyOnError) {
      await this.sendErrorNotification(error, context);
    }
  }

  private isCircuitBreakerOpen(errorCode: string): boolean {
    const count = this.errorCounts.get(errorCode) || 0;
    const lastTime = this.lastErrorTime.get(errorCode) || 0;
    const timeSinceLastError = Date.now() - lastTime;
    
    // Simple circuit breaker: if more than 5 errors in the last 5 minutes
    const threshold = 5;
    const timeWindow = 5 * 60 * 1000; // 5 minutes
    
    return count >= threshold && timeSinceLastError < timeWindow;
  }

  private async sendToDeadLetter(error: HookEngineError, context: ErrorContext): Promise<void> {
    // TODO: Implement dead letter queue
    console.error('💀 Sending to dead letter queue:', { error: error.toJSON(), context });
  }

  private async sendErrorNotification(error: HookEngineError, context: ErrorContext): Promise<void> {
    // TODO: Implement notification system (email, Slack, etc.)
    console.error('🚨 Error notification:', { error: error.toJSON(), context });
  }
}

/**
 * Global error handler instance
 */
let globalErrorHandler: ErrorHandler;

/**
 * Initialize global error handler
 */
export function initializeErrorHandler(config: ErrorHandlerConfig, reporter?: ErrorReporter): void {
  globalErrorHandler = new ErrorHandler(config, reporter);
}

/**
 * Get global error handler
 */
export function getGlobalErrorHandler(): ErrorHandler {
  if (!globalErrorHandler) {
    throw new Error('Error handler not initialized. Call initializeErrorHandler first.');
  }
  return globalErrorHandler;
} 