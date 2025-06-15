import { WebhookEvent, BatchWebhookEvent, EventFilter, EventRoute, ProcessingResult, BatchProcessingResult, EventTransformation } from './webhook';

export interface WebhookAdapter {
    getSignature(req: any): string | undefined;
    verifySignature(rawBody: Buffer, signature: string, secret: string): boolean;
    parsePayload(rawBody: Buffer): any;
    normalize(event: any, options?: NormalizationOptions): WebhookEvent;
    
    // Advanced features
    supportsBatch?: boolean;
    supportsFiltering?: boolean;
    supportsRouting?: boolean;
    supportsMultiTenant?: boolean;
    
    // Batch processing
    parseBatchPayload?(rawBody: Buffer): any[];
    normalizeBatch?(events: any[], options?: BatchNormalizationOptions): BatchWebhookEvent;
    processBatch?(events: WebhookEvent[], options?: BatchProcessingOptions): Promise<BatchProcessingResult>;
    
    // Event filtering
    filterEvents?(events: WebhookEvent[], filter: EventFilter): WebhookEvent[];
    
    // Event routing
    routeEvent?(event: WebhookEvent, routes: EventRoute[]): EventRoute[];
    
    // Multi-tenant support
    extractTenant?(event: any, req?: any): string | undefined;
    validateTenant?(tenant: string, event: WebhookEvent): boolean;
}

export interface NormalizationOptions {
    tenant?: string;
    priority?: 'low' | 'normal' | 'high' | 'critical';
    tags?: string[];
    metadata?: Record<string, any>;
    includeRaw?: boolean;
}

export interface BatchNormalizationOptions extends NormalizationOptions {
    batchId?: string;
    preserveOrder?: boolean;
    skipInvalid?: boolean;
}

export interface BatchProcessingOptions {
    concurrency?: number;
    timeout?: number;
    retryFailures?: boolean;
    continueOnError?: boolean;
    transformations?: EventTransformation[];
}

export interface AdvancedWebhookAdapter extends WebhookAdapter {
    // Required advanced features
    supportsBatch: true;
    supportsFiltering: true;
    supportsRouting: true;
    supportsMultiTenant: true;
    
    parseBatchPayload(rawBody: Buffer): any[];
    normalizeBatch(events: any[], options?: BatchNormalizationOptions): BatchWebhookEvent;
    processBatch(events: WebhookEvent[], options?: BatchProcessingOptions): Promise<BatchProcessingResult>;
    filterEvents(events: WebhookEvent[], filter: EventFilter): WebhookEvent[];
    routeEvent(event: WebhookEvent, routes: EventRoute[]): EventRoute[];
    extractTenant(event: any, req?: any): string | undefined;
    validateTenant(tenant: string, event: WebhookEvent): boolean;
}