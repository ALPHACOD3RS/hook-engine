/**
 * Retry configuration options
 */
export interface RetryConfig {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  jitter: boolean;
  retryOn: string[]; // Error codes to retry on
}

/**
 * Security configuration options
 */
export interface SecurityConfig {
  rateLimiting: {
    enabled: boolean;
    maxRequests: number;
    windowMs: number;
    skipIf?: (req: any) => boolean;
  };
  requestValidation: {
    maxBodySize: number;
    timeoutMs: number;
    allowedContentTypes: string[];
  };
  ipAllowlist?: string[];
  requireHttps: boolean;
}

/**
 * Observability configuration options
 */
export interface ObservabilityConfig {
  logging: {
    enabled: boolean;
    level: 'debug' | 'info' | 'warn' | 'error';
    format: 'json' | 'text';
    destination: 'console' | 'file' | 'both';
    filePath?: string;
  };
  metrics: {
    enabled: boolean;
    prefix: string;
    collectDefaultMetrics: boolean;
  };
  tracing: {
    enabled: boolean;
    serviceName: string;
    sampleRate: number;
  };
}

/**
 * Storage configuration options
 */
export interface StorageConfig {
  type: 'sqlite' | 'memory' | 'redis';
  connection?: {
    host?: string;
    port?: number;
    password?: string;
    database?: string;
    path?: string; // For SQLite
  };
  ttl: number; // Time to live for stored events in seconds
  cleanupInterval: number; // Cleanup interval in seconds
}

/**
 * Adapter configuration
 */
export interface AdapterConfig {
  source: string;
  secret: string;
  enabled: boolean;
  options?: Record<string, any>;
}

/**
 * Main hook engine configuration
 */
export interface HookEngineConfig {
  adapters: AdapterConfig[];
  retry: RetryConfig;
  security: SecurityConfig;
  observability: ObservabilityConfig;
  storage: StorageConfig;
  environment: 'development' | 'staging' | 'production';
}

/**
 * Legacy webhook config for backwards compatibility
 */
export interface WebhookConfig {
  source: string;
  secret: string;
}