export interface RateLimitConfig {
    windowMs: number; // Time window in milliseconds
    maxRequests: number; // Maximum requests per window
    skipSuccessfulRequests?: boolean; // Don't count successful requests
    skipFailedRequests?: boolean; // Don't count failed requests
    keyGenerator?: (req: any) => string; // Custom key generation
    onLimitReached?: (req: any, rateLimitInfo: RateLimitInfo) => void;
    store?: RateLimitStore; // Custom storage for rate limit data
}

export interface RateLimitInfo {
    totalHits: number;
    totalHitsInWindow: number;
    remainingPoints: number;
    msBeforeNext: number;
    isFirstInWindow: boolean;
}

export interface RateLimitStore {
    get(key: string): Promise<RateLimitInfo | null>;
    set(key: string, info: RateLimitInfo, ttlMs: number): Promise<void>;
    increment(key: string, ttlMs: number): Promise<RateLimitInfo>;
    reset(key: string): Promise<void>;
}

export interface ValidationConfig {
    enableSignatureValidation: boolean;
    enablePayloadValidation: boolean;
    enableHeaderValidation: boolean;
    enableTimestampValidation: boolean;
    timestampToleranceMs: number; // How old timestamps are acceptable
    maxPayloadSize: number; // Maximum payload size in bytes
    requiredHeaders: string[]; // Headers that must be present
    allowedContentTypes: string[]; // Allowed content types
    customValidators?: ValidationRule[];
}

export interface ValidationRule {
    name: string;
    validate: (req: any) => ValidationResult;
    required: boolean;
    errorMessage?: string;
}

export interface ValidationResult {
    isValid: boolean;
    errors: string[];
    warnings?: string[];
}

export interface IPAllowlistConfig {
    enabled: boolean;
    allowedIPs: string[]; // IP addresses or CIDR blocks
    allowedRanges: string[]; // IP ranges in CIDR notation
    denyByDefault: boolean; // Deny all IPs not explicitly allowed
    trustedProxies: string[]; // Trusted proxy IPs for X-Forwarded-For
    enableGeoBlocking?: boolean;
    blockedCountries?: string[]; // ISO country codes to block
}

export interface WebhookSecurityConfig {
    rateLimiting: RateLimitConfig;
    requestValidation: ValidationConfig;
    ipAllowlist: IPAllowlistConfig;
    requestSizeLimit: number; // Maximum request size in bytes
    timeoutMs: number; // Request timeout in milliseconds
    enableCORS: boolean;
    corsOptions?: CORSConfig;
    enableCSRF?: boolean;
    csrfOptions?: CSRFConfig;
    enableEncryption?: boolean;
    encryptionOptions?: EncryptionConfig;
}

export interface CORSConfig {
    origin: string | string[] | boolean;
    methods: string[];
    allowedHeaders: string[];
    exposedHeaders?: string[];
    credentials: boolean;
    maxAge?: number;
}

export interface CSRFConfig {
    enabled: boolean;
    secret: string;
    cookieName: string;
    headerName: string;
    ignoreMethods: string[];
}

export interface EncryptionConfig {
    algorithm: string;
    keyDerivation: 'pbkdf2' | 'scrypt' | 'argon2';
    keyLength: number;
    ivLength: number;
    saltLength: number;
    iterations?: number; // For PBKDF2
    cost?: number; // For scrypt
    blockSize?: number; // For scrypt
    parallelization?: number; // For scrypt
}

export interface SecurityAuditLog {
    timestamp: Date;
    event: SecurityEvent;
    severity: 'low' | 'medium' | 'high' | 'critical';
    source: string;
    details: Record<string, any>;
    userAgent?: string;
    ip?: string;
    blocked: boolean;
}

export type SecurityEvent = 
    | 'rate_limit_exceeded'
    | 'invalid_signature'
    | 'invalid_payload'
    | 'ip_blocked'
    | 'request_too_large'
    | 'timeout_exceeded'
    | 'validation_failed'
    | 'suspicious_activity'
    | 'brute_force_attempt'
    | 'malformed_request';

export interface SecurityMetrics {
    totalRequests: number;
    blockedRequests: number;
    rateLimitHits: number;
    validationFailures: number;
    ipBlockedRequests: number;
    averageResponseTime: number;
    securityEvents: SecurityAuditLog[];
    lastUpdated: Date;
} 