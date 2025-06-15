/**
 * Error severity levels
 */
export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

/**
 * Error category types
 */
export type ErrorCategory = 
  | 'webhook' 
  | 'adapter' 
  | 'config' 
  | 'security' 
  | 'storage' 
  | 'network' 
  | 'validation';

/**
 * Error handling strategy
 */
export type ErrorHandlingStrategy = 
  | 'retry' 
  | 'fail-fast' 
  | 'ignore' 
  | 'dead-letter';

/**
 * Error handler configuration
 */
export interface ErrorHandlerConfig {
  strategy: ErrorHandlingStrategy;
  maxRetries?: number;
  retryDelay?: number;
  fallbackAction?: () => void;
  notifyOnError?: boolean;
}

/**
 * Error context for enhanced debugging
 */
export interface ErrorContext {
  requestId?: string;
  eventId?: string;
  source?: string;
  timestamp: Date;
  userAgent?: string;
  ipAddress?: string;
  metadata?: Record<string, any>;
}

/**
 * Error reporting interface
 */
export interface ErrorReporter {
  report(error: Error, context: ErrorContext): Promise<void>;
  reportBatch(errors: Array<{ error: Error; context: ErrorContext }>): Promise<void>;
} 