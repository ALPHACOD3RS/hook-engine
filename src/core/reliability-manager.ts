import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';
import {
    ReliabilityConfig,
    HealthCheckConfig,
    HealthStatus,
    HealthCheckResult,
    DependencyStatus,
    HealthMetrics,
    MemoryUsage,
    GracefulShutdownConfig,
    ShutdownHook,
    MemoryMonitorConfig,
    MemoryThresholds,
    MemoryAction,
    DeduplicationConfig,
    DeduplicationResult,
    DeduplicationLevel,
    ReliabilityMetrics,
    ConnectionPoolMetrics,
    DeduplicationMetrics
} from '../types/reliability';

/**
 * Comprehensive reliability manager for production webhook processing
 */
export class ReliabilityManager extends EventEmitter {
    private config: ReliabilityConfig;
    private startTime: number;
    private healthCheckInterval?: NodeJS.Timeout;
    private memoryMonitorInterval?: NodeJS.Timeout;
    private deduplicationCleanupInterval?: NodeJS.Timeout;
    private isShuttingDown = false;
    private shutdownPromise?: Promise<void>;
    private deduplicationStore = new Map<string, { timestamp: Date; count: number }>();
    private requestMetrics = {
        total: 0,
        errors: 0,
        responseTimes: [] as number[]
    };

    constructor(config: ReliabilityConfig) {
        super();
        this.config = config;
        this.startTime = Date.now();
        this.initialize();
    }

    /**
     * Initialize all reliability features
     */
    private initialize(): void {
        // Start health checks
        if (this.config.healthChecks.enabled) {
            this.startHealthChecks();
        }

        // Start memory monitoring
        if (this.config.memoryMonitoring.enabled) {
            this.startMemoryMonitoring();
        }

        // Setup graceful shutdown
        if (this.config.gracefulShutdown.enabled) {
            this.setupGracefulShutdown();
        }

        // Start deduplication cleanup
        if (this.config.deduplication.enabled) {
            this.startDeduplicationCleanup();
        }

        this.emit('initialized');
    }

    /**
     * Start health check monitoring
     */
    private startHealthChecks(): void {
        const config = this.config.healthChecks;
        
        // Wait for grace period before starting
        setTimeout(() => {
            this.healthCheckInterval = setInterval(async () => {
                try {
                    await this.performHealthCheck();
                } catch (error) {
                    this.emit('healthCheckError', error);
                }
            }, config.interval);

            // Perform initial health check
            this.performHealthCheck();
        }, config.gracePeriod);
    }

    /**
     * Perform comprehensive health check
     */
    private async performHealthCheck(): Promise<HealthStatus> {
        const startTime = performance.now();
        const checks: HealthCheckResult[] = [];
        const dependencies: DependencyStatus[] = [];

        // Check endpoints
        for (const endpoint of this.config.healthChecks.endpoints) {
            const checkResult = await this.checkEndpoint(endpoint);
            checks.push(checkResult);
        }

        // Check dependencies
        for (const dependency of this.config.healthChecks.dependencies) {
            const depStatus = await this.checkDependency(dependency);
            dependencies.push(depStatus);
        }

        // Gather metrics
        const metrics = await this.gatherHealthMetrics();

        // Determine overall status
        const hasFailedCriticalChecks = checks.some(c => c.status === 'fail') ||
            dependencies.some(d => d.status === 'unavailable' && 
                this.config.healthChecks.dependencies.find(dep => dep.name === d.name)?.critical);

        const hasWarnings = checks.some(c => c.status === 'warn') ||
            dependencies.some(d => d.status === 'degraded');

        const status: HealthStatus = {
            status: hasFailedCriticalChecks ? 'unhealthy' : hasWarnings ? 'degraded' : 'healthy',
            timestamp: new Date(),
            uptime: Date.now() - this.startTime,
            checks,
            dependencies,
            metrics
        };

        this.emit('healthCheck', status);
        return status;
    }

    /**
     * Check individual endpoint
     */
    private async checkEndpoint(endpoint: any): Promise<HealthCheckResult> {
        const startTime = performance.now();
        
        try {
            // Simulate endpoint check (in real implementation, use HTTP client)
            await new Promise(resolve => setTimeout(resolve, Math.random() * 100));
            
            const duration = performance.now() - startTime;
            
            return {
                name: endpoint.name,
                status: 'pass',
                duration,
                details: { path: endpoint.path, method: endpoint.method }
            };
        } catch (error) {
            return {
                name: endpoint.name,
                status: 'fail',
                duration: performance.now() - startTime,
                error: (error as Error).message
            };
        }
    }

    /**
     * Check dependency status
     */
    private async checkDependency(dependency: any): Promise<DependencyStatus> {
        const startTime = performance.now();
        
        try {
            const healthStatus = await dependency.check();
            const responseTime = performance.now() - startTime;
            
            return {
                name: dependency.name,
                status: healthStatus.status === 'healthy' ? 'available' : 
                       healthStatus.status === 'degraded' ? 'degraded' : 'unavailable',
                responseTime,
                lastChecked: new Date()
            };
        } catch (error) {
            return {
                name: dependency.name,
                status: 'unavailable',
                responseTime: performance.now() - startTime,
                error: (error as Error).message,
                lastChecked: new Date()
            };
        }
    }

    /**
     * Gather health metrics
     */
    private async gatherHealthMetrics(): Promise<HealthMetrics> {
        const memoryUsage = this.getMemoryUsage();
        const cpuUsage = await this.getCPUUsage();
        
        // Calculate request metrics
        const totalRequests = this.requestMetrics.total;
        const errorRate = totalRequests > 0 ? (this.requestMetrics.errors / totalRequests) * 100 : 0;
        const avgResponseTime = this.requestMetrics.responseTimes.length > 0 ?
            this.requestMetrics.responseTimes.reduce((a, b) => a + b, 0) / this.requestMetrics.responseTimes.length : 0;

        return {
            memoryUsage,
            cpuUsage,
            activeConnections: 0, // Would be populated from actual connection pools
            requestsPerSecond: this.calculateRequestsPerSecond(),
            errorRate,
            averageResponseTime: avgResponseTime
        };
    }

    /**
     * Get memory usage information
     */
    private getMemoryUsage(): MemoryUsage {
        const memUsage = process.memoryUsage();
        const totalMemory = require('os').totalmem();
        const freeMemory = require('os').freemem();
        const usedMemory = totalMemory - freeMemory;

        return {
            used: usedMemory,
            total: totalMemory,
            percentage: (usedMemory / totalMemory) * 100,
            heap: {
                used: memUsage.heapUsed,
                total: memUsage.heapTotal,
                percentage: (memUsage.heapUsed / memUsage.heapTotal) * 100
            }
        };
    }

    /**
     * Get CPU usage (simplified implementation)
     */
    private async getCPUUsage(): Promise<number> {
        // Simplified CPU usage calculation
        const startUsage = process.cpuUsage();
        await new Promise(resolve => setTimeout(resolve, 100));
        const endUsage = process.cpuUsage(startUsage);
        
        const totalUsage = endUsage.user + endUsage.system;
        return (totalUsage / 1000000) * 10; // Convert to percentage
    }

    /**
     * Calculate requests per second
     */
    private calculateRequestsPerSecond(): number {
        const uptime = (Date.now() - this.startTime) / 1000;
        return uptime > 0 ? this.requestMetrics.total / uptime : 0;
    }

    /**
     * Start memory monitoring
     */
    private startMemoryMonitoring(): void {
        const config = this.config.memoryMonitoring;
        
        this.memoryMonitorInterval = setInterval(() => {
            this.checkMemoryUsage();
        }, config.interval);
    }

    /**
     * Check memory usage and trigger actions if needed
     */
    private checkMemoryUsage(): void {
        const memoryUsage = this.getMemoryUsage();
        const config = this.config.memoryMonitoring;

        // Check system memory thresholds
        if (memoryUsage.percentage >= config.thresholds.critical) {
            this.triggerMemoryActions('critical', memoryUsage);
        } else if (memoryUsage.percentage >= config.thresholds.warning) {
            this.triggerMemoryActions('warning', memoryUsage);
        }

        // Check heap memory thresholds
        if (memoryUsage.heap.percentage >= config.thresholds.heap.critical) {
            this.triggerMemoryActions('critical', memoryUsage);
        } else if (memoryUsage.heap.percentage >= config.thresholds.heap.warning) {
            this.triggerMemoryActions('warning', memoryUsage);
        }

        this.emit('memoryCheck', memoryUsage);
    }

    /**
     * Trigger memory actions based on threshold
     */
    private async triggerMemoryActions(threshold: 'warning' | 'critical', memoryUsage: MemoryUsage): Promise<void> {
        const actions = this.config.memoryMonitoring.actions.filter(a => a.threshold === threshold);

        for (const action of actions) {
            try {
                switch (action.action) {
                    case 'log':
                        this.emit('memoryWarning', { threshold, memoryUsage, action: 'log' });
                        break;
                    case 'gc':
                        if (global.gc) {
                            global.gc();
                            this.emit('memoryAction', { threshold, action: 'gc', memoryUsage });
                        }
                        break;
                    case 'alert':
                        this.emit('memoryAlert', { threshold, memoryUsage, severity: threshold });
                        break;
                    case 'throttle':
                        this.emit('memoryAction', { threshold, action: 'throttle', memoryUsage });
                        break;
                    case 'reject':
                        this.emit('memoryAction', { threshold, action: 'reject', memoryUsage });
                        break;
                    case 'custom':
                        if (action.execute) {
                            await action.execute();
                        }
                        break;
                }
            } catch (error) {
                this.emit('memoryActionError', { action: action.action, error });
            }
        }
    }

    /**
     * Setup graceful shutdown handling
     */
    private setupGracefulShutdown(): void {
        const config = this.config.gracefulShutdown;
        
        for (const signal of config.signals) {
            process.on(signal as NodeJS.Signals, () => {
                this.initiateGracefulShutdown(signal);
            });
        }
    }

    /**
     * Initiate graceful shutdown process
     */
    private initiateGracefulShutdown(signal: string): void {
        if (this.isShuttingDown) {
            return;
        }

        this.isShuttingDown = true;
        this.emit('shutdownInitiated', { signal });

        this.shutdownPromise = this.performGracefulShutdown();
        
        // Force exit if graceful shutdown takes too long
        setTimeout(() => {
            if (this.isShuttingDown) {
                this.emit('forceExit', { reason: 'timeout' });
                process.exit(1);
            }
        }, this.config.gracefulShutdown.forceExitTimeout);
    }

    /**
     * Perform graceful shutdown
     */
    private async performGracefulShutdown(): Promise<void> {
        const config = this.config.gracefulShutdown;
        const sortedHooks = [...config.hooks].sort((a, b) => a.priority - b.priority);

        for (const hook of sortedHooks) {
            try {
                this.emit('shutdownHookStarted', { hook: hook.name });
                
                const timeoutPromise = new Promise((_, reject) => {
                    setTimeout(() => reject(new Error(`Hook ${hook.name} timed out`)), hook.timeout);
                });

                await Promise.race([hook.execute(), timeoutPromise]);
                
                this.emit('shutdownHookCompleted', { hook: hook.name });
            } catch (error) {
                this.emit('shutdownHookError', { hook: hook.name, error });
            }
        }

        // Cleanup intervals
        this.cleanup();
        
        this.emit('shutdownCompleted');
        process.exit(0);
    }

    /**
     * Check for duplicate requests
     */
    async checkDeduplication(req: any): Promise<DeduplicationResult> {
        if (!this.config.deduplication.enabled) {
            return {
                isDuplicate: false,
                count: 1,
                action: 'processed',
                key: ''
            };
        }

        for (const level of this.config.deduplication.levels) {
            if (!level.enabled) continue;

            const key = level.keyGenerator(req);
            const existing = this.deduplicationStore.get(key);
            const now = new Date();

            if (existing) {
                // Check if still within TTL
                const age = now.getTime() - existing.timestamp.getTime();
                if (age <= level.ttl) {
                    // Update count
                    existing.count++;
                    this.deduplicationStore.set(key, existing);

                    return {
                        isDuplicate: true,
                        originalTimestamp: existing.timestamp,
                        count: existing.count,
                        action: level.action as any,
                        key
                    };
                } else {
                    // Expired, remove and continue
                    this.deduplicationStore.delete(key);
                }
            }

            // Not a duplicate, store for future checks
            this.deduplicationStore.set(key, {
                timestamp: now,
                count: 1
            });
        }

        return {
            isDuplicate: false,
            count: 1,
            action: 'processed',
            key: ''
        };
    }

    /**
     * Start deduplication cleanup
     */
    private startDeduplicationCleanup(): void {
        const config = this.config.deduplication.cleanup;
        
        if (!config.enabled) return;

        this.deduplicationCleanupInterval = setInterval(() => {
            this.cleanupDeduplicationStore();
        }, config.interval);
    }

    /**
     * Cleanup expired deduplication entries
     */
    private cleanupDeduplicationStore(): void {
        const config = this.config.deduplication.cleanup;
        const now = Date.now();
        let cleaned = 0;

        for (const [key, entry] of this.deduplicationStore.entries()) {
            const age = now - entry.timestamp.getTime();
            if (age > config.maxAge) {
                this.deduplicationStore.delete(key);
                cleaned++;
                
                if (cleaned >= config.batchSize) {
                    break;
                }
            }
        }

        if (cleaned > 0) {
            this.emit('deduplicationCleanup', { cleaned, remaining: this.deduplicationStore.size });
        }
    }

    /**
     * Record request metrics
     */
    recordRequest(responseTime: number, isError: boolean = false): void {
        this.requestMetrics.total++;
        if (isError) {
            this.requestMetrics.errors++;
        }
        
        this.requestMetrics.responseTimes.push(responseTime);
        
        // Keep only last 1000 response times
        if (this.requestMetrics.responseTimes.length > 1000) {
            this.requestMetrics.responseTimes = this.requestMetrics.responseTimes.slice(-1000);
        }
    }

    /**
     * Get current health status
     */
    async getCurrentHealthStatus(): Promise<HealthStatus> {
        return await this.performHealthCheck();
    }

    /**
     * Get reliability metrics
     */
    async getMetrics(): Promise<ReliabilityMetrics> {
        const healthStatus = await this.performHealthCheck();
        const memoryUsage = this.getMemoryUsage();

        const deduplicationMetrics: DeduplicationMetrics = {
            totalRequests: this.requestMetrics.total,
            duplicateRequests: 0, // Would be tracked separately
            deduplicationRate: 0,
            storageSize: this.deduplicationStore.size,
            cleanupRuns: 0, // Would be tracked
            lastCleanup: new Date()
        };

        const connectionPools: ConnectionPoolMetrics = {
            // Would be populated from actual connection pools
        };

        return {
            uptime: Date.now() - this.startTime,
            healthStatus,
            memoryUsage,
            connectionPools,
            deduplication: deduplicationMetrics,
            lastUpdated: new Date()
        };
    }

    /**
     * Check if system is ready to accept requests
     */
    async isReady(): Promise<boolean> {
        if (this.isShuttingDown) {
            return false;
        }

        const healthStatus = await this.performHealthCheck();
        return healthStatus.status !== 'unhealthy';
    }

    /**
     * Check if system is alive (basic liveness check)
     */
    isAlive(): boolean {
        return !this.isShuttingDown;
    }

    /**
     * Cleanup resources
     */
    private cleanup(): void {
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
        }
        if (this.memoryMonitorInterval) {
            clearInterval(this.memoryMonitorInterval);
        }
        if (this.deduplicationCleanupInterval) {
            clearInterval(this.deduplicationCleanupInterval);
        }
        this.removeAllListeners();
    }

    /**
     * Destroy the reliability manager
     */
    destroy(): void {
        this.cleanup();
    }
} 