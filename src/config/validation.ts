import { HookEngineConfig, AdapterConfig, RetryConfig, SecurityConfig, ObservabilityConfig, StorageConfig } from '../types/config';
import { ConfigurationError } from '../errors/base';

/**
 * Validation result interface
 */
interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate the complete hook engine configuration
 */
export function validateConfig(config: HookEngineConfig): void {
  const result = validateHookEngineConfig(config);
  
  if (!result.valid) {
    throw new ConfigurationError(
      `Configuration validation failed: ${result.errors.join(', ')}`,
      { errors: result.errors, warnings: result.warnings }
    );
  }

  // Log warnings
  if (result.warnings.length > 0) {
    console.warn('⚠️ Configuration warnings:', result.warnings);
  }
}

/**
 * Validate hook engine configuration
 */
function validateHookEngineConfig(config: HookEngineConfig): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate required fields
  if (!config.adapters || !Array.isArray(config.adapters)) {
    errors.push('adapters must be an array');
  }

  if (!config.retry) {
    errors.push('retry configuration is required');
  }

  if (!config.security) {
    errors.push('security configuration is required');
  }

  if (!config.observability) {
    errors.push('observability configuration is required');
  }

  if (!config.storage) {
    errors.push('storage configuration is required');
  }

  if (!config.environment) {
    errors.push('environment is required');
  }

  // Validate environment
  if (config.environment && !['development', 'staging', 'production'].includes(config.environment)) {
    errors.push('environment must be one of: development, staging, production');
  }

  // Validate individual sections
  if (config.adapters) {
    const adapterResult = validateAdapters(config.adapters);
    errors.push(...adapterResult.errors);
    warnings.push(...adapterResult.warnings);
  }

  if (config.retry) {
    const retryResult = validateRetryConfig(config.retry);
    errors.push(...retryResult.errors);
    warnings.push(...retryResult.warnings);
  }

  if (config.security) {
    const securityResult = validateSecurityConfig(config.security);
    errors.push(...securityResult.errors);
    warnings.push(...securityResult.warnings);
  }

  if (config.observability) {
    const observabilityResult = validateObservabilityConfig(config.observability);
    errors.push(...observabilityResult.errors);
    warnings.push(...observabilityResult.warnings);
  }

  if (config.storage) {
    const storageResult = validateStorageConfig(config.storage);
    errors.push(...storageResult.errors);
    warnings.push(...storageResult.warnings);
  }

  // Production-specific validations
  if (config.environment === 'production') {
    if (!config.security.requireHttps) {
      warnings.push('HTTPS should be required in production');
    }

    if (!config.observability.logging.enabled) {
      warnings.push('Logging should be enabled in production');
    }

    if (config.adapters.length === 0) {
      warnings.push('No adapters configured for production');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validate adapter configurations
 */
function validateAdapters(adapters: AdapterConfig[]): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const seenSources = new Set<string>();

  for (let i = 0; i < adapters.length; i++) {
    const adapter = adapters[i];
    const prefix = `adapters[${i}]`;

    if (!adapter.source) {
      errors.push(`${prefix}.source is required`);
    }

    if (!adapter.secret) {
      errors.push(`${prefix}.secret is required`);
    }

    if (typeof adapter.enabled !== 'boolean') {
      errors.push(`${prefix}.enabled must be a boolean`);
    }

    // Check for duplicate sources
    if (adapter.source) {
      if (seenSources.has(adapter.source)) {
        errors.push(`Duplicate adapter source: ${adapter.source}`);
      }
      seenSources.add(adapter.source);
    }

    // Validate secret strength (basic check)
    if (adapter.secret && adapter.secret.length < 16) {
      warnings.push(`${prefix}.secret should be at least 16 characters long`);
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Validate retry configuration
 */
function validateRetryConfig(config: RetryConfig): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (typeof config.maxAttempts !== 'number' || config.maxAttempts < 1) {
    errors.push('retry.maxAttempts must be a positive number');
  }

  if (typeof config.initialDelayMs !== 'number' || config.initialDelayMs < 0) {
    errors.push('retry.initialDelayMs must be a non-negative number');
  }

  if (typeof config.maxDelayMs !== 'number' || config.maxDelayMs < config.initialDelayMs) {
    errors.push('retry.maxDelayMs must be greater than or equal to initialDelayMs');
  }

  if (typeof config.backoffMultiplier !== 'number' || config.backoffMultiplier < 1) {
    errors.push('retry.backoffMultiplier must be >= 1');
  }

  if (typeof config.jitter !== 'boolean') {
    errors.push('retry.jitter must be a boolean');
  }

  if (!Array.isArray(config.retryOn)) {
    errors.push('retry.retryOn must be an array');
  }

  // Warnings for potentially problematic values
  if (config.maxAttempts > 10) {
    warnings.push('retry.maxAttempts > 10 may cause excessive delays');
  }

  if (config.maxDelayMs > 300000) { // 5 minutes
    warnings.push('retry.maxDelayMs > 5 minutes may cause timeouts');
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Validate security configuration
 */
function validateSecurityConfig(config: SecurityConfig): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Rate limiting validation
  if (config.rateLimiting) {
    if (typeof config.rateLimiting.enabled !== 'boolean') {
      errors.push('security.rateLimiting.enabled must be a boolean');
    }

    if (typeof config.rateLimiting.maxRequests !== 'number' || config.rateLimiting.maxRequests < 1) {
      errors.push('security.rateLimiting.maxRequests must be a positive number');
    }

    if (typeof config.rateLimiting.windowMs !== 'number' || config.rateLimiting.windowMs < 1000) {
      errors.push('security.rateLimiting.windowMs must be at least 1000ms');
    }
  }

  // Request validation
  if (config.requestValidation) {
    if (typeof config.requestValidation.maxBodySize !== 'number' || config.requestValidation.maxBodySize < 1) {
      errors.push('security.requestValidation.maxBodySize must be a positive number');
    }

    if (typeof config.requestValidation.timeoutMs !== 'number' || config.requestValidation.timeoutMs < 1000) {
      errors.push('security.requestValidation.timeoutMs must be at least 1000ms');
    }

    if (!Array.isArray(config.requestValidation.allowedContentTypes)) {
      errors.push('security.requestValidation.allowedContentTypes must be an array');
    }
  }

  // IP allowlist validation
  if (config.ipAllowlist && !Array.isArray(config.ipAllowlist)) {
    errors.push('security.ipAllowlist must be an array');
  }

  if (typeof config.requireHttps !== 'boolean') {
    errors.push('security.requireHttps must be a boolean');
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Validate observability configuration
 */
function validateObservabilityConfig(config: ObservabilityConfig): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Logging validation
  if (config.logging) {
    if (typeof config.logging.enabled !== 'boolean') {
      errors.push('observability.logging.enabled must be a boolean');
    }

    if (!['debug', 'info', 'warn', 'error'].includes(config.logging.level)) {
      errors.push('observability.logging.level must be one of: debug, info, warn, error');
    }

    if (!['json', 'text'].includes(config.logging.format)) {
      errors.push('observability.logging.format must be json or text');
    }

    if (!['console', 'file', 'both'].includes(config.logging.destination)) {
      errors.push('observability.logging.destination must be console, file, or both');
    }

    if (config.logging.destination !== 'console' && !config.logging.filePath) {
      errors.push('observability.logging.filePath is required when destination is file or both');
    }
  }

  // Metrics validation
  if (config.metrics) {
    if (typeof config.metrics.enabled !== 'boolean') {
      errors.push('observability.metrics.enabled must be a boolean');
    }

    if (typeof config.metrics.prefix !== 'string') {
      errors.push('observability.metrics.prefix must be a string');
    }

    if (typeof config.metrics.collectDefaultMetrics !== 'boolean') {
      errors.push('observability.metrics.collectDefaultMetrics must be a boolean');
    }
  }

  // Tracing validation
  if (config.tracing) {
    if (typeof config.tracing.enabled !== 'boolean') {
      errors.push('observability.tracing.enabled must be a boolean');
    }

    if (typeof config.tracing.serviceName !== 'string') {
      errors.push('observability.tracing.serviceName must be a string');
    }

    if (typeof config.tracing.sampleRate !== 'number' || config.tracing.sampleRate < 0 || config.tracing.sampleRate > 1) {
      errors.push('observability.tracing.sampleRate must be between 0 and 1');
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Validate storage configuration
 */
function validateStorageConfig(config: StorageConfig): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!['sqlite', 'memory', 'redis'].includes(config.type)) {
    errors.push('storage.type must be one of: sqlite, memory, redis');
  }

  if (typeof config.ttl !== 'number' || config.ttl < 60) {
    errors.push('storage.ttl must be at least 60 seconds');
  }

  if (typeof config.cleanupInterval !== 'number' || config.cleanupInterval < 60) {
    errors.push('storage.cleanupInterval must be at least 60 seconds');
  }

  // Type-specific validation
  if (config.type === 'sqlite' && config.connection?.path && typeof config.connection.path !== 'string') {
    errors.push('storage.connection.path must be a string for SQLite');
  }

  if (config.type === 'redis' && config.connection) {
    if (config.connection.host && typeof config.connection.host !== 'string') {
      errors.push('storage.connection.host must be a string for Redis');
    }

    if (config.connection.port && (typeof config.connection.port !== 'number' || config.connection.port < 1 || config.connection.port > 65535)) {
      errors.push('storage.connection.port must be a valid port number for Redis');
    }
  }

  // Warnings
  if (config.ttl > 86400 * 30) { // 30 days
    warnings.push('storage.ttl > 30 days may consume excessive storage');
  }

  if (config.cleanupInterval > 86400) { // 24 hours
    warnings.push('storage.cleanupInterval > 24 hours may cause storage bloat');
  }

  return { valid: errors.length === 0, errors, warnings };
} 