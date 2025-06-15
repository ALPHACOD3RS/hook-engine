import { EventEmitter } from 'events';
import { WebhookEvent } from '../types/webhook';
import { WebhookAdapter } from '../types/adapter';
import { EventProcessor, TenantConfig } from './event-processor';
import { WebhookValidationError, WebhookRateLimitError, WebhookAdapterError } from '../errors/webhook-errors';

export interface TenantRateLimit {
    eventsPerSecond: number;
    burstSize: number;
    windowSize: number; // in milliseconds
}

export interface TenantMetrics {
    totalEvents: number;
    successfulEvents: number;
    failedEvents: number;
    lastEventAt: number;
    averageProcessingTime: number;
    rateLimitHits: number;
}

export interface TenantIsolationConfig {
    enableResourceIsolation: boolean;
    maxMemoryPerTenant: number; // in MB
    maxConcurrentEvents: number;
    enableNetworkIsolation: boolean;
    allowedDomains?: string[];
    blockedDomains?: string[];
}

export interface MultiTenantConfig {
    defaultRateLimit: TenantRateLimit;
    defaultIsolation: TenantIsolationConfig;
    enableTenantMetrics: boolean;
    enableGlobalRateLimit: boolean;
    globalRateLimit?: TenantRateLimit;
}

interface RateLimitWindow {
    count: number;
    windowStart: number;
    burstCount: number;
}

export class MultiTenantHandler extends EventEmitter {
    private config: MultiTenantConfig;
    private eventProcessor: EventProcessor;
    private tenantConfigs: Map<string, TenantConfig> = new Map();
    private tenantMetrics: Map<string, TenantMetrics> = new Map();
    private rateLimitWindows: Map<string, RateLimitWindow> = new Map();
    private tenantResourceUsage: Map<string, { memory: number; activeEvents: number }> = new Map();

    constructor(eventProcessor: EventProcessor, config: MultiTenantConfig) {
        super();
        this.eventProcessor = eventProcessor;
        this.config = {
            ...config,
            defaultRateLimit: config.defaultRateLimit || {
                eventsPerSecond: 100,
                burstSize: 200,
                windowSize: 1000
            },
            defaultIsolation: config.defaultIsolation || {
                enableResourceIsolation: true,
                maxMemoryPerTenant: 100, // 100MB
                maxConcurrentEvents: 50,
                enableNetworkIsolation: false
            },
            enableTenantMetrics: config.enableTenantMetrics ?? true,
            enableGlobalRateLimit: config.enableGlobalRateLimit ?? false
        };
    }

    /**
     * Register tenant configuration
     */
    registerTenant(tenantConfig: TenantConfig): void {
        this.tenantConfigs.set(tenantConfig.tenantId, tenantConfig);
        this.eventProcessor.addTenantConfig(tenantConfig);
        
        // Initialize metrics
        if (this.config.enableTenantMetrics) {
            this.tenantMetrics.set(tenantConfig.tenantId, {
                totalEvents: 0,
                successfulEvents: 0,
                failedEvents: 0,
                lastEventAt: 0,
                averageProcessingTime: 0,
                rateLimitHits: 0
            });
        }

        // Initialize resource tracking
        this.tenantResourceUsage.set(tenantConfig.tenantId, {
            memory: 0,
            activeEvents: 0
        });

        this.emit('tenantRegistered', tenantConfig);
    }

    /**
     * Unregister tenant
     */
    unregisterTenant(tenantId: string): boolean {
        const removed = this.tenantConfigs.delete(tenantId);
        if (removed) {
            this.tenantMetrics.delete(tenantId);
            this.rateLimitWindows.delete(tenantId);
            this.tenantResourceUsage.delete(tenantId);
            this.emit('tenantUnregistered', tenantId);
        }
        return removed;
    }

    /**
     * Process webhook event with multi-tenant support
     */
    async processWebhookEvent(
        rawBody: Buffer,
        headers: Record<string, string>,
        adapter: WebhookAdapter,
        tenantId?: string
    ): Promise<WebhookEvent> {
        const startTime = Date.now();

        try {
            // Extract tenant if not provided
            if (!tenantId) {
                const parsedPayload = adapter.parsePayload(rawBody);
                tenantId = adapter.extractTenant?.(parsedPayload, { headers }) || 'default';
            }

            // Validate tenant
            if (!this.validateTenant(tenantId)) {
                throw new WebhookValidationError(`Invalid tenant: ${tenantId}`);
            }

            // Check rate limits
            if (!this.checkRateLimit(tenantId)) {
                this.updateTenantMetrics(tenantId, { rateLimitHit: true });
                throw new WebhookRateLimitError(0, 1000, { tenant: tenantId });
            }

            // Check resource limits
            if (!this.checkResourceLimits(tenantId)) {
                throw new WebhookValidationError(`Resource limit exceeded for tenant: ${tenantId}`);
            }

            // Parse and normalize event
            const parsedPayload = adapter.parsePayload(rawBody);
            const normalizedEvent = adapter.normalize(parsedPayload, {
                tenant: tenantId,
                includeRaw: true
            });

            // Validate tenant access to event
            if (!this.validateTenantEventAccess(tenantId, normalizedEvent)) {
                throw new WebhookValidationError(`Tenant access denied for event`);
            }

            // Track resource usage
            this.trackResourceUsage(tenantId, 'start');

            try {
                // Process event through tenant-specific pipelines
                const result = await this.eventProcessor.processEvent(normalizedEvent, adapter);
                
                this.updateTenantMetrics(tenantId, {
                    success: result.success,
                    processingTime: result.processingTime
                });

                return normalizedEvent;
            } finally {
                this.trackResourceUsage(tenantId, 'end');
            }

        } catch (error) {
            this.updateTenantMetrics(tenantId || 'unknown', {
                success: false,
                processingTime: Date.now() - startTime
            });
            throw error;
        }
    }

    /**
     * Process batch webhook events
     */
    async processBatchWebhookEvents(
        rawBody: Buffer,
        headers: Record<string, string>,
        adapter: WebhookAdapter,
        tenantId?: string
    ): Promise<WebhookEvent[]> {
        if (!adapter.supportsBatch) {
            throw new WebhookAdapterError('batch processing not supported');
        }

        const startTime = Date.now();

        try {
            // Parse batch payload
            const batchPayload = adapter.parseBatchPayload!(rawBody);
            
            // Extract tenant if not provided
            if (!tenantId && batchPayload.length > 0) {
                tenantId = adapter.extractTenant?.(batchPayload[0], { headers }) || 'default';
            }

            // Validate tenant
            if (!this.validateTenant(tenantId!)) {
                throw new WebhookValidationError(`Invalid tenant: ${tenantId}`);
            }

            // Check batch rate limits (stricter for batches)
            const batchRateLimit = this.getBatchRateLimit(tenantId!, batchPayload.length);
            if (!this.checkBatchRateLimit(tenantId!, batchPayload.length, batchRateLimit)) {
                throw new WebhookRateLimitError(0, 1000, { tenant: tenantId, batch: true });
            }

            // Normalize batch
            const batchEvent = adapter.normalizeBatch!(batchPayload, {
                tenant: tenantId,
                includeRaw: true
            });

            // Validate tenant access to all events
            for (const event of batchEvent.events) {
                if (!this.validateTenantEventAccess(tenantId!, event)) {
                    throw new WebhookValidationError(`Tenant access denied for batch event`);
                }
            }

            // Track resource usage
            this.trackResourceUsage(tenantId!, 'start', batchEvent.events.length);

            try {
                // Process batch
                const result = await this.eventProcessor.processBatch(batchEvent, adapter);
                
                this.updateTenantMetrics(tenantId!, {
                    success: result.successCount > 0,
                    processingTime: result.processingTime,
                    batchSize: batchEvent.events.length
                });

                return batchEvent.events;
            } finally {
                this.trackResourceUsage(tenantId!, 'end', batchEvent.events.length);
            }

        } catch (error) {
            this.updateTenantMetrics(tenantId || 'unknown', {
                success: false,
                processingTime: Date.now() - startTime
            });
            throw error;
        }
    }

    /**
     * Validate tenant exists and is active
     */
    private validateTenant(tenantId: string): boolean {
        return this.tenantConfigs.has(tenantId) || tenantId === 'default';
    }

    /**
     * Check rate limits for tenant
     */
    private checkRateLimit(tenantId: string): boolean {
        const tenantConfig = this.tenantConfigs.get(tenantId);
        const rateLimit = tenantConfig?.rateLimits || this.config.defaultRateLimit;
        
        const now = Date.now();
        const windowKey = tenantId;
        
        let window = this.rateLimitWindows.get(windowKey);
        if (!window || (now - window.windowStart) >= rateLimit.windowSize) {
            // New window
            window = {
                count: 0,
                windowStart: now,
                burstCount: 0
            };
            this.rateLimitWindows.set(windowKey, window);
        }

        // Check burst limit
        if (window.burstCount >= rateLimit.burstSize) {
            return false;
        }

        // Check rate limit
        const expectedCount = ((now - window.windowStart) / 1000) * rateLimit.eventsPerSecond;
        if (window.count >= expectedCount) {
            return false;
        }

        // Update counters
        window.count++;
        window.burstCount++;

        return true;
    }

    /**
     * Check batch rate limits
     */
    private checkBatchRateLimit(tenantId: string, batchSize: number, rateLimit: TenantRateLimit): boolean {
        // For batches, we check if the entire batch can be processed within limits
        for (let i = 0; i < batchSize; i++) {
            if (!this.checkRateLimit(tenantId)) {
                return false;
            }
        }
        return true;
    }

    /**
     * Get batch-specific rate limit (usually more restrictive)
     */
    private getBatchRateLimit(tenantId: string, batchSize: number): TenantRateLimit {
        const tenantConfig = this.tenantConfigs.get(tenantId);
        const baseLimit = tenantConfig?.rateLimits || this.config.defaultRateLimit;
        
        // Reduce limits for large batches
        const batchFactor = Math.max(0.1, 1 / Math.sqrt(batchSize));
        
        return {
            eventsPerSecond: Math.floor(baseLimit.eventsPerSecond * batchFactor),
            burstSize: Math.floor(baseLimit.burstSize * batchFactor),
            windowSize: baseLimit.windowSize
        };
    }

    /**
     * Check resource limits for tenant
     */
    private checkResourceLimits(tenantId: string): boolean {
        const usage = this.tenantResourceUsage.get(tenantId);
        if (!usage) return true;

        const isolation = this.config.defaultIsolation;
        
        // Check memory limit
        if (isolation.enableResourceIsolation && usage.memory > isolation.maxMemoryPerTenant) {
            return false;
        }

        // Check concurrent events limit
        if (usage.activeEvents >= isolation.maxConcurrentEvents) {
            return false;
        }

        return true;
    }

    /**
     * Validate tenant access to specific event
     */
    private validateTenantEventAccess(tenantId: string, event: WebhookEvent): boolean {
        const tenantConfig = this.tenantConfigs.get(tenantId);
        if (!tenantConfig) return tenantId === 'default';

        // Check allowed sources
        if (tenantConfig.allowedSources && !tenantConfig.allowedSources.includes(event.source)) {
            return false;
        }

        // Check blocked sources
        if (tenantConfig.blockedSources && tenantConfig.blockedSources.includes(event.source)) {
            return false;
        }

        return true;
    }

    /**
     * Track resource usage for tenant
     */
    private trackResourceUsage(tenantId: string, action: 'start' | 'end', eventCount: number = 1): void {
        const usage = this.tenantResourceUsage.get(tenantId);
        if (!usage) return;

        if (action === 'start') {
            usage.activeEvents += eventCount;
            // Estimate memory usage (simplified)
            usage.memory += eventCount * 0.1; // 0.1MB per event estimate
        } else {
            usage.activeEvents = Math.max(0, usage.activeEvents - eventCount);
            usage.memory = Math.max(0, usage.memory - eventCount * 0.1);
        }
    }

    /**
     * Update tenant metrics
     */
    private updateTenantMetrics(tenantId: string, update: {
        success?: boolean;
        processingTime?: number;
        rateLimitHit?: boolean;
        batchSize?: number;
    }): void {
        if (!this.config.enableTenantMetrics) return;

        let metrics = this.tenantMetrics.get(tenantId);
        if (!metrics) {
            metrics = {
                totalEvents: 0,
                successfulEvents: 0,
                failedEvents: 0,
                lastEventAt: 0,
                averageProcessingTime: 0,
                rateLimitHits: 0
            };
            this.tenantMetrics.set(tenantId, metrics);
        }

        const eventCount = update.batchSize || 1;
        metrics.totalEvents += eventCount;
        metrics.lastEventAt = Date.now();

        if (update.success !== undefined) {
            if (update.success) {
                metrics.successfulEvents += eventCount;
            } else {
                metrics.failedEvents += eventCount;
            }
        }

        if (update.processingTime !== undefined) {
            const totalTime = metrics.averageProcessingTime * (metrics.totalEvents - eventCount) + update.processingTime;
            metrics.averageProcessingTime = totalTime / metrics.totalEvents;
        }

        if (update.rateLimitHit) {
            metrics.rateLimitHits++;
        }
    }

    /**
     * Get tenant metrics
     */
    getTenantMetrics(tenantId: string): TenantMetrics | undefined {
        return this.tenantMetrics.get(tenantId);
    }

    /**
     * Get all tenant metrics
     */
    getAllTenantMetrics(): Map<string, TenantMetrics> {
        return new Map(this.tenantMetrics);
    }

    /**
     * Get tenant resource usage
     */
    getTenantResourceUsage(tenantId: string) {
        return this.tenantResourceUsage.get(tenantId);
    }

    /**
     * Reset tenant metrics
     */
    resetTenantMetrics(tenantId: string): void {
        this.tenantMetrics.delete(tenantId);
    }
} 