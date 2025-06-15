import { LoggerConfig } from '../types/logging';

/**
 * Logging Configuration Templates
 * 
 * Pre-configured logging setups for different environments and use cases
 */

export const developmentLoggingConfig: LoggerConfig = {
    level: 'debug',
    format: 'structured',
    enableColors: true,
    enableTimestamps: true,
    enableStackTrace: true,
    maxFileSize: 5 * 1024 * 1024, // 5MB
    maxFiles: 3,
    rotateDaily: false,
    outputs: [
        {
            type: 'console',
            config: {
                colorize: true,
                timestamp: true,
                level: 'debug'
            }
        },
        {
            type: 'file',
            config: {
                filename: './logs/development.log',
                maxSize: 5 * 1024 * 1024,
                maxFiles: 3,
                compress: false,
                level: 'debug'
            }
        }
    ]
};

export const productionLoggingConfig: LoggerConfig = {
    level: 'info',
    format: 'json',
    enableColors: false,
    enableTimestamps: true,
    enableStackTrace: false,
    maxFileSize: 50 * 1024 * 1024, // 50MB
    maxFiles: 10,
    rotateDaily: true,
    outputs: [
        {
            type: 'console',
            config: {
                colorize: false,
                timestamp: true,
                level: 'warn'
            }
        },
        {
            type: 'file',
            config: {
                filename: './logs/production.log',
                maxSize: 50 * 1024 * 1024,
                maxFiles: 10,
                compress: true,
                level: 'info'
            }
        },
        {
            type: 'file',
            config: {
                filename: './logs/errors.log',
                maxSize: 20 * 1024 * 1024,
                maxFiles: 5,
                compress: true,
                level: 'error'
            }
        }
    ]
};

export const testingLoggingConfig: LoggerConfig = {
    level: 'warn',
    format: 'json',
    enableColors: false,
    enableTimestamps: true,
    enableStackTrace: true,
    maxFileSize: 1 * 1024 * 1024, // 1MB
    maxFiles: 2,
    rotateDaily: false,
    outputs: [
        {
            type: 'file',
            config: {
                filename: './logs/test.log',
                maxSize: 1 * 1024 * 1024,
                maxFiles: 2,
                compress: false,
                level: 'warn'
            }
        }
    ]
};

export const highVolumeLoggingConfig: LoggerConfig = {
    level: 'info',
    format: 'json',
    enableColors: false,
    enableTimestamps: true,
    enableStackTrace: false,
    maxFileSize: 100 * 1024 * 1024, // 100MB
    maxFiles: 20,
    rotateDaily: true,
    outputs: [
        {
            type: 'console',
            config: {
                colorize: false,
                timestamp: true,
                level: 'error'
            }
        },
        {
            type: 'file',
            config: {
                filename: './logs/webhooks.log',
                maxSize: 100 * 1024 * 1024,
                maxFiles: 20,
                compress: true,
                level: 'info'
            }
        },
        {
            type: 'file',
            config: {
                filename: './logs/security.log',
                maxSize: 50 * 1024 * 1024,
                maxFiles: 10,
                compress: true,
                level: 'warn'
            }
        },
        {
            type: 'file',
            config: {
                filename: './logs/performance.log',
                maxSize: 30 * 1024 * 1024,
                maxFiles: 5,
                compress: true,
                level: 'info'
            }
        }
    ]
};

export const debugLoggingConfig: LoggerConfig = {
    level: 'debug',
    format: 'structured',
    enableColors: true,
    enableTimestamps: true,
    enableStackTrace: true,
    maxFileSize: 10 * 1024 * 1024, // 10MB
    maxFiles: 5,
    rotateDaily: false,
    outputs: [
        {
            type: 'console',
            config: {
                colorize: true,
                timestamp: true,
                level: 'debug'
            }
        },
        {
            type: 'file',
            config: {
                filename: './logs/debug.log',
                maxSize: 10 * 1024 * 1024,
                maxFiles: 5,
                compress: false,
                level: 'debug'
            }
        }
    ]
};

export const cloudLoggingConfig: LoggerConfig = {
    level: 'info',
    format: 'json',
    enableColors: false,
    enableTimestamps: true,
    enableStackTrace: false,
    maxFileSize: 25 * 1024 * 1024, // 25MB
    maxFiles: 5,
    rotateDaily: true,
    outputs: [
        {
            type: 'console',
            config: {
                colorize: false,
                timestamp: true,
                level: 'info'
            }
        },
        {
            type: 'http',
            config: {
                url: process.env.LOG_ENDPOINT || 'https://logs.example.com/webhook',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${process.env.LOG_TOKEN || ''}`
                },
                timeout: 5000,
                retries: 3,
                level: 'info'
            }
        }
    ]
};

export const microserviceLoggingConfig: LoggerConfig = {
    level: 'info',
    format: 'json',
    enableColors: false,
    enableTimestamps: true,
    enableStackTrace: false,
    maxFileSize: 20 * 1024 * 1024, // 20MB
    maxFiles: 5,
    rotateDaily: true,
    outputs: [
        {
            type: 'console',
            config: {
                colorize: false,
                timestamp: true,
                level: 'info'
            }
        },
        {
            type: 'database',
            config: {
                connectionString: process.env.LOG_DATABASE_URL || 'postgresql://localhost/logs',
                tableName: 'webhook_logs',
                batchSize: 100,
                flushInterval: 5000,
                level: 'info'
            }
        }
    ]
};

/**
 * Get logging configuration by environment
 */
export function getLoggingConfigByEnvironment(env: string = process.env.NODE_ENV || 'development'): LoggerConfig {
    switch (env.toLowerCase()) {
        case 'development':
        case 'dev':
            return developmentLoggingConfig;
        case 'production':
        case 'prod':
            return productionLoggingConfig;
        case 'test':
        case 'testing':
            return testingLoggingConfig;
        case 'debug':
            return debugLoggingConfig;
        case 'cloud':
            return cloudLoggingConfig;
        case 'microservice':
            return microserviceLoggingConfig;
        case 'high-volume':
            return highVolumeLoggingConfig;
        default:
            return developmentLoggingConfig;
    }
}

/**
 * Merge logging configurations
 */
export function mergeLoggingConfigs(base: LoggerConfig, override: Partial<LoggerConfig>): LoggerConfig {
    return {
        ...base,
        ...override,
        outputs: override.outputs || base.outputs
    };
}

/**
 * Create custom logging configuration
 */
export function createCustomLoggingConfig(options: {
    level?: string;
    enableConsole?: boolean;
    enableFile?: boolean;
    enableHttp?: boolean;
    enableDatabase?: boolean;
    logDirectory?: string;
    httpEndpoint?: string;
    databaseUrl?: string;
}): LoggerConfig {
    const outputs: any[] = [];
    
    if (options.enableConsole !== false) {
        outputs.push({
            type: 'console',
            config: {
                colorize: process.env.NODE_ENV !== 'production',
                timestamp: true,
                level: options.level || 'info'
            }
        });
    }
    
    if (options.enableFile !== false) {
        const logDir = options.logDirectory || './logs';
        outputs.push({
            type: 'file',
            config: {
                filename: `${logDir}/hook-engine.log`,
                maxSize: 25 * 1024 * 1024,
                maxFiles: 5,
                compress: true,
                level: options.level || 'info'
            }
        });
    }
    
    if (options.enableHttp && options.httpEndpoint) {
        outputs.push({
            type: 'http',
            config: {
                url: options.httpEndpoint,
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                timeout: 5000,
                retries: 3,
                level: options.level || 'info'
            }
        });
    }
    
    if (options.enableDatabase && options.databaseUrl) {
        outputs.push({
            type: 'database',
            config: {
                connectionString: options.databaseUrl,
                tableName: 'webhook_logs',
                batchSize: 100,
                flushInterval: 5000,
                level: options.level || 'info'
            }
        });
    }
    
    return {
        level: (options.level as any) || 'info',
        format: 'json',
        enableColors: process.env.NODE_ENV !== 'production',
        enableTimestamps: true,
        enableStackTrace: process.env.NODE_ENV !== 'production',
        maxFileSize: 25 * 1024 * 1024,
        maxFiles: 5,
        rotateDaily: true,
        outputs
    };
} 