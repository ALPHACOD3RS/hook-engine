import {
    ReliabilityConfig,
    HealthCheckConfig,
    GracefulShutdownConfig,
    ConnectionPoolConfig,
    MemoryMonitorConfig,
    DeduplicationConfig,
    CircuitBreakerConfig,
    RetryPolicyConfig
} from '../types/reliability';

/**
 * Basic reliability configuration for development environments
 */
export const developmentReliabilityConfig: ReliabilityConfig = {
    healthChecks: {
        enabled: true,
        interval: 30000, // 30 seconds
        timeout: 5000, // 5 seconds
        retries: 2,
        gracePeriod: 10000, // 10 seconds
        endpoints: [
            {
                name: 'self-check',
                path: '/health',
                method: 'GET',
                expectedStatus: [200],
                timeout: 3000
            }
        ],
        dependencies: []
    },
    gracefulShutdown: {
        enabled: true,
        timeout: 30000, // 30 seconds
        signals: ['SIGTERM', 'SIGINT'],
        hooks: [
            {
                name: 'close-connections',
                priority: 1,
                timeout: 10000,
                execute: async () => {
                    console.log('Closing connections...');
                    // Close database connections, etc.
                }
            },
            {
                name: 'cleanup-resources',
                priority: 2,
                timeout: 5000,
                execute: async () => {
                    console.log('Cleaning up resources...');
                    // Cleanup temporary files, etc.
                }
            }
        ],
        forceExitTimeout: 35000 // 35 seconds
    },
    connectionPooling: {
        database: {
            min: 2,
            max: 10,
            acquireTimeoutMillis: 10000,
            createTimeoutMillis: 5000,
            destroyTimeoutMillis: 5000,
            idleTimeoutMillis: 30000,
            reapIntervalMillis: 1000,
            createRetryIntervalMillis: 200,
            propagateCreateError: false
        },
        redis: {
            min: 1,
            max: 5,
            acquireTimeoutMillis: 5000,
            idleTimeoutMillis: 30000,
            evictionRunIntervalMillis: 30000,
            numTestsPerEvictionRun: 3,
            softIdleTimeoutMillis: 25000,
            testOnBorrow: true,
            testOnReturn: false,
            testWhileIdle: true
        },
        http: {
            maxSockets: 50,
            maxFreeSockets: 10,
            timeout: 10000,
            freeSocketTimeout: 15000,
            keepAlive: true,
            keepAliveMsecs: 1000
        }
    },
    memoryMonitoring: {
        enabled: true,
        interval: 60000, // 1 minute
        thresholds: {
            warning: 80, // 80% memory usage
            critical: 95, // 95% memory usage
            heap: {
                warning: 85,
                critical: 95
            }
        },
        actions: [
            {
                threshold: 'warning',
                action: 'log'
            },
            {
                threshold: 'critical',
                action: 'gc'
            }
        ],
        gcConfig: {
            enabled: true,
            strategy: 'conservative',
            interval: 300000, // 5 minutes
            memoryThreshold: 80
        }
    },
    deduplication: {
        enabled: true,
        levels: [
            {
                name: 'basic-dedup',
                enabled: true,
                keyGenerator: (req: any) => {
                    const body = JSON.stringify(req.body || {});
                    const source = req.headers['x-webhook-source'] || 'unknown';
                    return `${source}:${Buffer.from(body).toString('base64').slice(0, 32)}`;
                },
                ttl: 300000, // 5 minutes
                scope: 'global',
                action: 'reject'
            }
        ],
        storage: {
            type: 'memory',
            config: {},
            maxKeys: 10000,
            cleanupInterval: 60000 // 1 minute
        },
        cleanup: {
            enabled: true,
            interval: 300000, // 5 minutes
            batchSize: 1000,
            maxAge: 3600000 // 1 hour
        }
    }
};

/**
 * Production reliability configuration with robust settings
 */
export const productionReliabilityConfig: ReliabilityConfig = {
    healthChecks: {
        enabled: true,
        interval: 15000, // 15 seconds
        timeout: 3000, // 3 seconds
        retries: 3,
        gracePeriod: 30000, // 30 seconds
        endpoints: [
            {
                name: 'health-check',
                path: '/health',
                method: 'GET',
                expectedStatus: [200],
                timeout: 2000
            },
            {
                name: 'readiness-check',
                path: '/ready',
                method: 'GET',
                expectedStatus: [200],
                timeout: 2000
            }
        ],
        dependencies: [
            {
                name: 'database',
                type: 'database',
                config: {},
                critical: true,
                timeout: 5000,
                check: async () => {
                    // Database health check implementation
                    return { status: 'healthy', timestamp: new Date(), uptime: 0, checks: [], dependencies: [], metrics: {} as any };
                }
            },
            {
                name: 'redis',
                type: 'redis',
                config: {},
                critical: false,
                timeout: 3000,
                check: async () => {
                    // Redis health check implementation
                    return { status: 'healthy', timestamp: new Date(), uptime: 0, checks: [], dependencies: [], metrics: {} as any };
                }
            }
        ]
    },
    gracefulShutdown: {
        enabled: true,
        timeout: 60000, // 1 minute
        signals: ['SIGTERM', 'SIGINT', 'SIGUSR2'],
        hooks: [
            {
                name: 'stop-accepting-requests',
                priority: 1,
                timeout: 5000,
                execute: async () => {
                    console.log('Stopping request acceptance...');
                    // Stop accepting new requests
                }
            },
            {
                name: 'finish-pending-requests',
                priority: 2,
                timeout: 30000,
                execute: async () => {
                    console.log('Finishing pending requests...');
                    // Wait for pending requests to complete
                }
            },
            {
                name: 'close-database-connections',
                priority: 3,
                timeout: 10000,
                execute: async () => {
                    console.log('Closing database connections...');
                    // Close database connections
                }
            },
            {
                name: 'cleanup-resources',
                priority: 4,
                timeout: 10000,
                execute: async () => {
                    console.log('Cleaning up resources...');
                    // Final cleanup
                }
            }
        ],
        forceExitTimeout: 70000 // 70 seconds
    },
    connectionPooling: {
        database: {
            min: 5,
            max: 50,
            acquireTimeoutMillis: 30000,
            createTimeoutMillis: 10000,
            destroyTimeoutMillis: 5000,
            idleTimeoutMillis: 600000, // 10 minutes
            reapIntervalMillis: 1000,
            createRetryIntervalMillis: 500,
            propagateCreateError: true
        },
        redis: {
            min: 2,
            max: 20,
            acquireTimeoutMillis: 10000,
            idleTimeoutMillis: 300000, // 5 minutes
            evictionRunIntervalMillis: 30000,
            numTestsPerEvictionRun: 5,
            softIdleTimeoutMillis: 240000, // 4 minutes
            testOnBorrow: true,
            testOnReturn: true,
            testWhileIdle: true
        },
        http: {
            maxSockets: 200,
            maxFreeSockets: 50,
            timeout: 30000,
            freeSocketTimeout: 60000,
            keepAlive: true,
            keepAliveMsecs: 1000
        }
    },
    memoryMonitoring: {
        enabled: true,
        interval: 30000, // 30 seconds
        thresholds: {
            warning: 70, // 70% memory usage
            critical: 85, // 85% memory usage
            heap: {
                warning: 75,
                critical: 90
            }
        },
        actions: [
            {
                threshold: 'warning',
                action: 'log'
            },
            {
                threshold: 'warning',
                action: 'alert'
            },
            {
                threshold: 'critical',
                action: 'gc'
            },
            {
                threshold: 'critical',
                action: 'throttle'
            }
        ],
        gcConfig: {
            enabled: true,
            strategy: 'adaptive',
            interval: 120000, // 2 minutes
            memoryThreshold: 70
        }
    },
    deduplication: {
        enabled: true,
        levels: [
            {
                name: 'content-dedup',
                enabled: true,
                keyGenerator: (req: any) => {
                    const body = JSON.stringify(req.body || {});
                    const source = req.headers['x-webhook-source'] || 'unknown';
                    const signature = req.headers['x-signature'] || '';
                    return `${source}:${signature}:${Buffer.from(body).toString('base64').slice(0, 64)}`;
                },
                ttl: 600000, // 10 minutes
                scope: 'global',
                action: 'reject'
            },
            {
                name: 'tenant-dedup',
                enabled: true,
                keyGenerator: (req: any) => {
                    const tenantId = req.headers['x-tenant-id'] || 'default';
                    const eventId = req.body?.id || req.body?.event_id || '';
                    return `tenant:${tenantId}:event:${eventId}`;
                },
                ttl: 3600000, // 1 hour
                scope: 'tenant',
                action: 'merge'
            }
        ],
        storage: {
            type: 'redis',
            config: {
                host: process.env.REDIS_HOST || 'localhost',
                port: parseInt(process.env.REDIS_PORT || '6379'),
                db: 1
            },
            maxKeys: 100000,
            cleanupInterval: 300000 // 5 minutes
        },
        cleanup: {
            enabled: true,
            interval: 600000, // 10 minutes
            batchSize: 5000,
            maxAge: 7200000 // 2 hours
        }
    },
    circuitBreaker: {
        enabled: true,
        failureThreshold: 5,
        recoveryTimeout: 60000, // 1 minute
        monitoringPeriod: 300000, // 5 minutes
        expectedErrors: ['ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND']
    },
    retryPolicy: {
        enabled: true,
        maxAttempts: 3,
        baseDelay: 1000, // 1 second
        maxDelay: 30000, // 30 seconds
        backoffStrategy: 'exponential',
        jitter: true,
        retryableErrors: ['ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED']
    }
};

/**
 * High-availability reliability configuration
 */
export const highAvailabilityReliabilityConfig: ReliabilityConfig = {
    healthChecks: {
        enabled: true,
        interval: 10000, // 10 seconds
        timeout: 2000, // 2 seconds
        retries: 5,
        gracePeriod: 60000, // 1 minute
        endpoints: [
            {
                name: 'liveness',
                path: '/health/live',
                method: 'GET',
                expectedStatus: [200],
                timeout: 1000
            },
            {
                name: 'readiness',
                path: '/health/ready',
                method: 'GET',
                expectedStatus: [200],
                timeout: 1500
            },
            {
                name: 'startup',
                path: '/health/startup',
                method: 'GET',
                expectedStatus: [200],
                timeout: 2000
            }
        ],
        dependencies: [
            {
                name: 'primary-database',
                type: 'database',
                config: { primary: true },
                critical: true,
                timeout: 3000,
                check: async () => ({ status: 'healthy', timestamp: new Date(), uptime: 0, checks: [], dependencies: [], metrics: {} as any })
            },
            {
                name: 'replica-database',
                type: 'database',
                config: { replica: true },
                critical: false,
                timeout: 3000,
                check: async () => ({ status: 'healthy', timestamp: new Date(), uptime: 0, checks: [], dependencies: [], metrics: {} as any })
            },
            {
                name: 'redis-cluster',
                type: 'redis',
                config: { cluster: true },
                critical: false,
                timeout: 2000,
                check: async () => ({ status: 'healthy', timestamp: new Date(), uptime: 0, checks: [], dependencies: [], metrics: {} as any })
            },
            {
                name: 'message-queue',
                type: 'custom',
                config: {},
                critical: true,
                timeout: 3000,
                check: async () => ({ status: 'healthy', timestamp: new Date(), uptime: 0, checks: [], dependencies: [], metrics: {} as any })
            }
        ]
    },
    gracefulShutdown: {
        enabled: true,
        timeout: 120000, // 2 minutes
        signals: ['SIGTERM', 'SIGINT', 'SIGUSR1', 'SIGUSR2'],
        hooks: [
            {
                name: 'deregister-from-load-balancer',
                priority: 1,
                timeout: 10000,
                execute: async () => {
                    console.log('Deregistering from load balancer...');
                    // Remove from load balancer
                }
            },
            {
                name: 'drain-connections',
                priority: 2,
                timeout: 60000,
                execute: async () => {
                    console.log('Draining connections...');
                    // Drain existing connections
                }
            },
            {
                name: 'flush-queues',
                priority: 3,
                timeout: 30000,
                execute: async () => {
                    console.log('Flushing message queues...');
                    // Flush message queues
                }
            },
            {
                name: 'close-all-connections',
                priority: 4,
                timeout: 15000,
                execute: async () => {
                    console.log('Closing all connections...');
                    // Close all connections
                }
            }
        ],
        forceExitTimeout: 130000 // 130 seconds
    },
    connectionPooling: {
        database: {
            min: 10,
            max: 100,
            acquireTimeoutMillis: 60000,
            createTimeoutMillis: 15000,
            destroyTimeoutMillis: 5000,
            idleTimeoutMillis: 1800000, // 30 minutes
            reapIntervalMillis: 1000,
            createRetryIntervalMillis: 1000,
            propagateCreateError: true
        },
        redis: {
            min: 5,
            max: 50,
            acquireTimeoutMillis: 15000,
            idleTimeoutMillis: 600000, // 10 minutes
            evictionRunIntervalMillis: 30000,
            numTestsPerEvictionRun: 10,
            softIdleTimeoutMillis: 480000, // 8 minutes
            testOnBorrow: true,
            testOnReturn: true,
            testWhileIdle: true
        },
        http: {
            maxSockets: 500,
            maxFreeSockets: 100,
            timeout: 60000,
            freeSocketTimeout: 120000,
            keepAlive: true,
            keepAliveMsecs: 1000
        }
    },
    memoryMonitoring: {
        enabled: true,
        interval: 15000, // 15 seconds
        thresholds: {
            warning: 60, // 60% memory usage
            critical: 75, // 75% memory usage
            heap: {
                warning: 65,
                critical: 80
            }
        },
        actions: [
            {
                threshold: 'warning',
                action: 'log'
            },
            {
                threshold: 'warning',
                action: 'alert'
            },
            {
                threshold: 'critical',
                action: 'gc'
            },
            {
                threshold: 'critical',
                action: 'throttle'
            },
            {
                threshold: 'critical',
                action: 'reject'
            }
        ],
        gcConfig: {
            enabled: true,
            strategy: 'aggressive',
            interval: 60000, // 1 minute
            memoryThreshold: 60
        }
    },
    deduplication: {
        enabled: true,
        levels: [
            {
                name: 'global-dedup',
                enabled: true,
                keyGenerator: (req: any) => {
                    const body = JSON.stringify(req.body || {});
                    const source = req.headers['x-webhook-source'] || 'unknown';
                    const timestamp = req.headers['x-timestamp'] || Date.now();
                    return `global:${source}:${timestamp}:${Buffer.from(body).toString('base64').slice(0, 64)}`;
                },
                ttl: 1800000, // 30 minutes
                scope: 'global',
                action: 'reject'
            },
            {
                name: 'tenant-dedup',
                enabled: true,
                keyGenerator: (req: any) => {
                    const tenantId = req.headers['x-tenant-id'] || 'default';
                    const eventId = req.body?.id || req.body?.event_id || '';
                    const eventType = req.body?.type || req.body?.event_type || '';
                    return `tenant:${tenantId}:${eventType}:${eventId}`;
                },
                ttl: 7200000, // 2 hours
                scope: 'tenant',
                action: 'merge'
            },
            {
                name: 'user-dedup',
                enabled: true,
                keyGenerator: (req: any) => {
                    const userId = req.body?.user?.id || req.body?.user_id || '';
                    const action = req.body?.action || req.body?.event_type || '';
                    const timestamp = Math.floor(Date.now() / 60000); // 1-minute buckets
                    return `user:${userId}:${action}:${timestamp}`;
                },
                ttl: 300000, // 5 minutes
                scope: 'user',
                action: 'delay'
            }
        ],
        storage: {
            type: 'redis',
            config: {
                host: process.env.REDIS_HOST || 'localhost',
                port: parseInt(process.env.REDIS_PORT || '6379'),
                db: 2,
                cluster: true
            },
            maxKeys: 1000000,
            cleanupInterval: 180000 // 3 minutes
        },
        cleanup: {
            enabled: true,
            interval: 300000, // 5 minutes
            batchSize: 10000,
            maxAge: 14400000 // 4 hours
        }
    },
    circuitBreaker: {
        enabled: true,
        failureThreshold: 3,
        recoveryTimeout: 30000, // 30 seconds
        monitoringPeriod: 120000, // 2 minutes
        expectedErrors: ['ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', 'ECONNRESET']
    },
    retryPolicy: {
        enabled: true,
        maxAttempts: 5,
        baseDelay: 500, // 500ms
        maxDelay: 60000, // 1 minute
        backoffStrategy: 'exponential',
        jitter: true,
        retryableErrors: ['ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED', 'ENOTFOUND']
    }
};

/**
 * Get reliability configuration by environment
 */
export function getReliabilityConfigByEnvironment(env: string): ReliabilityConfig {
    switch (env.toLowerCase()) {
        case 'development':
        case 'dev':
            return developmentReliabilityConfig;
        case 'production':
        case 'prod':
            return productionReliabilityConfig;
        case 'staging':
        case 'stage':
            return productionReliabilityConfig; // Use production config for staging
        case 'high-availability':
        case 'ha':
            return highAvailabilityReliabilityConfig;
        default:
            return developmentReliabilityConfig;
    }
}

/**
 * Merge reliability configurations
 */
export function mergeReliabilityConfigs(base: ReliabilityConfig, override: Partial<ReliabilityConfig>): ReliabilityConfig {
    return {
        ...base,
        ...override,
        healthChecks: { ...base.healthChecks, ...override.healthChecks },
        gracefulShutdown: { ...base.gracefulShutdown, ...override.gracefulShutdown },
        connectionPooling: { ...base.connectionPooling, ...override.connectionPooling },
        memoryMonitoring: { ...base.memoryMonitoring, ...override.memoryMonitoring },
        deduplication: { ...base.deduplication, ...override.deduplication },
        circuitBreaker: base.circuitBreaker && override.circuitBreaker ? 
            { ...base.circuitBreaker, ...override.circuitBreaker } : 
            override.circuitBreaker || base.circuitBreaker,
        retryPolicy: base.retryPolicy && override.retryPolicy ? 
            { ...base.retryPolicy, ...override.retryPolicy } : 
            override.retryPolicy || base.retryPolicy
    };
} 