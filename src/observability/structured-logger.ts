import { EventEmitter } from 'events';
import fs from 'fs/promises';
import path from 'path';
import { existsSync } from 'fs';
import { v4 as uuidv4 } from 'uuid';
import {
    LogLevel,
    LoggerInterface,
    LoggerConfig,
    LogContext,
    WebhookLogEntry,
    SecurityLogEntry,
    PerformanceLogEntry,
    ErrorLogEntry,
    LogOutput
} from '../types/logging';

export class StructuredLogger extends EventEmitter implements LoggerInterface {
    public config: LoggerConfig;
    private context: LogContext;
    private outputs: Map<string, LogTransport> = new Map();
    private logBuffer: any[] = [];
    private flushTimer?: NodeJS.Timeout;

    constructor(config: Partial<LoggerConfig> = {}, context: LogContext = {}) {
        super();
        
        this.config = {
            level: 'info',
            format: 'json',
            outputs: [{ type: 'console', config: { colorize: true, timestamp: true, level: 'info' } }],
            enableColors: true,
            enableTimestamps: true,
            enableStackTrace: true,
            maxFileSize: 10 * 1024 * 1024, // 10MB
            maxFiles: 5,
            rotateDaily: false,
            ...config
        };
        
        this.context = context;
        this.initializeOutputs();
        this.startFlushTimer();
    }

    private async initializeOutputs() {
        for (const output of this.config.outputs) {
            try {
                const transport = await this.createTransport(output);
                this.outputs.set(output.type, transport);
            } catch (error) {
                console.error(`Failed to initialize ${output.type} transport:`, error);
            }
        }
    }

    private async createTransport(output: LogOutput): Promise<LogTransport> {
        switch (output.type) {
            case 'console':
                return new ConsoleTransport(output.config);
            case 'file':
                return new FileTransport(output.config);
            case 'http':
                return new HttpTransport(output.config);
            case 'database':
                return new DatabaseTransport(output.config);
            default:
                throw new Error(`Unsupported transport type: ${output.type}`);
        }
    }

    private startFlushTimer() {
        this.flushTimer = setInterval(() => {
            this.flush().catch(console.error);
        }, 5000); // Flush every 5 seconds
    }

    private shouldLog(level: LogLevel): boolean {
        const levels: LogLevel[] = ['debug', 'info', 'warn', 'error', 'fatal'];
        const configLevelIndex = levels.indexOf(this.config.level);
        const messageLevelIndex = levels.indexOf(level);
        return messageLevelIndex >= configLevelIndex;
    }

    private generateEventId(): string {
        return uuidv4();
    }

    private createBaseEntry(level: LogLevel, message: string, context?: LogContext, metadata?: Record<string, any>) {
        return {
            timestamp: new Date().toISOString(),
            level,
            eventId: this.generateEventId(),
            message,
            source: context?.source || this.context.source || 'hook-engine',
            context: { ...this.context, ...context },
            metadata: metadata || {},
            pid: process.pid,
            hostname: require('os').hostname()
        };
    }

    debug(message: string, context?: LogContext, metadata?: Record<string, any>): void {
        if (!this.shouldLog('debug')) return;
        const entry = this.createBaseEntry('debug', message, context, metadata);
        this.writeLog(entry);
    }

    info(message: string, context?: LogContext, metadata?: Record<string, any>): void {
        if (!this.shouldLog('info')) return;
        const entry = this.createBaseEntry('info', message, context, metadata);
        this.writeLog(entry);
    }

    warn(message: string, context?: LogContext, metadata?: Record<string, any>): void {
        if (!this.shouldLog('warn')) return;
        const entry = this.createBaseEntry('warn', message, context, metadata);
        this.writeLog(entry);
    }

    error(message: string, error?: Error, context?: LogContext, metadata?: Record<string, any>): void {
        if (!this.shouldLog('error')) return;
        const entry: ErrorLogEntry = {
            timestamp: new Date().toISOString(),
            level: 'error',
            eventId: this.generateEventId(),
            error: {
                name: error?.name || 'Error',
                message: error?.message || message,
                stack: this.config.enableStackTrace ? error?.stack : undefined,
                code: (error as any)?.code
            },
            context: {
                operation: context?.operation || this.context.operation || 'unknown',
                source: context?.source || this.context.source || 'hook-engine',
                webhookId: context?.webhookId || this.context.webhookId,
                adapterId: context?.adapterId || this.context.adapterId,
                retryAttempt: (context?.custom as any)?.retryAttempt
            },
            metadata: { ...metadata, originalMessage: message }
        };
        this.writeLog(entry);
    }

    fatal(message: string, error?: Error, context?: LogContext, metadata?: Record<string, any>): void {
        if (!this.shouldLog('fatal')) return;
        const entry: ErrorLogEntry = {
            timestamp: new Date().toISOString(),
            level: 'fatal',
            eventId: this.generateEventId(),
            error: {
                name: error?.name || 'FatalError',
                message: error?.message || message,
                stack: this.config.enableStackTrace ? error?.stack : undefined,
                code: (error as any)?.code
            },
            context: {
                operation: context?.operation || this.context.operation || 'unknown',
                source: context?.source || this.context.source || 'hook-engine',
                webhookId: context?.webhookId || this.context.webhookId,
                adapterId: context?.adapterId || this.context.adapterId,
                retryAttempt: (context?.custom as any)?.retryAttempt
            },
            metadata: { ...metadata, originalMessage: message }
        };
        this.writeLog(entry);
        
        // Emit fatal event for immediate handling
        this.emit('fatal', entry);
    }

    webhook(entry: Omit<WebhookLogEntry, 'timestamp' | 'eventId'>): void {
        if (!this.shouldLog(entry.level)) return;
        const webhookEntry: WebhookLogEntry = {
            timestamp: new Date().toISOString(),
            eventId: this.generateEventId(),
            ...entry
        };
        this.writeLog(webhookEntry);
        this.emit('webhook', webhookEntry);
    }

    security(entry: Omit<SecurityLogEntry, 'timestamp' | 'eventId'>): void {
        if (!this.shouldLog(entry.level)) return;
        const securityEntry: SecurityLogEntry = {
            timestamp: new Date().toISOString(),
            eventId: this.generateEventId(),
            ...entry
        };
        this.writeLog(securityEntry);
        this.emit('security', securityEntry);
    }

    performance(entry: Omit<PerformanceLogEntry, 'timestamp' | 'eventId'>): void {
        if (!this.shouldLog(entry.level)) return;
        const perfEntry: PerformanceLogEntry = {
            timestamp: new Date().toISOString(),
            eventId: this.generateEventId(),
            ...entry
        };
        this.writeLog(perfEntry);
        this.emit('performance', perfEntry);
    }

    child(context: LogContext): LoggerInterface {
        return new StructuredLogger(this.config, { ...this.context, ...context });
    }

    setLevel(level: LogLevel): void {
        this.config.level = level;
    }

    private async writeLog(entry: any): Promise<void> {
        // Add to buffer for batch processing
        this.logBuffer.push(entry);
        
        // Write to all configured outputs
        const promises = Array.from(this.outputs.values()).map(transport => 
            transport.write(entry).catch(error => {
                console.error('Transport write error:', error);
            })
        );
        
        await Promise.allSettled(promises);
    }

    async flush(): Promise<void> {
        if (this.logBuffer.length === 0) return;
        
        const promises = Array.from(this.outputs.values()).map(transport => 
            transport.flush().catch(error => {
                console.error('Transport flush error:', error);
            })
        );
        
        await Promise.allSettled(promises);
        this.logBuffer = [];
    }

    async close(): Promise<void> {
        if (this.flushTimer) {
            clearInterval(this.flushTimer);
        }
        
        await this.flush();
        
        const promises = Array.from(this.outputs.values()).map(transport => 
            transport.close().catch(error => {
                console.error('Transport close error:', error);
            })
        );
        
        await Promise.allSettled(promises);
        this.outputs.clear();
    }
}

// Transport interfaces and implementations
interface LogTransport {
    write(entry: any): Promise<void>;
    flush(): Promise<void>;
    close(): Promise<void>;
}

class ConsoleTransport implements LogTransport {
    private config: any;
    
    constructor(config: any) {
        this.config = config;
    }
    
    async write(entry: any): Promise<void> {
        const formatted = this.formatEntry(entry);
        console.log(formatted);
    }
    
    private formatEntry(entry: any): string {
        if (this.config.colorize) {
            return this.colorizeEntry(entry);
        }
        return JSON.stringify(entry);
    }
    
    private colorizeEntry(entry: any): string {
        const colors = {
            debug: '\x1b[36m',    // Cyan
            info: '\x1b[32m',     // Green
            warn: '\x1b[33m',     // Yellow
            error: '\x1b[31m',    // Red
            fatal: '\x1b[35m',    // Magenta
            reset: '\x1b[0m'
        };
        
        const color = colors[entry.level as keyof typeof colors] || colors.reset;
        const timestamp = entry.timestamp ? `[${entry.timestamp}] ` : '';
        const level = `${color}${entry.level.toUpperCase()}${colors.reset}`;
        const message = entry.message || JSON.stringify(entry);
        
        return `${timestamp}${level}: ${message}`;
    }
    
    async flush(): Promise<void> {
        // Console doesn't need flushing
    }
    
    async close(): Promise<void> {
        // Console doesn't need closing
    }
}

class FileTransport implements LogTransport {
    private config: any;
    private writeBuffer: string[] = [];
    
    constructor(config: any) {
        this.config = config;
        this.ensureLogDirectory();
    }
    
    private async ensureLogDirectory(): Promise<void> {
        const dir = path.dirname(this.config.filename);
        if (!existsSync(dir)) {
            await fs.mkdir(dir, { recursive: true });
        }
    }
    
    async write(entry: any): Promise<void> {
        const formatted = JSON.stringify(entry) + '\n';
        this.writeBuffer.push(formatted);
        
        // Write immediately for error and fatal levels
        if (entry.level === 'error' || entry.level === 'fatal') {
            await this.flush();
        }
    }
    
    async flush(): Promise<void> {
        if (this.writeBuffer.length === 0) return;
        
        const content = this.writeBuffer.join('');
        await fs.appendFile(this.config.filename, content, 'utf8');
        this.writeBuffer = [];
        
        // Check file size and rotate if needed
        await this.rotateIfNeeded();
    }
    
    private async rotateIfNeeded(): Promise<void> {
        try {
            const stats = await fs.stat(this.config.filename);
            if (stats.size > this.config.maxSize) {
                await this.rotateFile();
            }
        } catch (error) {
            // File doesn't exist yet, no rotation needed
        }
    }
    
    private async rotateFile(): Promise<void> {
        const ext = path.extname(this.config.filename);
        const base = this.config.filename.slice(0, -ext.length);
        
        // Rotate existing files
        for (let i = this.config.maxFiles - 1; i > 0; i--) {
            const oldFile = `${base}.${i}${ext}`;
            const newFile = `${base}.${i + 1}${ext}`;
            
            if (existsSync(oldFile)) {
                await fs.rename(oldFile, newFile);
            }
        }
        
        // Move current file to .1
        await fs.rename(this.config.filename, `${base}.1${ext}`);
    }
    
    async close(): Promise<void> {
        await this.flush();
    }
}

class HttpTransport implements LogTransport {
    private config: any;
    private buffer: any[] = [];
    
    constructor(config: any) {
        this.config = config;
    }
    
    async write(entry: any): Promise<void> {
        this.buffer.push(entry);
        
        // Send immediately for critical entries
        if (entry.level === 'fatal' || entry.severity === 'critical') {
            await this.flush();
        }
    }
    
    async flush(): Promise<void> {
        if (this.buffer.length === 0) return;
        
        const payload = {
            logs: this.buffer,
            timestamp: new Date().toISOString(),
            source: 'hook-engine'
        };
        
        try {
            // In a real implementation, use fetch or axios
            console.log(`Would send ${this.buffer.length} logs to ${this.config.url}`);
            this.buffer = [];
        } catch (error) {
            console.error('Failed to send logs via HTTP:', error);
        }
    }
    
    async close(): Promise<void> {
        await this.flush();
    }
}

class DatabaseTransport implements LogTransport {
    private config: any;
    private buffer: any[] = [];
    
    constructor(config: any) {
        this.config = config;
    }
    
    async write(entry: any): Promise<void> {
        this.buffer.push(entry);
        
        if (this.buffer.length >= this.config.batchSize) {
            await this.flush();
        }
    }
    
    async flush(): Promise<void> {
        if (this.buffer.length === 0) return;
        
        try {
            // In a real implementation, insert into database
            console.log(`Would insert ${this.buffer.length} logs into database`);
            this.buffer = [];
        } catch (error) {
            console.error('Failed to insert logs into database:', error);
        }
    }
    
    async close(): Promise<void> {
        await this.flush();
    }
}

// Factory function for creating logger instances
export function createLogger(config?: Partial<LoggerConfig>, context?: LogContext): LoggerInterface {
    return new StructuredLogger(config, context);
}

// Default logger instance
export const logger = createLogger({
    level: process.env.LOG_LEVEL as LogLevel || 'info',
    format: 'json',
    outputs: [
        {
            type: 'console',
            config: {
                colorize: process.env.NODE_ENV !== 'production',
                timestamp: true,
                level: 'info'
            }
        },
        {
            type: 'file',
            config: {
                filename: './logs/hook-engine.log',
                maxSize: 10 * 1024 * 1024,
                maxFiles: 5,
                level: 'info'
            }
        }
    ]
});

// Export types for external use
export * from '../types/logging'; 