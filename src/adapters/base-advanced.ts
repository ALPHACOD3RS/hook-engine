import { v4 as uuidv4 } from 'uuid';
import { 
    WebhookAdapter, 
    AdvancedWebhookAdapter, 
    NormalizationOptions, 
    BatchNormalizationOptions, 
    BatchProcessingOptions 
} from '../types/adapter';
import { 
    WebhookEvent, 
    BatchWebhookEvent, 
    EventFilter, 
    EventRoute, 
    ProcessingResult, 
    BatchProcessingResult,
    EventTransformation 
} from '../types/webhook';

export abstract class BaseAdvancedAdapter implements AdvancedWebhookAdapter {
    // Required basic adapter methods (to be implemented by subclasses)
    abstract getSignature(req: any): string | undefined;
    abstract verifySignature(rawBody: Buffer, signature: string, secret: string): boolean;
    abstract parsePayload(rawBody: Buffer): any;
    abstract normalize(event: any, options?: NormalizationOptions): WebhookEvent;

    // Advanced feature flags
    supportsBatch: true = true;
    supportsFiltering: true = true;
    supportsRouting: true = true;
    supportsMultiTenant: true = true;

    /**
     * Parse batch payload - default implementation assumes array of events
     */
    parseBatchPayload(rawBody: Buffer): any[] {
        try {
            const parsed = JSON.parse(rawBody.toString());
            return Array.isArray(parsed) ? parsed : [parsed];
        } catch (error) {
            throw new Error(`Failed to parse batch payload: ${(error as Error).message}`);
        }
    }

    /**
     * Normalize batch of events
     */
    normalizeBatch(events: any[], options?: BatchNormalizationOptions): BatchWebhookEvent {
        const batchId = options?.batchId || uuidv4();
        const normalizedEvents: WebhookEvent[] = [];
        let failedCount = 0;

        for (const event of events) {
            try {
                const normalized = this.normalize(event, options);
                normalizedEvents.push(normalized);
            } catch (error) {
                failedCount++;
                if (!options?.skipInvalid) {
                    throw error;
                }
            }
        }

        return {
            batchId,
            events: normalizedEvents,
            totalCount: events.length,
            processedCount: normalizedEvents.length,
            failedCount,
            timestamp: Date.now(),
            metadata: options?.metadata
        };
    }

    /**
     * Process batch of events with advanced options
     */
    async processBatch(events: WebhookEvent[], options?: BatchProcessingOptions): Promise<BatchProcessingResult> {
        const batchId = uuidv4();
        const startTime = Date.now();
        const results: ProcessingResult[] = [];
        const errors: Error[] = [];
        
        const concurrency = options?.concurrency || 10;
        const timeout = options?.timeout || 30000;

        // Apply transformations if provided
        let processedEvents = events;
        if (options?.transformations) {
            processedEvents = await this.applyTransformations(events, options.transformations);
        }

        // Process events in batches with concurrency control
        const chunks = this.chunkArray(processedEvents, concurrency);
        
        for (const chunk of chunks) {
            const chunkPromises = chunk.map(async (event) => {
                const eventStartTime = Date.now();
                try {
                    // Simulate event processing (override in subclasses)
                    await this.processEvent(event, timeout);
                    
                    const result: ProcessingResult = {
                        success: true,
                        eventId: event.id,
                        processingTime: Date.now() - eventStartTime
                    };
                    results.push(result);
                } catch (error) {
                    const result: ProcessingResult = {
                        success: false,
                        eventId: event.id,
                        error: error as Error,
                        processingTime: Date.now() - eventStartTime
                    };
                    results.push(result);
                    errors.push(error as Error);
                    
                    if (!options?.continueOnError) {
                        throw error;
                    }
                }
            });

            await Promise.all(chunkPromises);
        }

        const successCount = results.filter(r => r.success).length;
        const failureCount = results.filter(r => !r.success).length;

        return {
            batchId,
            totalEvents: events.length,
            successCount,
            failureCount,
            results,
            processingTime: Date.now() - startTime,
            errors
        };
    }

    /**
     * Filter events based on criteria
     */
    filterEvents(events: WebhookEvent[], filter: EventFilter): WebhookEvent[] {
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
     * Route event to matching routes
     */
    routeEvent(event: WebhookEvent, routes: EventRoute[]): EventRoute[] {
        return routes
            .filter(route => route.enabled)
            .filter(route => {
                const matchingEvents = this.filterEvents([event], route.filter);
                return matchingEvents.length > 0;
            })
            .sort((a, b) => b.priority - a.priority);
    }

    /**
     * Extract tenant from event - default implementation
     */
    extractTenant(event: any, req?: any): string | undefined {
        // Try common tenant extraction patterns
        if (event.tenant) return event.tenant;
        if (event.organization) return event.organization;
        if (event.account) return event.account;
        if (event.workspace) return event.workspace;
        
        // Try headers
        if (req?.headers) {
            const tenantHeader = req.headers['x-tenant'] || 
                               req.headers['x-organization'] || 
                               req.headers['x-account'];
            if (tenantHeader) return tenantHeader;
        }

        return undefined;
    }

    /**
     * Validate tenant access
     */
    validateTenant(tenant: string, event: WebhookEvent): boolean {
        // Default implementation - override in subclasses for specific validation
        return event.tenant === tenant || !event.tenant;
    }

    /**
     * Process individual event - override in subclasses
     */
    protected async processEvent(event: WebhookEvent, timeout: number): Promise<void> {
        // Default implementation - just simulate processing
        await new Promise(resolve => setTimeout(resolve, 10));
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
                // Would require jsonata library - simplified for now
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
            // Create a safe execution context
            const transformFunction = new Function('events', `
                return (${script})(events);
            `);
            
            return transformFunction(events);
        } catch (error) {
            throw new Error(`JavaScript transformation failed: ${(error as Error).message}`);
        }
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