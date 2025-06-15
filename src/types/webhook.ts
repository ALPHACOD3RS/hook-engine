export interface WebhookEvent  {
    id: string;
    type: string;
    source: string;
    timestamp: number;
    payload: Record<string, any>;
    raw: string;
    // Advanced features
    tenant?: string;
    priority?: 'low' | 'normal' | 'high' | 'critical';
    tags?: string[];
    metadata?: Record<string, any>;
}

export interface BatchWebhookEvent {
    batchId: string;
    events: WebhookEvent[];
    totalCount: number;
    processedCount: number;
    failedCount: number;
    timestamp: number;
    metadata?: Record<string, any>;
}

export interface EventFilter {
    types?: string[];
    sources?: string[];
    tenants?: string[];
    tags?: string[];
    priority?: ('low' | 'normal' | 'high' | 'critical')[];
    customFilter?: (event: WebhookEvent) => boolean;
}

export interface EventRoute {
    id: string;
    name: string;
    filter: EventFilter;
    destination: string | EventDestination;
    transform?: EventTransformation;
    enabled: boolean;
    priority: number;
    metadata?: Record<string, any>;
}

export interface EventDestination {
    type: 'webhook' | 'queue' | 'database' | 'function' | 'custom';
    config: Record<string, any>;
}

export interface EventTransformation {
    type: 'javascript' | 'jsonata' | 'custom';
    script: string;
    config?: Record<string, any>;
}

export interface ProcessingResult {
    success: boolean;
    eventId: string;
    error?: Error;
    transformedEvent?: WebhookEvent;
    routeId?: string;
    processingTime: number;
}

export interface BatchProcessingResult {
    batchId: string;
    totalEvents: number;
    successCount: number;
    failureCount: number;
    results: ProcessingResult[];
    processingTime: number;
    errors: Error[];
}
