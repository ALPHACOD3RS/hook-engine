import { HookEngineError } from './base';

/**
 * Webhook signature verification failed
 */
export class WebhookSignatureError extends HookEngineError {
  constructor(source: string, context: Record<string, any> = {}) {
    super(
      `Webhook signature verification failed for source: ${source}`,
      'WEBHOOK_SIGNATURE_ERROR',
      { source, ...context },
      false
    );
  }
}

/**
 * Webhook payload parsing failed
 */
export class WebhookParseError extends HookEngineError {
  constructor(message: string, context: Record<string, any> = {}) {
    super(message, 'WEBHOOK_PARSE_ERROR', context, false);
  }
}

/**
 * Webhook processing failed (retryable)
 */
export class WebhookProcessingError extends HookEngineError {
  constructor(message: string, context: Record<string, any> = {}) {
    super(message, 'WEBHOOK_PROCESSING_ERROR', context, true);
  }
}

/**
 * Webhook validation failed
 */
export class WebhookValidationError extends HookEngineError {
  constructor(message: string, context: Record<string, any> = {}) {
    super(message, 'WEBHOOK_VALIDATION_ERROR', context, false);
  }
}

/**
 * Rate limit exceeded
 */
export class WebhookRateLimitError extends HookEngineError {
  constructor(limit: number, windowMs: number, context: Record<string, any> = {}) {
    super(
      `Rate limit exceeded: ${limit} requests per ${windowMs}ms`,
      'WEBHOOK_RATE_LIMIT_ERROR',
      { limit, windowMs, ...context },
      true
    );
  }
}

/**
 * Adapter not found or supported
 */
export class WebhookAdapterError extends HookEngineError {
  constructor(source: string, context: Record<string, any> = {}) {
    super(
      `Unsupported webhook source: ${source}`,
      'WEBHOOK_ADAPTER_ERROR',
      { source, ...context },
      false
    );
  }
}

/**
 * Duplicate webhook event (not really an error, but useful for tracking)
 */
export class WebhookDuplicateError extends HookEngineError {
  constructor(eventId: string, context: Record<string, any> = {}) {
    super(
      `Duplicate webhook event: ${eventId}`,
      'WEBHOOK_DUPLICATE_ERROR',
      { eventId, ...context },
      false
    );
  }
}

/**
 * Re-export TimeoutError for convenience
 */
export { TimeoutError } from './base'; 