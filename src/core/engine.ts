import { WebhookEvent } from '../types/webhook';
import { HookEngineConfig, WebhookConfig } from '../types/config';
import { loadConfig } from '../config';
import { ErrorHandler, initializeErrorHandler } from '../errors/error-handler';
import { RetryEngine } from './retry';
import { StorageAdapter, createStorageAdapter } from '../storage';
import { getAdapter } from '../adapters';
import { normalizeRequestBody } from '../utils/body';
import { WebhookSignatureError, WebhookAdapterError, WebhookDuplicateError } from '../errors/webhook-errors';
import { Timer } from '../utils/timing';

/**
 * Processing result interface
 */
export interface ProcessingResult {
  success: boolean;
  event?: WebhookEvent;
  error?: string;
  message: string;
  duration: number;
  attempts?: number;
}

/**
 * Main hook engine class
 */
export class HookEngine {
  private config: HookEngineConfig;
  private errorHandler: ErrorHandler;
  private retryEngine: RetryEngine;
  private storage: StorageAdapter;

  constructor(userConfig: Partial<HookEngineConfig>) {
    // Load and validate configuration
    this.config = loadConfig(userConfig);
    
    // Initialize error handler
    this.errorHandler = new ErrorHandler({
      strategy: 'retry',
      maxRetries: this.config.retry.maxAttempts,
      retryDelay: this.config.retry.initialDelayMs,
      notifyOnError: this.config.environment === 'production'
    });

    // Initialize retry engine
    this.retryEngine = new RetryEngine(this.config.retry);

    // Initialize storage
    this.storage = createStorageAdapter(this.config.storage);
  }

  /**
   * Process incoming webhook request
   */
  async processWebhook(req: any): Promise<ProcessingResult> {
    const timer = new Timer();
    
    try {
      // Parse webhook event
      const event = await this.parseWebhookEvent(req);
      
      // Check for duplicates
      if (await this.storage.isDuplicate(event.id)) {
        return {
          success: true,
          event,
          message: `Duplicate event ${event.id} skipped`,
          duration: timer.elapsed()
        };
      }

      // Store event
      await this.storage.storeEvent(event.id, event);
      await this.storage.markSeen(event.id);

      return {
        success: true,
        event,
        message: `Event ${event.id} processed successfully`,
        duration: timer.elapsed()
      };

    } catch (error) {
      const duration = timer.elapsed();
      
      // Handle error through error handler
      await this.errorHandler.handle(error as Error, {
        timestamp: new Date(),
        metadata: { duration }
      });

      return {
        success: false,
        error: (error as Error).message,
        message: `Failed to process webhook: ${(error as Error).message}`,
        duration
      };
    }
  }

  /**
   * Process webhook with custom business logic and retry
   */
  async processWebhookWithRetry(
    req: any,
    businessLogic: (event: WebhookEvent) => Promise<void>
  ): Promise<ProcessingResult> {
    const timer = new Timer();
    
    try {
      // Parse webhook event
      const event = await this.parseWebhookEvent(req);
      
      // Check for duplicates
      if (await this.storage.isDuplicate(event.id)) {
        throw new WebhookDuplicateError(event.id);
      }

      // Store event
      await this.storage.storeEvent(event.id, event);
      await this.storage.markSeen(event.id);

      // Execute business logic with retry
      const result = await this.retryEngine.execute(
        () => businessLogic(event),
        event
      );

      if (!result.success) {
        return {
          success: false,
          event,
          error: result.error?.message,
          message: `Business logic failed after ${result.attempts} attempts`,
          duration: timer.elapsed(),
          attempts: result.attempts
        };
      }

      return {
        success: true,
        event,
        message: `Event ${event.id} processed successfully`,
        duration: timer.elapsed(),
        attempts: result.attempts
      };

    } catch (error) {
      const duration = timer.elapsed();
      
      // Handle error through error handler
      await this.errorHandler.handle(error as Error, {
        timestamp: new Date(),
        metadata: { duration }
      });

      return {
        success: false,
        error: (error as Error).message,
        message: `Failed to process webhook: ${(error as Error).message}`,
        duration
      };
    }
  }

  /**
   * Get engine statistics
   */
  getStats() {
    return {
      retry: this.retryEngine.getStats(),
      errors: this.errorHandler.getErrorStats(),
      storage: this.storage instanceof Object && 'getStats' in this.storage 
        ? (this.storage as any).getStats() 
        : null
    };
  }

  /**
   * Shutdown the engine gracefully
   */
  async shutdown(): Promise<void> {
    await this.storage.close();
  }

  private async parseWebhookEvent(req: any): Promise<WebhookEvent> {
    // Determine source from request or use first available adapter
    const source = this.determineSource(req);
    const adapterConfig = this.config.adapters.find(a => a.source === source && a.enabled);
    
    if (!adapterConfig) {
      throw new WebhookAdapterError(source);
    }

    // Create legacy config for backward compatibility
    const legacyConfig: WebhookConfig = {
      source: adapterConfig.source,
      secret: adapterConfig.secret
    };

    // Get raw body
    const rawBody = await normalizeRequestBody(req);
    const adapter = getAdapter(legacyConfig.source);

    if (!adapter) {
      throw new WebhookAdapterError(legacyConfig.source);
    }

    // Verify signature
    const signature = adapter.getSignature(req);
    if (!signature) {
      throw new WebhookSignatureError(legacyConfig.source, { reason: 'Missing signature header' });
    }

    const isValid = adapter.verifySignature(rawBody, signature, legacyConfig.secret);
    if (!isValid) {
      throw new WebhookSignatureError(legacyConfig.source, { reason: 'Invalid signature' });
    }

    // Parse and normalize
    const parsed = adapter.parsePayload(rawBody);
    const normalized = adapter.normalize(parsed);

    return {
      id: normalized.id,
      type: normalized.type,
      timestamp: normalized.timestamp,
      source: legacyConfig.source,
      payload: normalized.payload,
      raw: parsed,
    };
  }

  private determineSource(req: any): string {
    // Try to determine source from headers
    const userAgent = req.headers['user-agent'] || '';
    const contentType = req.headers['content-type'] || '';
    
    // Check for Stripe
    if (req.headers['stripe-signature']) {
      return 'stripe';
    }

    // Check for GitHub
    if (req.headers['x-github-event']) {
      return 'github';
    }

    // Default to first enabled adapter
    const firstAdapter = this.config.adapters.find(a => a.enabled);
    return firstAdapter?.source || 'unknown';
  }
} 