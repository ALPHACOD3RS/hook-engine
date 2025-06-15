import { HookEngineConfig } from '../types/config';

export const defaultConfig: HookEngineConfig = {
  adapters: [],
  retry: {
    maxAttempts: 3,
    initialDelayMs: 100,
    maxDelayMs: 30000,
    backoffMultiplier: 2,
    jitter: true,
    retryOn: [
      'NETWORK_ERROR',
      'TIMEOUT_ERROR', 
      'WEBHOOK_PROCESSING_ERROR',
      'WEBHOOK_RATE_LIMIT_ERROR'
    ]
  },
  security: {
    rateLimiting: {
      enabled: true,
      maxRequests: 100,
      windowMs: 60000, // 1 minute
    },
    requestValidation: {
      maxBodySize: 1024 * 1024, // 1MB
      timeoutMs: 30000, // 30 seconds
      allowedContentTypes: [
        'application/json',
        'application/x-www-form-urlencoded',
        'text/plain'
      ]
    },
    requireHttps: false // Set to true in production
  },
  observability: {
    logging: {
      enabled: true,
      level: 'info',
      format: 'json',
      destination: 'console'
    },
    metrics: {
      enabled: false,
      prefix: 'hook_engine_',
      collectDefaultMetrics: true
    },
    tracing: {
      enabled: false,
      serviceName: 'hook-engine',
      sampleRate: 0.1
    }
  },
  storage: {
    type: 'sqlite',
    connection: {
      path: './db/hook-engine.sqlite'
    },
    ttl: 86400 * 7, // 7 days
    cleanupInterval: 3600 // 1 hour
  },
  environment: 'development'
}; 