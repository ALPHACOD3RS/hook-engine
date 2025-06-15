import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { 
    WebhookEvent, 
    BatchWebhookEvent, 
    EventFilter, 
    EventRoute, 
    ProcessingResult, 
    BatchProcessingResult,
    EventTransformation,
    EventDestination 
} from '../types/webhook';
import { WebhookAdapter } from '../types/adapter';
import { WebhookProcessingError, WebhookValidationError } from '../errors/webhook-errors';

export interface EventProcessorConfig {
    maxConcurrency?: number;
    defaultTimeout?: number;
    enableMetrics?: boolean;
    enableDeadLetterQueue?: boolean;
    retryFailedEvents?: boolean;
    maxRetries?: number;
}

export interface ProcessingPipeline {
    id: string;
    name: string;
    filters: EventFilter[];
    transformations: EventTransformation[];
    routes: EventRoute[];
    enabled: boolean;
    priority: number;
}

export interface TenantConfig {
    tenantId: string;
    pipelines: ProcessingPipeline[];
    rateLimits?: {
        eventsPerSecond: number;
        burstSize: number;
        windowSize: number;
    };
    allowedSources?: string[];
    blockedSources?: string[];
}

export class EventProcessor extends EventEmitter {
    private config: EventProcessorConfig;
    private pipelines: Map<string, ProcessingPipeline> = new Map();
    private tenantConfigs: Map<string, TenantConfig> = new Map();
    private processingQueue: WebhookEvent[] = [];
    private isProcessing = false;
    private metrics = {
        totalProcessed: 0,
        totalFailed: 0,
        averageProcessingTime: 0,
        lastProcessedAt: 0
    };

    constructor(config: EventProcessorConfig = {}) {
        super();
        this.config = {
            maxConcurrency: 10,
            defaultTimeout: 30000,
            enableMetrics: true,
            enableDeadLetterQueue: true,
            retryFailedEvents: true,
            maxRetries: 3,
            ...config
        };
    }

    /**
     * Add processing pipeline
     */
    addPipeline(pipeline: ProcessingPipeline): void {
        this.pipelines.set(pipeline.id, pipeline);
        this.emit('pipelineAdded', pipeline);
    }

    /**
     * Remove processing pipeline
     */
    removePipeline(pipelineId: string): boolean {
        const removed = this.pipelines.delete(pipelineId);
        if (removed) {
            this.emit('pipelineRemoved', pipelineId);
        }
        return removed;
    }

    /**
     * Add tenant configuration
     */
    addTenantConfig(tenantConfig: TenantConfig): void {
        this.tenantConfigs.set(tenantConfig.tenantId, tenantConfig);
        this.emit('tenantConfigAdded', tenantConfig);
    }

    /**
     * Process single event
     */
    async processEvent(event: WebhookEvent, adapter?: WebhookAdapter): Promise<ProcessingResult> {
        const startTime = Date.now();
        
        try {
            // Validate tenant if specified
            if (event.tenant && !this.validateTenantAccess(event)) {
                throw new WebhookValidationError('Tenant access denied');
            }

            // Get applicable pipelines
            const pipelines = this.getApplicablePipelines(event);
            
            if (pipelines.length === 0) {
                return {
                    success: true,
                    eventId: event.id,
                    processingTime: Date.now() - startTime
                };
            }

            // Process through each pipeline
            let transformedEvent = event;
            const routeResults: string[] = [];

            for (const pipeline of pipelines) {
                // Apply filters
                const filteredEvents = this.applyFilters([transformedEvent], pipeline.filters);
                if (filteredEvents.length === 0) continue;

                // Apply transformations
                const transformedEvents = await this.applyTransformations(filteredEvents, pipeline.transformations);
                if (transformedEvents.length > 0) {
                    transformedEvent = transformedEvents[0];
                }

                // Apply routing
                const matchingRoutes = this.getMatchingRoutes(transformedEvent, pipeline.routes);
                for (const route of matchingRoutes) {
                    await this.executeRoute(transformedEvent, route);
                    routeResults.push(route.id);
                }
            }

            const result: ProcessingResult = {
                success: true,
                eventId: event.id,
                transformedEvent,
                processingTime: Date.now() - startTime
            };

            this.updateMetrics(result);
            this.emit('eventProcessed', result);
            
            return result;

        } catch (error) {
            const result: ProcessingResult = {
                success: false,
                eventId: event.id,
                error: error as Error,
                processingTime: Date.now() - startTime
            };

            this.updateMetrics(result);
            this.emit('eventFailed', result);
            
            if (this.config.enableDeadLetterQueue) {
                this.emit('deadLetter', { event, error });
            }

            return result;
        }
    }

    /**
     * Process batch of events
     */
    async processBatch(batch: BatchWebhookEvent, adapter?: WebhookAdapter): Promise<BatchProcessingResult> {
        const startTime = Date.now();
        const results: ProcessingResult[] = [];
        const errors: Error[] = [];

        // Process events with concurrency control
        const chunks = this.chunkArray(batch.events, this.config.maxConcurrency!);
        
        for (const chunk of chunks) {
            const chunkPromises = chunk.map(event => this.processEvent(event, adapter));
            const chunkResults = await Promise.allSettled(chunkPromises);
            
            chunkResults.forEach((result, index) => {
                if (result.status === 'fulfilled') {
                    results.push(result.value);
                } else {
                    const error = result.reason as Error;
                    errors.push(error);
                    results.push({
                        success: false,
                        eventId: chunk[index].id,
                        error,
                        processingTime: 0
                    });
                }
            });
        }

        const successCount = results.filter(r => r.success).length;
        const failureCount = results.filter(r => !r.success).length;

        const batchResult: BatchProcessingResult = {
            batchId: batch.batchId,
            totalEvents: batch.events.length,
            successCount,
            failureCount,
            results,
            processingTime: Date.now() - startTime,
            errors
        };

        this.emit('batchProcessed', batchResult);
        return batchResult;
    }

    /**
     * Get applicable pipelines for event
     */
    private getApplicablePipelines(event: WebhookEvent): ProcessingPipeline[] {
        let pipelines: ProcessingPipeline[] = [];

        // Get tenant-specific pipelines
        if (event.tenant) {
            const tenantConfig = this.tenantConfigs.get(event.tenant);
            if (tenantConfig) {
                pipelines = tenantConfig.pipelines.filter(p => p.enabled);
            }
        }

        // Add global pipelines
        const globalPipelines = Array.from(this.pipelines.values())
            .filter(p => p.enabled);
        
        pipelines = [...pipelines, ...globalPipelines];

        // Sort by priority
        return pipelines.sort((a, b) => b.priority - a.priority);
    }

    /**
     * Apply filters to events
     */
    private applyFilters(events: WebhookEvent[], filters: EventFilter[]): WebhookEvent[] {
        let filteredEvents = events;

        for (const filter of filters) {
            filteredEvents = this.filterEvents(filteredEvents, filter);
        }

        return filteredEvents;
    }

    /**
     * Filter events based on criteria
     */
    private filterEvents(events: WebhookEvent[], filter: EventFilter): WebhookEvent[] {
        return events.filter(event => {
            // Filter by types
            if (filter.types && !filter.types.includes(event.type)) {
                return false;
            }

            // Filter by sources
            if (filter.sources && !filter.sources.includes(event.source)) {
                return false;
            }

            // Filter by tenants
            if (filter.tenants && event.tenant && !filter.tenants.includes(event.tenant)) {
                return false;
            }

            // Filter by tags
            if (filter.tags && event.tags) {
                const hasMatchingTag = filter.tags.some(tag => event.tags!.includes(tag));
                if (!hasMatchingTag) {
                    return false;
                }
            }

            // Filter by priority
            if (filter.priority && event.priority && !filter.priority.includes(event.priority)) {
                return false;
            }

            // Apply custom filter
            if (filter.customFilter && !filter.customFilter(event)) {
                return false;
            }

            return true;
        });
    }

    /**
     * Apply transformations to events
     */
    private async applyTransformations(events: WebhookEvent[], transformations: EventTransformation[]): Promise<WebhookEvent[]> {
        let transformedEvents = events;

        for (const transformation of transformations) {
            transformedEvents = await this.applyTransformation(transformedEvents, transformation);
        }

        return transformedEvents;
    }

    /**
     * Apply single transformation
     */
    private async applyTransformation(events: WebhookEvent[], transformation: EventTransformation): Promise<WebhookEvent[]> {
        switch (transformation.type) {
            case 'javascript':
                return this.applyJavaScriptTransformation(events, transformation.script);
            case 'jsonata':
                // Would require jsonata library
                return events;
            case 'custom':
                // Custom transformation logic
                return events;
            default:
                return events;
        }
    }

    /**
     * Apply JavaScript transformation
     */
    private applyJavaScriptTransformation(events: WebhookEvent[], script: string): WebhookEvent[] {
        try {
            const transformFunction = new Function('events', `
                return (${script})(events);
            `);
            
            return transformFunction(events);
        } catch (error) {
            throw new WebhookProcessingError(`JavaScript transformation failed: ${(error as Error).message}`);
        }
    }

    /**
     * Get matching routes for event
     */
    private getMatchingRoutes(event: WebhookEvent, routes: EventRoute[]): EventRoute[] {
        return routes
            .filter(route => route.enabled)
            .filter(route => {
                const matchingEvents = this.filterEvents([event], route.filter);
                return matchingEvents.length > 0;
            })
            .sort((a, b) => b.priority - a.priority);
    }

    /**
     * Execute route
     */
    private async executeRoute(event: WebhookEvent, route: EventRoute): Promise<void> {
        try {
            // Apply route transformation if specified
            let routeEvent = event;
            if (route.transform) {
                const transformed = await this.applyTransformation([event], route.transform);
                if (transformed.length > 0) {
                    routeEvent = transformed[0];
                }
            }

            // Execute destination
            await this.executeDestination(routeEvent, route.destination);
            
            this.emit('routeExecuted', { event: routeEvent, route });
        } catch (error) {
            this.emit('routeFailed', { event, route, error });
            throw error;
        }
    }

    /**
     * Execute destination
     */
    private async executeDestination(event: WebhookEvent, destination: string | EventDestination): Promise<void> {
        if (typeof destination === 'string') {
            // Simple webhook URL
            this.emit('webhookCall', { event, url: destination });
        } else {
            // Complex destination
            switch (destination.type) {
                case 'webhook':
                    this.emit('webhookCall', { event, config: destination.config });
                    break;
                case 'queue':
                    this.emit('queueMessage', { event, config: destination.config });
                    break;
                case 'database':
                    this.emit('databaseWrite', { event, config: destination.config });
                    break;
                case 'function':
                    this.emit('functionCall', { event, config: destination.config });
                    break;
                case 'custom':
                    this.emit('customDestination', { event, config: destination.config });
                    break;
            }
        }
    }

    /**
     * Validate tenant access
     */
    private validateTenantAccess(event: WebhookEvent): boolean {
        if (!event.tenant) return true;

        const tenantConfig = this.tenantConfigs.get(event.tenant);
        if (!tenantConfig) return false;

        // Check allowed/blocked sources
        if (tenantConfig.allowedSources && !tenantConfig.allowedSources.includes(event.source)) {
            return false;
        }

        if (tenantConfig.blockedSources && tenantConfig.blockedSources.includes(event.source)) {
            return false;
        }

        return true;
    }

    /**
     * Update processing metrics
     */
    private updateMetrics(result: ProcessingResult): void {
        if (!this.config.enableMetrics) return;

        this.metrics.totalProcessed++;
        if (!result.success) {
            this.metrics.totalFailed++;
        }

        // Update average processing time
        const totalTime = this.metrics.averageProcessingTime * (this.metrics.totalProcessed - 1) + result.processingTime;
        this.metrics.averageProcessingTime = totalTime / this.metrics.totalProcessed;
        this.metrics.lastProcessedAt = Date.now();
    }

    /**
     * Get processing metrics
     */
    getMetrics() {
        return { ...this.metrics };
    }

    /**
     * Utility: Chunk array into smaller arrays
     */
    private chunkArray<T>(array: T[], size: number): T[][] {
        const chunks: T[][] = [];
        for (let i = 0; i < array.length; i += size) {
            chunks.push(array.slice(i, i + size));
        }
        return chunks;
    }
}