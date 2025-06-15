/**
 * Structured Logging Types for Hook Engine
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export interface WebhookLogEntry {
    timestamp: string;
    level: LogLevel;
    eventId: string;
    source: string;
    operation: string;
    duration: number;
    status: 'success' | 'failure' | 'retry';
    metadata: Record<string, any>;
}

export interface SecurityLogEntry {
    timestamp: string;
    level: LogLevel;
    eventId: string;
    securityEvent: string;
    source: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    details: {
        ip?: string;
        userAgent?: string;
        endpoint?: string;
        reason?: string;
        action?: string;
    };
    metadata: Record<string, any>;
}

export interface PerformanceLogEntry {
    timestamp: string;
    level: LogLevel;
    eventId: string;
    operation: string;
    duration: number;
    metrics: {
        memoryUsage?: number;
        cpuUsage?: number;
        requestCount?: number;
        errorRate?: number;
        throughput?: number;
    };
    metadata: Record<string, any>;
}

export interface ErrorLogEntry {
    timestamp: string;
    level: LogLevel;
    eventId: string;
    error: {
        name: string;
        message: string;
        stack?: string;
        code?: string;
    };
    context: {
        operation: string;
        source: string;
        webhookId?: string;
        adapterId?: string;
        retryAttempt?: number;
    };
    metadata: Record<string, any>;
}

export interface LoggerConfig {
    level: LogLevel;
    format: 'json' | 'text' | 'structured';
    outputs: LogOutput[];
    enableColors: boolean;
    enableTimestamps: boolean;
    enableStackTrace: boolean;
    maxFileSize: number;
    maxFiles: number;
    rotateDaily: boolean;
}

export interface LogOutput {
    type: 'console' | 'file' | 'http' | 'database';
    config: any;
}

export interface LogContext {
    requestId?: string;
    sessionId?: string;
    userId?: string;
    tenantId?: string;
    webhookId?: string;
    adapterId?: string;
    operation?: string;
    source?: string;
    tags?: string[];
    custom?: Record<string, any>;
}

export interface LoggerInterface {
    debug(message: string, context?: LogContext, metadata?: Record<string, any>): void;
    info(message: string, context?: LogContext, metadata?: Record<string, any>): void;
    warn(message: string, context?: LogContext, metadata?: Record<string, any>): void;
    error(message: string, error?: Error, context?: LogContext, metadata?: Record<string, any>): void;
    fatal(message: string, error?: Error, context?: LogContext, metadata?: Record<string, any>): void;
    
    webhook(entry: Omit<WebhookLogEntry, 'timestamp' | 'eventId'>): void;
    security(entry: Omit<SecurityLogEntry, 'timestamp' | 'eventId'>): void;
    performance(entry: Omit<PerformanceLogEntry, 'timestamp' | 'eventId'>): void;
    
    child(context: LogContext): LoggerInterface;
    setLevel(level: LogLevel): void;
    flush(): Promise<void>;
    
    // Optional config property for accessing configuration
    config?: LoggerConfig;
} 