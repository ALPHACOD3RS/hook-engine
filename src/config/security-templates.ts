import {
    WebhookSecurityConfig,
    RateLimitConfig,
    ValidationConfig,
    IPAllowlistConfig,
    CORSConfig,
    CSRFConfig,
    EncryptionConfig
} from '../types/security';

/**
 * Basic security configuration for development environments
 */
export const developmentSecurityConfig: WebhookSecurityConfig = {
    rateLimiting: {
        windowMs: 60000, // 1 minute
        maxRequests: 1000, // High limit for development
        skipSuccessfulRequests: false,
        skipFailedRequests: false
    },
    requestValidation: {
        enableSignatureValidation: false, // Disabled for easier testing
        enablePayloadValidation: true,
        enableHeaderValidation: true,
        enableTimestampValidation: false,
        timestampToleranceMs: 300000, // 5 minutes
        maxPayloadSize: 10 * 1024 * 1024, // 10MB
        requiredHeaders: ['content-type'],
        allowedContentTypes: ['application/json', 'application/x-www-form-urlencoded', 'text/plain']
    },
    ipAllowlist: {
        enabled: false, // Disabled for development
        allowedIPs: [],
        allowedRanges: [],
        denyByDefault: false,
        trustedProxies: ['127.0.0.1', '::1']
    },
    requestSizeLimit: 10 * 1024 * 1024, // 10MB
    timeoutMs: 30000, // 30 seconds
    enableCORS: true,
    corsOptions: {
        origin: true, // Allow all origins in development
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
        credentials: true,
        maxAge: 86400
    }
};

/**
 * Production security configuration with strict policies
 */
export const productionSecurityConfig: WebhookSecurityConfig = {
    rateLimiting: {
        windowMs: 60000, // 1 minute
        maxRequests: 100, // Strict limit for production
        skipSuccessfulRequests: false,
        skipFailedRequests: false,
        keyGenerator: (req: any) => {
            // Use IP + User-Agent for more specific rate limiting
            const ip = req.ip || req.connection?.remoteAddress || 'unknown';
            const userAgent = req.headers['user-agent'] || 'unknown';
            return `${ip}:${userAgent}`;
        }
    },
    requestValidation: {
        enableSignatureValidation: true,
        enablePayloadValidation: true,
        enableHeaderValidation: true,
        enableTimestampValidation: true,
        timestampToleranceMs: 60000, // 1 minute tolerance
        maxPayloadSize: 1024 * 1024, // 1MB
        requiredHeaders: ['content-type', 'x-signature', 'x-timestamp'],
        allowedContentTypes: ['application/json']
    },
    ipAllowlist: {
        enabled: true,
        allowedIPs: [], // Configure based on your webhook sources
        allowedRanges: [], // Configure CIDR ranges
        denyByDefault: true,
        trustedProxies: [], // Configure your load balancer IPs
        enableGeoBlocking: true,
        blockedCountries: ['CN', 'RU'] // Example blocked countries
    },
    requestSizeLimit: 1024 * 1024, // 1MB
    timeoutMs: 10000, // 10 seconds
    enableCORS: false, // Disabled for webhooks
    enableCSRF: true,
    csrfOptions: {
        enabled: true,
        secret: process.env.CSRF_SECRET || 'your-csrf-secret',
        cookieName: '_csrf',
        headerName: 'x-csrf-token',
        ignoreMethods: ['GET', 'HEAD', 'OPTIONS']
    },
    enableEncryption: true,
    encryptionOptions: {
        algorithm: 'aes-256-gcm',
        keyDerivation: 'pbkdf2',
        keyLength: 32,
        ivLength: 16,
        saltLength: 32,
        iterations: 100000
    }
};

/**
 * High-security configuration for sensitive environments
 */
export const highSecurityConfig: WebhookSecurityConfig = {
    rateLimiting: {
        windowMs: 60000, // 1 minute
        maxRequests: 50, // Very strict limit
        skipSuccessfulRequests: false,
        skipFailedRequests: false,
        keyGenerator: (req: any) => {
            // Multi-factor rate limiting key
            const ip = req.ip || 'unknown';
            const userAgent = req.headers['user-agent'] || 'unknown';
            const source = req.headers['x-webhook-source'] || 'unknown';
            return `${ip}:${userAgent}:${source}`;
        }
    },
    requestValidation: {
        enableSignatureValidation: true,
        enablePayloadValidation: true,
        enableHeaderValidation: true,
        enableTimestampValidation: true,
        timestampToleranceMs: 30000, // 30 seconds tolerance
        maxPayloadSize: 512 * 1024, // 512KB
        requiredHeaders: [
            'content-type',
            'x-signature',
            'x-timestamp',
            'x-webhook-source',
            'authorization'
        ],
        allowedContentTypes: ['application/json'],
        customValidators: [
            {
                name: 'signature-strength',
                validate: (req: any) => {
                    const signature = req.headers['x-signature'];
                    if (!signature || signature.length < 64) {
                        return { isValid: false, errors: ['Signature too weak'] };
                    }
                    return { isValid: true, errors: [] };
                },
                required: true,
                errorMessage: 'Strong signature required'
            },
            {
                name: 'source-validation',
                validate: (req: any) => {
                    const source = req.headers['x-webhook-source'];
                    const allowedSources = ['github', 'stripe', 'shopify'];
                    if (!source || !allowedSources.includes(source)) {
                        return { isValid: false, errors: ['Invalid webhook source'] };
                    }
                    return { isValid: true, errors: [] };
                },
                required: true,
                errorMessage: 'Valid webhook source required'
            }
        ]
    },
    ipAllowlist: {
        enabled: true,
        allowedIPs: [], // Strict allowlist only
        allowedRanges: [], // Specific CIDR ranges only
        denyByDefault: true,
        trustedProxies: [], // Only specific proxy IPs
        enableGeoBlocking: true,
        blockedCountries: ['CN', 'RU', 'KP', 'IR'] // Extended blocked list
    },
    requestSizeLimit: 512 * 1024, // 512KB
    timeoutMs: 5000, // 5 seconds
    enableCORS: false,
    enableCSRF: true,
    csrfOptions: {
        enabled: true,
        secret: process.env.CSRF_SECRET || 'your-strong-csrf-secret',
        cookieName: '_csrf_token',
        headerName: 'x-csrf-token',
        ignoreMethods: []
    },
    enableEncryption: true,
    encryptionOptions: {
        algorithm: 'aes-256-gcm',
        keyDerivation: 'argon2',
        keyLength: 32,
        ivLength: 16,
        saltLength: 32,
        cost: 16,
        blockSize: 8,
        parallelization: 1
    }
};

/**
 * API Gateway security configuration
 */
export const apiGatewaySecurityConfig: WebhookSecurityConfig = {
    rateLimiting: {
        windowMs: 60000, // 1 minute
        maxRequests: 200,
        skipSuccessfulRequests: true, // Don't count successful requests
        skipFailedRequests: false,
        keyGenerator: (req: any) => {
            // Use API key for rate limiting
            const apiKey = req.headers['x-api-key'] || req.headers['authorization'];
            const ip = req.ip || 'unknown';
            return apiKey ? `api:${apiKey}` : `ip:${ip}`;
        }
    },
    requestValidation: {
        enableSignatureValidation: true,
        enablePayloadValidation: true,
        enableHeaderValidation: true,
        enableTimestampValidation: true,
        timestampToleranceMs: 120000, // 2 minutes
        maxPayloadSize: 2 * 1024 * 1024, // 2MB
        requiredHeaders: ['content-type', 'x-api-key'],
        allowedContentTypes: ['application/json', 'application/xml']
    },
    ipAllowlist: {
        enabled: false, // Rely on API key authentication
        allowedIPs: [],
        allowedRanges: [],
        denyByDefault: false,
        trustedProxies: ['10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16']
    },
    requestSizeLimit: 2 * 1024 * 1024, // 2MB
    timeoutMs: 15000, // 15 seconds
    enableCORS: true,
    corsOptions: {
        origin: ['https://api.example.com', 'https://dashboard.example.com'],
        methods: ['POST', 'PUT'],
        allowedHeaders: ['Content-Type', 'X-API-Key', 'Authorization'],
        credentials: false,
        maxAge: 3600
    }
};

/**
 * Microservices security configuration
 */
export const microservicesSecurityConfig: WebhookSecurityConfig = {
    rateLimiting: {
        windowMs: 60000, // 1 minute
        maxRequests: 500, // Higher limit for internal services
        skipSuccessfulRequests: true,
        skipFailedRequests: false,
        keyGenerator: (req: any) => {
            // Use service name for rate limiting
            const serviceName = req.headers['x-service-name'] || 'unknown';
            const ip = req.ip || 'unknown';
            return `service:${serviceName}:${ip}`;
        }
    },
    requestValidation: {
        enableSignatureValidation: true,
        enablePayloadValidation: true,
        enableHeaderValidation: true,
        enableTimestampValidation: false, // Relaxed for internal services
        timestampToleranceMs: 300000, // 5 minutes
        maxPayloadSize: 5 * 1024 * 1024, // 5MB
        requiredHeaders: ['content-type', 'x-service-name', 'x-service-token'],
        allowedContentTypes: ['application/json', 'application/protobuf']
    },
    ipAllowlist: {
        enabled: true,
        allowedIPs: [],
        allowedRanges: [
            '10.0.0.0/8',      // Private network
            '172.16.0.0/12',   // Private network
            '192.168.0.0/16'   // Private network
        ],
        denyByDefault: true,
        trustedProxies: ['10.0.0.0/8']
    },
    requestSizeLimit: 5 * 1024 * 1024, // 5MB
    timeoutMs: 20000, // 20 seconds
    enableCORS: false, // Not needed for internal services
    enableEncryption: true,
    encryptionOptions: {
        algorithm: 'aes-256-gcm',
        keyDerivation: 'pbkdf2',
        keyLength: 32,
        ivLength: 16,
        saltLength: 32,
        iterations: 50000
    }
};

/**
 * Get security configuration by environment
 */
export function getSecurityConfigByEnvironment(env: string): WebhookSecurityConfig {
    switch (env.toLowerCase()) {
        case 'development':
        case 'dev':
            return developmentSecurityConfig;
        case 'production':
        case 'prod':
            return productionSecurityConfig;
        case 'staging':
        case 'stage':
            return { ...productionSecurityConfig, rateLimiting: { ...productionSecurityConfig.rateLimiting, maxRequests: 200 } };
        case 'high-security':
        case 'secure':
            return highSecurityConfig;
        case 'api-gateway':
        case 'gateway':
            return apiGatewaySecurityConfig;
        case 'microservices':
        case 'internal':
            return microservicesSecurityConfig;
        default:
            return developmentSecurityConfig;
    }
}

/**
 * Merge security configurations
 */
export function mergeSecurityConfigs(base: WebhookSecurityConfig, override: Partial<WebhookSecurityConfig>): WebhookSecurityConfig {
    return {
        ...base,
        ...override,
        rateLimiting: { ...base.rateLimiting, ...override.rateLimiting },
        requestValidation: { ...base.requestValidation, ...override.requestValidation },
        ipAllowlist: { ...base.ipAllowlist, ...override.ipAllowlist },
        corsOptions: base.corsOptions && override.corsOptions ? 
            { ...base.corsOptions, ...override.corsOptions } : 
            override.corsOptions || base.corsOptions,
        csrfOptions: base.csrfOptions && override.csrfOptions ? 
            { ...base.csrfOptions, ...override.csrfOptions } : 
            override.csrfOptions || base.csrfOptions,
        encryptionOptions: base.encryptionOptions && override.encryptionOptions ? 
            { ...base.encryptionOptions, ...override.encryptionOptions } : 
            override.encryptionOptions || base.encryptionOptions
    };
}