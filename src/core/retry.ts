import { WebhookEvent } from '../types/webhook';
import { RetryConfig } from '../types/config';
import { WebhookProcessingError, TimeoutError } from '../errors/webhook-errors';
import { HookEngineError } from '../errors/base';
import { calculateBackoffDelay, sleep, Timer, withTimeout } from '../utils/timing';

/**
 * Retry policy types
 */
export type RetryPolicy = 'exponential' | 'linear' | 'fixed' | 'custom';

/**
 * Retry attempt context
 */
export interface RetryAttempt {
  attempt: number;
  totalAttempts: number;
  lastError: Error;
  elapsedTime: number;
  nextDelayMs: number;
}

/**
 * Retry result
 */
export interface RetryResult<T> {
  success: boolean;
  result?: T;
  error?: Error;
  attempts: number;
  totalTime: number;
  failureReason?: 'max_attempts' | 'circuit_breaker' | 'timeout' | 'non_retryable';
}

/**
 * Dead letter queue interface
 */
export interface DeadLetterQueue {
  add(event: WebhookEvent, error: Error, attempts: number): Promise<void>;
  getFailedEvents(limit?: number): Promise<Array<{ event: WebhookEvent; error: Error; attempts: number; timestamp: Date }>>;
  remove(eventId: string): Promise<void>;
  clear(): Promise<void>;
}

/**
 * Circuit breaker state
 */
type CircuitBreakerState = 'closed' | 'open' | 'half-open';

/**
 * Circuit breaker configuration
 */
interface CircuitBreakerConfig {
  failureThreshold: number;
  recoveryTimeout: number;
  monitoringPeriod: number;
}

/**
 * Enhanced retry system with advanced features
 */
export class RetryEngine {
  private config: RetryConfig;
  private circuitBreakerState: CircuitBreakerState = 'closed';
  private circuitBreakerConfig: CircuitBreakerConfig;
  private failureCount = 0;
  private lastFailureTime = 0;
  private retryBudget: number;
  private budgetResetTime = 0;
  private deadLetterQueue?: DeadLetterQueue;

  constructor(config: RetryConfig, deadLetterQueue?: DeadLetterQueue) {
    this.config = config;
    this.deadLetterQueue = deadLetterQueue;
    
    // Circuit breaker configuration
    this.circuitBreakerConfig = {
      failureThreshold: 5,
      recoveryTimeout: 60000, // 1 minute
      monitoringPeriod: 300000, // 5 minutes
    };

    // Initialize retry budget (max retries per hour)
    this.retryBudget = 100;
    this.budgetResetTime = Date.now() + 3600000; // 1 hour
  }

  /**
   * Execute function with retry logic
   */
  async execute<T>(
    fn: () => Promise<T>,
    event: WebhookEvent,
    policy: RetryPolicy = 'exponential'
  ): Promise<RetryResult<T>> {
    const timer = new Timer();
    let lastError: Error;
    let attempt = 0;

    // Check circuit breaker
    if (this.isCircuitOpen()) {
      return {
        success: false,
        error: new WebhookProcessingError('Circuit breaker is open', { eventId: event.id }),
        attempts: 0,
        totalTime: 0,
        failureReason: 'circuit_breaker'
      };
    }

    // Check retry budget
    if (!this.hasRetryBudget()) {
      return {
        success: false,
        error: new WebhookProcessingError('Retry budget exhausted', { eventId: event.id }),
        attempts: 0,
        totalTime: 0,
        failureReason: 'max_attempts'
      };
    }

    while (attempt < this.config.maxAttempts) {
      attempt++;

      try {
        const result = await withTimeout(
          fn(),
          this.config.retryOn.includes('TIMEOUT_ERROR') ? 30000 : 60000,
          `Webhook processing timeout for event ${event.id}`
        );

        // Success - record and return
        this.recordSuccess();
        return {
          success: true,
          result,
          attempts: attempt,
          totalTime: timer.elapsed()
        };

      } catch (error) {
        lastError = error as Error;
        
        // Check if error is retryable
        if (!this.isRetryableError(lastError)) {
          this.recordFailure();
          await this.sendToDeadLetter(event, lastError, attempt);
          return {
            success: false,
            error: lastError,
            attempts: attempt,
            totalTime: timer.elapsed(),
            failureReason: 'non_retryable'
          };
        }

        // Check if we should continue retrying
        if (attempt >= this.config.maxAttempts) {
          this.recordFailure();
          await this.sendToDeadLetter(event, lastError, attempt);
          return {
            success: false,
            error: lastError,
            attempts: attempt,
            totalTime: timer.elapsed(),
            failureReason: 'max_attempts'
          };
        }

        // Check circuit breaker after each failure
        if (this.isCircuitOpen()) {
          await this.sendToDeadLetter(event, lastError, attempt);
          return {
            success: false,
            error: lastError,
            attempts: attempt,
            totalTime: timer.elapsed(),
            failureReason: 'circuit_breaker'
          };
        }

        // Calculate delay and wait
        const delay = this.calculateDelay(attempt, policy);
        console.warn(`🔄 Retry ${attempt}/${this.config.maxAttempts} for ${event.id} after ${delay}ms`);
        
        // Consume retry budget
        this.consumeRetryBudget();
        
        await sleep(delay);
      }
    }

    // This should never be reached, but just in case
    this.recordFailure();
    await this.sendToDeadLetter(event, lastError!, attempt);
    return {
      success: false,
      error: lastError!,
      attempts: attempt,
      totalTime: timer.elapsed(),
      failureReason: 'max_attempts'
    };
  }

  /**
   * Batch retry execution
   */
  async executeBatch<T>(
    operations: Array<{ fn: () => Promise<T>; event: WebhookEvent }>,
    policy: RetryPolicy = 'exponential'
  ): Promise<Array<RetryResult<T>>> {
    const results = await Promise.allSettled(
      operations.map(({ fn, event }) => this.execute(fn, event, policy))
    );

    return results.map(result => 
      result.status === 'fulfilled' ? result.value : {
        success: false,
        error: new Error('Batch operation failed'),
        attempts: 0,
        totalTime: 0,
        failureReason: 'non_retryable' as const
      }
    );
  }

  /**
   * Get retry statistics
   */
  getStats() {
    return {
      circuitBreakerState: this.circuitBreakerState,
      failureCount: this.failureCount,
      retryBudget: this.retryBudget,
      budgetResetTime: new Date(this.budgetResetTime)
    };
  }

  /**
   * Reset circuit breaker manually
   */
  resetCircuitBreaker(): void {
    this.circuitBreakerState = 'closed';
    this.failureCount = 0;
    this.lastFailureTime = 0;
  }

  /**
   * Reset retry budget
   */
  resetRetryBudget(): void {
    this.retryBudget = 100;
    this.budgetResetTime = Date.now() + 3600000;
  }

  private isRetryableError(error: Error): boolean {
    if (error instanceof HookEngineError) {
      return error.retryable;
    }

    // Check if error code is in retryable list
    const errorCode = (error as any).code || 'UNKNOWN_ERROR';
    return this.config.retryOn.includes(errorCode);
  }

  private calculateDelay(attempt: number, policy: RetryPolicy): number {
    switch (policy) {
      case 'exponential':
        return calculateBackoffDelay(
          attempt,
          this.config.initialDelayMs,
          this.config.backoffMultiplier,
          this.config.maxDelayMs,
          this.config.jitter
        );
      
      case 'linear':
        const linearDelay = this.config.initialDelayMs * attempt;
        return Math.min(linearDelay, this.config.maxDelayMs);
      
      case 'fixed':
        return this.config.initialDelayMs;
      
      case 'custom':
        // Custom policy could be implemented here
        return calculateBackoffDelay(
          attempt,
          this.config.initialDelayMs,
          this.config.backoffMultiplier,
          this.config.maxDelayMs,
          this.config.jitter
        );
      
      default:
        return calculateBackoffDelay(
          attempt,
          this.config.initialDelayMs,
          this.config.backoffMultiplier,
          this.config.maxDelayMs,
          this.config.jitter
        );
    }
  }

  private isCircuitOpen(): boolean {
    const now = Date.now();
    
    // Check if we need to reset the monitoring period
    if (now - this.lastFailureTime > this.circuitBreakerConfig.monitoringPeriod) {
      this.failureCount = 0;
      this.circuitBreakerState = 'closed';
    }

    // Check if circuit should be opened
    if (this.circuitBreakerState === 'closed' && 
        this.failureCount >= this.circuitBreakerConfig.failureThreshold) {
      this.circuitBreakerState = 'open';
      console.warn(`🔴 Circuit breaker opened after ${this.failureCount} failures`);
    }

    // Check if circuit should move to half-open
    if (this.circuitBreakerState === 'open' && 
        now - this.lastFailureTime > this.circuitBreakerConfig.recoveryTimeout) {
      this.circuitBreakerState = 'half-open';
      console.info('🟡 Circuit breaker moved to half-open state');
    }

    return this.circuitBreakerState === 'open';
  }

  private recordSuccess(): void {
    if (this.circuitBreakerState === 'half-open') {
      this.circuitBreakerState = 'closed';
      this.failureCount = 0;
      console.info('🟢 Circuit breaker closed after successful operation');
    }
  }

  private recordFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    
    if (this.circuitBreakerState === 'half-open') {
      this.circuitBreakerState = 'open';
      console.warn('🔴 Circuit breaker opened again after failure in half-open state');
    }
  }

  private hasRetryBudget(): boolean {
    const now = Date.now();
    
    // Reset budget if time window passed
    if (now > this.budgetResetTime) {
      this.resetRetryBudget();
    }
    
    return this.retryBudget > 0;
  }

  private consumeRetryBudget(): void {
    if (this.retryBudget > 0) {
      this.retryBudget--;
    }
  }

  private async sendToDeadLetter(event: WebhookEvent, error: Error, attempts: number): Promise<void> {
    if (this.deadLetterQueue) {
      try {
        await this.deadLetterQueue.add(event, error, attempts);
        console.error(`💀 Sent event ${event.id} to dead letter queue after ${attempts} attempts`);
      } catch (dlqError) {
        console.error('Failed to send to dead letter queue:', dlqError);
      }
    }
  }
}

/**
 * Legacy retry function for backwards compatibility
 */
export async function retry(
  event: WebhookEvent,
  fn: () => Promise<void>,
  maxAttempts = 3
): Promise<void> {
  const config: RetryConfig = {
    maxAttempts,
    initialDelayMs: 100,
    maxDelayMs: 30000,
    backoffMultiplier: 2,
    jitter: true,
    retryOn: ['WEBHOOK_PROCESSING_ERROR', 'NETWORK_ERROR', 'TIMEOUT_ERROR']
  };

  const retryEngine = new RetryEngine(config);
  const result = await retryEngine.execute(fn, event);
  
  if (!result.success) {
    throw result.error;
  }
}
