export interface HealthCheckConfig {
    enabled: boolean;
    interval: number; // Health check interval in milliseconds
    timeout: number; // Health check timeout in milliseconds
    retries: number; // Number of retries before marking as unhealthy
    gracePeriod: number; // Grace period before starting health checks
    endpoints: HealthCheckEndpoint[];
    dependencies: DependencyCheck[];
}

export interface HealthCheckEndpoint {
    name: string;
    path: string;
    method: 'GET' | 'POST' | 'HEAD';
    expectedStatus: number[];
    timeout: number;
    headers?: Record<string, string>;
    body?: any;
}

export interface DependencyCheck {
    name: string;
    type: 'database' | 'redis' | 'http' | 'custom';
    config: any;
    critical: boolean; // Whether failure should mark service as unhealthy
    timeout: number;
    check: () => Promise<HealthStatus>;
}

export interface HealthStatus {
    status: 'healthy' | 'unhealthy' | 'degraded';
    timestamp: Date;
    uptime: number;
    checks: HealthCheckResult[];
    dependencies: DependencyStatus[];
    metrics: HealthMetrics;
}

export interface HealthCheckResult {
    name: string;
    status: 'pass' | 'fail' | 'warn';
    duration: number;
    error?: string;
    details?: any;
}

export interface DependencyStatus {
    name: string;
    status: 'available' | 'unavailable' | 'degraded';
    responseTime: number;
    error?: string;
    lastChecked: Date;
}

export interface HealthMetrics {
    memoryUsage: MemoryUsage;
    cpuUsage: number;
    activeConnections: number;
    requestsPerSecond: number;
    errorRate: number;
    averageResponseTime: number;
}

export interface MemoryUsage {
    used: number;
    total: number;
    percentage: number;
    heap: {
        used: number;
        total: number;
        percentage: number;
    };
}

export interface GracefulShutdownConfig {
    enabled: boolean;
    timeout: number; // Maximum time to wait for graceful shutdown
    signals: string[]; // Signals to listen for (SIGTERM, SIGINT, etc.)
    hooks: ShutdownHook[];
    forceExitTimeout: number; // Force exit after this timeout
}

export interface ShutdownHook {
    name: string;
    priority: number; // Lower numbers execute first
    timeout: number;
    execute: () => Promise<void>;
}

export interface ConnectionPoolConfig {
    database?: DatabasePoolConfig;
    redis?: RedisPoolConfig;
    http?: HttpPoolConfig;
}

export interface DatabasePoolConfig {
    min: number; // Minimum connections
    max: number; // Maximum connections
    acquireTimeoutMillis: number;
    createTimeoutMillis: number;
    destroyTimeoutMillis: number;
    idleTimeoutMillis: number;
    reapIntervalMillis: number;
    createRetryIntervalMillis: number;
    propagateCreateError: boolean;
}

export interface RedisPoolConfig {
    min: number;
    max: number;
    acquireTimeoutMillis: number;
    idleTimeoutMillis: number;
    evictionRunIntervalMillis: number;
    numTestsPerEvictionRun: number;
    softIdleTimeoutMillis: number;
    testOnBorrow: boolean;
    testOnReturn: boolean;
    testWhileIdle: boolean;
}

export interface HttpPoolConfig {
    maxSockets: number;
    maxFreeSockets: number;
    timeout: number;
    freeSocketTimeout: number;
    keepAlive: boolean;
    keepAliveMsecs: number;
}

export interface MemoryMonitorConfig {
    enabled: boolean;
    interval: number; // Monitoring interval in milliseconds
    thresholds: MemoryThresholds;
    actions: MemoryAction[];
    gcConfig: GarbageCollectionConfig;
}

export interface MemoryThresholds {
    warning: number; // Memory usage percentage to trigger warning
    critical: number; // Memory usage percentage to trigger critical actions
    heap: {
        warning: number;
        critical: number;
    };
}

export interface MemoryAction {
    threshold: 'warning' | 'critical';
    action: 'log' | 'gc' | 'alert' | 'throttle' | 'reject' | 'custom';
    config?: any;
    execute?: () => Promise<void>;
}

export interface GarbageCollectionConfig {
    enabled: boolean;
    strategy: 'aggressive' | 'conservative' | 'adaptive';
    interval: number;
    memoryThreshold: number;
}

export interface DeduplicationConfig {
    enabled: boolean;
    levels: DeduplicationLevel[];
    storage: DeduplicationStorage;
    cleanup: DeduplicationCleanup;
}

export interface DeduplicationLevel {
    name: string;
    enabled: boolean;
    keyGenerator: (req: any) => string;
    ttl: number; // Time to live for deduplication keys
    scope: 'global' | 'tenant' | 'user';
    action: 'reject' | 'merge' | 'delay';
    config?: any;
}

export interface DeduplicationStorage {
    type: 'memory' | 'redis' | 'database';
    config: any;
    maxKeys: number;
    cleanupInterval: number;
}

export interface DeduplicationCleanup {
    enabled: boolean;
    interval: number;
    batchSize: number;
    maxAge: number;
}

export interface DeduplicationResult {
    isDuplicate: boolean;
    originalTimestamp?: Date;
    count: number;
    action: 'processed' | 'rejected' | 'merged' | 'delayed';
    key: string;
}

export interface ReliabilityConfig {
    healthChecks: HealthCheckConfig;
    gracefulShutdown: GracefulShutdownConfig;
    connectionPooling: ConnectionPoolConfig;
    memoryMonitoring: MemoryMonitorConfig;
    deduplication: DeduplicationConfig;
    circuitBreaker?: CircuitBreakerConfig;
    retryPolicy?: RetryPolicyConfig;
}

export interface CircuitBreakerConfig {
    enabled: boolean;
    failureThreshold: number; // Number of failures before opening circuit
    recoveryTimeout: number; // Time to wait before attempting recovery
    monitoringPeriod: number; // Period to monitor for failures
    expectedErrors: string[]; // Error types that should trigger circuit breaker
}

export interface RetryPolicyConfig {
    enabled: boolean;
    maxAttempts: number;
    baseDelay: number; // Base delay between retries in milliseconds
    maxDelay: number; // Maximum delay between retries
    backoffStrategy: 'linear' | 'exponential' | 'fixed';
    jitter: boolean; // Add random jitter to delays
    retryableErrors: string[]; // Error types that should be retried
}

export interface ReliabilityMetrics {
    uptime: number;
    healthStatus: HealthStatus;
    memoryUsage: MemoryUsage;
    connectionPools: ConnectionPoolMetrics;
    deduplication: DeduplicationMetrics;
    circuitBreaker?: CircuitBreakerMetrics;
    lastUpdated: Date;
}

export interface ConnectionPoolMetrics {
    database?: PoolMetrics;
    redis?: PoolMetrics;
    http?: PoolMetrics;
}

export interface PoolMetrics {
    active: number;
    idle: number;
    waiting: number;
    created: number;
    destroyed: number;
    errors: number;
    timeouts: number;
}

export interface DeduplicationMetrics {
    totalRequests: number;
    duplicateRequests: number;
    deduplicationRate: number;
    storageSize: number;
    cleanupRuns: number;
    lastCleanup: Date;
}

export interface CircuitBreakerMetrics {
    state: 'closed' | 'open' | 'half-open';
    failures: number;
    successes: number;
    lastFailure?: Date;
    lastSuccess?: Date;
    nextAttempt?: Date;
}