/**
 * Base error class for all hook-engine errors
 */
export abstract class HookEngineError extends Error {
  public readonly code: string;
  public readonly context: Record<string, any>;
  public readonly retryable: boolean;
  public readonly timestamp: Date;

  constructor(
    message: string,
    code: string,
    context: Record<string, any> = {},
    retryable: boolean = false
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.context = context;
    this.retryable = retryable;
    this.timestamp = new Date();

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Serialize error for logging/debugging
   */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      context: this.context,
      retryable: this.retryable,
      timestamp: this.timestamp.toISOString(),
      stack: this.stack
    };
  }
}

/**
 * Configuration-related errors
 */
export class ConfigurationError extends HookEngineError {
  constructor(message: string, context: Record<string, any> = {}) {
    super(message, 'CONFIGURATION_ERROR', context, false);
  }
}

/**
 * Network-related errors that might be retryable
 */
export class NetworkError extends HookEngineError {
  constructor(message: string, context: Record<string, any> = {}, retryable: boolean = true) {
    super(message, 'NETWORK_ERROR', context, retryable);
  }
}

/**
 * Timeout errors
 */
export class TimeoutError extends HookEngineError {
  constructor(message: string, context: Record<string, any> = {}) {
    super(message, 'TIMEOUT_ERROR', context, true);
  }
} 