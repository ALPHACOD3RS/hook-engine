import { EventEmitter } from 'events';
import crypto from 'crypto';
import { 
    WebhookSecurityConfig, 
    RateLimitConfig, 
    RateLimitInfo, 
    RateLimitStore,
    ValidationConfig,
    ValidationResult,
    IPAllowlistConfig,
    SecurityAuditLog,
    SecurityEvent,
    SecurityMetrics
} from '../types/security';
import { WebhookValidationError, WebhookRateLimitError } from '../errors/webhook-errors';

/**
 * In-memory rate limit store implementation
 */
export class MemoryRateLimitStore implements RateLimitStore {
    private store = new Map<string, { info: RateLimitInfo; expiresAt: number }>();

    async get(key: string): Promise<RateLimitInfo | null> {
        const entry = this.store.get(key);
        if (!entry || Date.now() > entry.expiresAt) {
            this.store.delete(key);
            return null;
        }
        return entry.info;
    }

    async set(key: string, info: RateLimitInfo, ttlMs: number): Promise<void> {
        this.store.set(key, {
            info,
            expiresAt: Date.now() + ttlMs
        });
    }

    async increment(key: string, ttlMs: number): Promise<RateLimitInfo> {
        const existing = await this.get(key);
        const now = Date.now();
        
        if (!existing) {
            const info: RateLimitInfo = {
                totalHits: 1,
                totalHitsInWindow: 1,
                remainingPoints: 0, // Will be calculated by caller
                msBeforeNext: ttlMs,
                isFirstInWindow: true
            };
            await this.set(key, info, ttlMs);
            return info;
        }

        const updated: RateLimitInfo = {
            totalHits: existing.totalHits + 1,
            totalHitsInWindow: existing.totalHitsInWindow + 1,
            remainingPoints: existing.remainingPoints,
            msBeforeNext: existing.msBeforeNext,
            isFirstInWindow: false
        };

        await this.set(key, updated, ttlMs);
        return updated;
    }

    async reset(key: string): Promise<void> {
        this.store.delete(key);
    }

    // Cleanup expired entries
    cleanup(): void {
        const now = Date.now();
        for (const [key, entry] of this.store.entries()) {
            if (now > entry.expiresAt) {
                this.store.delete(key);
            }
        }
    }
}

/**
 * Comprehensive security manager for webhook processing
 */
export class SecurityManager extends EventEmitter {
    private config: WebhookSecurityConfig;
    private rateLimitStore: RateLimitStore;
    private auditLogs: SecurityAuditLog[] = [];
    private metrics: SecurityMetrics;
    private cleanupInterval?: NodeJS.Timeout;

    constructor(config: WebhookSecurityConfig) {
        super();
        this.config = config;
        this.rateLimitStore = config.rateLimiting.store || new MemoryRateLimitStore();
        this.metrics = {
            totalRequests: 0,
            blockedRequests: 0,
            rateLimitHits: 0,
            validationFailures: 0,
            ipBlockedRequests: 0,
            averageResponseTime: 0,
            securityEvents: [],
            lastUpdated: new Date()
        };

        // Start cleanup interval for memory store
        if (this.rateLimitStore instanceof MemoryRateLimitStore) {
            this.cleanupInterval = setInterval(() => {
                (this.rateLimitStore as MemoryRateLimitStore).cleanup();
            }, 60000); // Cleanup every minute
        }
    }

    /**
     * Validate incoming request against all security policies
     */
    async validateRequest(req: any): Promise<ValidationResult> {
        const startTime = Date.now();
        this.metrics.totalRequests++;

        try {
            // 1. Check IP allowlist
            const ipResult = await this.validateIP(req);
            if (!ipResult.isValid) {
                this.logSecurityEvent('ip_blocked', 'high', req, { errors: ipResult.errors });
                this.metrics.ipBlockedRequests++;
                this.metrics.blockedRequests++;
                return ipResult;
            }

            // 2. Check rate limits
            const rateLimitResult = await this.checkRateLimit(req);
            if (!rateLimitResult.isValid) {
                this.logSecurityEvent('rate_limit_exceeded', 'medium', req, { errors: rateLimitResult.errors });
                this.metrics.rateLimitHits++;
                this.metrics.blockedRequests++;
                return rateLimitResult;
            }

            // 3. Validate request structure and content
            const validationResult = await this.validateRequestContent(req);
            if (!validationResult.isValid) {
                this.logSecurityEvent('validation_failed', 'medium', req, { errors: validationResult.errors });
                this.metrics.validationFailures++;
                this.metrics.blockedRequests++;
                return validationResult;
            }

            // 4. Check request size
            const sizeResult = this.validateRequestSize(req);
            if (!sizeResult.isValid) {
                this.logSecurityEvent('request_too_large', 'medium', req, { errors: sizeResult.errors });
                this.metrics.blockedRequests++;
                return sizeResult;
            }

            // All validations passed
            this.updateResponseTimeMetrics(Date.now() - startTime);
            return { isValid: true, errors: [] };

        } catch (error) {
            this.logSecurityEvent('validation_failed', 'high', req, { 
                error: (error as Error).message 
            });
            this.metrics.blockedRequests++;
            return {
                isValid: false,
                errors: [`Security validation error: ${(error as Error).message}`]
            };
        } finally {
            this.metrics.lastUpdated = new Date();
        }
    }

    /**
     * Validate IP address against allowlist
     */
    private async validateIP(req: any): Promise<ValidationResult> {
        if (!this.config.ipAllowlist.enabled) {
            return { isValid: true, errors: [] };
        }

        const clientIP = this.extractClientIP(req);
        if (!clientIP) {
            return {
                isValid: false,
                errors: ['Unable to determine client IP address']
            };
        }

        // Check if IP is in allowlist
        const isAllowed = this.isIPAllowed(clientIP);
        if (!isAllowed && this.config.ipAllowlist.denyByDefault) {
            return {
                isValid: false,
                errors: [`IP address ${clientIP} is not in allowlist`]
            };
        }

        return { isValid: true, errors: [] };
    }

    /**
     * Check rate limits for the request
     */
    private async checkRateLimit(req: any): Promise<ValidationResult> {
        const key = this.generateRateLimitKey(req);
        const config = this.config.rateLimiting;

        try {
            const rateLimitInfo = await this.rateLimitStore.increment(key, config.windowMs);
            
            // Calculate remaining points
            rateLimitInfo.remainingPoints = Math.max(0, config.maxRequests - rateLimitInfo.totalHitsInWindow);
            
            if (rateLimitInfo.totalHitsInWindow > config.maxRequests) {
                // Rate limit exceeded
                if (config.onLimitReached) {
                    config.onLimitReached(req, rateLimitInfo);
                }

                return {
                    isValid: false,
                    errors: [
                        `Rate limit exceeded: ${rateLimitInfo.totalHitsInWindow}/${config.maxRequests} requests in ${config.windowMs}ms window`
                    ]
                };
            }

            // Add rate limit headers to response (if supported)
            if (req.res) {
                req.res.setHeader('X-RateLimit-Limit', config.maxRequests);
                req.res.setHeader('X-RateLimit-Remaining', rateLimitInfo.remainingPoints);
                req.res.setHeader('X-RateLimit-Reset', new Date(Date.now() + rateLimitInfo.msBeforeNext).toISOString());
            }

            return { isValid: true, errors: [] };

        } catch (error) {
            // If rate limiting fails, allow the request but log the error
            this.emit('rateLimitError', error);
            return { isValid: true, errors: [] };
        }
    }

    /**
     * Validate request content (headers, payload, etc.)
     */
    private async validateRequestContent(req: any): Promise<ValidationResult> {
        const config = this.config.requestValidation;
        const errors: string[] = [];

        // Check required headers
        for (const header of config.requiredHeaders) {
            if (!req.headers[header.toLowerCase()]) {
                errors.push(`Missing required header: ${header}`);
            }
        }

        // Check content type
        const contentType = req.headers['content-type'];
        if (contentType && config.allowedContentTypes.length > 0) {
            const isAllowed = config.allowedContentTypes.some((allowed: string) => 
                contentType.toLowerCase().includes(allowed.toLowerCase())
            );
            if (!isAllowed) {
                errors.push(`Content type ${contentType} is not allowed`);
            }
        }

        // Validate timestamp if enabled
        if (config.enableTimestampValidation) {
            const timestampResult = this.validateTimestamp(req);
            if (!timestampResult.isValid) {
                errors.push(...timestampResult.errors);
            }
        }

        // Run custom validators
        if (config.customValidators) {
            for (const validator of config.customValidators) {
                try {
                    const result = validator.validate(req);
                    if (!result.isValid) {
                        if (validator.required) {
                            errors.push(...result.errors);
                        }
                        // Log warnings even if not required
                        if (result.warnings) {
                            this.emit('validationWarning', {
                                validator: validator.name,
                                warnings: result.warnings
                            });
                        }
                    }
                } catch (error) {
                    if (validator.required) {
                        errors.push(validator.errorMessage || `Validation failed: ${validator.name}`);
                    }
                }
            }
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    /**
     * Validate request size
     */
    private validateRequestSize(req: any): ValidationResult {
        const contentLength = parseInt(req.headers['content-length'] || '0', 10);
        
        if (contentLength > this.config.requestSizeLimit) {
            return {
                isValid: false,
                errors: [`Request size ${contentLength} bytes exceeds limit of ${this.config.requestSizeLimit} bytes`]
            };
        }

        return { isValid: true, errors: [] };
    }

    /**
     * Validate timestamp in request
     */
    private validateTimestamp(req: any): ValidationResult {
        const timestamp = req.headers['x-timestamp'] || req.headers['timestamp'];
        if (!timestamp) {
            return {
                isValid: false,
                errors: ['Missing timestamp header']
            };
        }

        const requestTime = new Date(timestamp).getTime();
        const now = Date.now();
        const tolerance = this.config.requestValidation.timestampToleranceMs;

        if (Math.abs(now - requestTime) > tolerance) {
            return {
                isValid: false,
                errors: [`Timestamp ${timestamp} is outside tolerance window of ${tolerance}ms`]
            };
        }

        return { isValid: true, errors: [] };
    }

    /**
     * Extract client IP from request
     */
    private extractClientIP(req: any): string | null {
        // Check X-Forwarded-For header (from trusted proxies)
        const forwardedFor = req.headers['x-forwarded-for'];
        if (forwardedFor && this.config.ipAllowlist.trustedProxies.length > 0) {
            const ips = forwardedFor.split(',').map((ip: string) => ip.trim());
            return ips[0]; // First IP is the original client
        }

        // Check other common headers
        return req.headers['x-real-ip'] || 
               req.headers['x-client-ip'] || 
               req.connection?.remoteAddress || 
               req.socket?.remoteAddress ||
               req.ip ||
               null;
    }

    /**
     * Check if IP is allowed
     */
    private isIPAllowed(ip: string): boolean {
        // Check exact matches
        if (this.config.ipAllowlist.allowedIPs.includes(ip)) {
            return true;
        }

        // Check CIDR ranges
        for (const range of this.config.ipAllowlist.allowedRanges) {
            if (this.isIPInCIDR(ip, range)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Check if IP is in CIDR range
     */
    private isIPInCIDR(ip: string, cidr: string): boolean {
        // Simplified CIDR check - in production, use a proper IP library
        try {
            const [network, prefixLength] = cidr.split('/');
            const prefix = parseInt(prefixLength, 10);
            
            // Convert IPs to integers for comparison
            const ipInt = this.ipToInt(ip);
            const networkInt = this.ipToInt(network);
            const mask = (0xFFFFFFFF << (32 - prefix)) >>> 0;
            
            return (ipInt & mask) === (networkInt & mask);
        } catch {
            return false;
        }
    }

    /**
     * Convert IP address to integer
     */
    private ipToInt(ip: string): number {
        return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
    }

    /**
     * Generate rate limit key for request
     */
    private generateRateLimitKey(req: any): string {
        if (this.config.rateLimiting.keyGenerator) {
            return this.config.rateLimiting.keyGenerator(req);
        }

        // Default: use IP address
        const ip = this.extractClientIP(req) || 'unknown';
        return `rate_limit:${ip}`;
    }

    /**
     * Log security event
     */
    private logSecurityEvent(
        event: SecurityEvent, 
        severity: 'low' | 'medium' | 'high' | 'critical',
        req: any,
        details: Record<string, any>
    ): void {
        const auditLog: SecurityAuditLog = {
            timestamp: new Date(),
            event,
            severity,
            source: req.headers['user-agent'] || 'unknown',
            details,
            userAgent: req.headers['user-agent'],
            ip: this.extractClientIP(req) || undefined,
            blocked: true
        };

        this.auditLogs.push(auditLog);
        this.metrics.securityEvents.push(auditLog);

        // Emit event for external logging
        this.emit('securityEvent', auditLog);

        // Keep only last 1000 audit logs in memory
        if (this.auditLogs.length > 1000) {
            this.auditLogs = this.auditLogs.slice(-1000);
        }
    }

    /**
     * Update response time metrics
     */
    private updateResponseTimeMetrics(responseTime: number): void {
        const total = this.metrics.totalRequests;
        this.metrics.averageResponseTime = 
            ((this.metrics.averageResponseTime * (total - 1)) + responseTime) / total;
    }

    /**
     * Get security metrics
     */
    getMetrics(): SecurityMetrics {
        return { ...this.metrics };
    }

    /**
     * Get recent audit logs
     */
    getAuditLogs(limit: number = 100): SecurityAuditLog[] {
        return this.auditLogs.slice(-limit);
    }

    /**
     * Reset rate limit for a specific key
     */
    async resetRateLimit(key: string): Promise<void> {
        await this.rateLimitStore.reset(key);
    }

    /**
     * Get rate limit info for a key
     */
    async getRateLimitInfo(key: string): Promise<RateLimitInfo | null> {
        return await this.rateLimitStore.get(key);
    }

    /**
     * Cleanup resources
     */
    destroy(): void {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
        this.removeAllListeners();
    }
} 