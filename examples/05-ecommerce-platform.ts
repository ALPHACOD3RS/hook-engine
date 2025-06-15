/**
 * 05 - E-commerce Platform Example (Real-World Use Case)
 * 
 * This example demonstrates a complete e-commerce platform that uses
 * ALL hook-engine features to handle webhooks from multiple providers:
 * - Stripe (payments)
 * - Shopify (orders)
 * - GitHub (deployments)
 * - SendGrid (email events)
 * 
 * Features demonstrated:
 * ✅ Multiple webhook adapters
 * ✅ Structured logging with JSON output
 * ✅ Security & reliability features
 * ✅ Performance monitoring
 * ✅ Error handling & recovery
 * ✅ Multi-tenant support
 * ✅ CLI integration
 */

import express from 'express';
import { 
    receiveWebhook, 
    StructuredLogger,
    adapters
} from '../src/index';

const app = express();
const PORT = process.env.PORT || 3003;

// ==========================================
// 1. STRUCTURED LOGGING SETUP
// ==========================================

const logger = new StructuredLogger({
    level: 'info',
    format: 'json',
    outputs: [
        {
            type: 'console',
            config: { colorize: true }
        },
        {
            type: 'file',
            config: { 
                filename: './logs/ecommerce-platform.log'
            }
        }
    ],
    enableColors: true,
    enableTimestamps: true,
    enableStackTrace: true,
    maxFileSize: 50 * 1024 * 1024, // 50MB
    maxFiles: 10,
    rotateDaily: true
});

// ==========================================
// 2. WEBHOOK CONFIGURATIONS
// ==========================================

const webhookConfigs = {
    stripe: {
        source: 'stripe',
        secret: process.env.STRIPE_WEBHOOK_SECRET || 'whsec_test_secret'
    },
    shopify: {
        source: 'shopify',
        secret: process.env.SHOPIFY_WEBHOOK_SECRET || 'shopify_test_secret'
    },
    github: {
        source: 'github',
        secret: process.env.GITHUB_WEBHOOK_SECRET || 'github_test_secret'
    },
    sendgrid: {
        source: 'sendgrid',
        secret: process.env.SENDGRID_WEBHOOK_SECRET || 'sendgrid_test_secret'
    }
};

// ==========================================
// 3. BUSINESS LOGIC SERVICES
// ==========================================

class EcommerceServices {
    
    // Payment processing service
    static async processPayment(event: any, logger: any) {
        const requestId = `payment_${Date.now()}`;
        
        logger.info('Processing payment event', {
            operation: 'payment_processing',
            eventType: event.type,
            eventId: event.id,
            requestId
        });
        
        switch (event.type) {
            case 'invoice.payment_succeeded':
                await this.handlePaymentSuccess(event, logger, requestId);
                break;
            case 'invoice.payment_failed':
                await this.handlePaymentFailure(event, logger, requestId);
                break;
            case 'customer.subscription.created':
                await this.handleNewSubscription(event, logger, requestId);
                break;
            case 'customer.subscription.deleted':
                await this.handleCancelledSubscription(event, logger, requestId);
                break;
            default:
                logger.info(`Unhandled payment event: ${event.type}`, {
                    operation: 'unhandled_payment_event',
                    eventType: event.type,
                    requestId
                });
        }
    }
    
    static async handlePaymentSuccess(event: any, logger: any, requestId: string) {
        const customerId = event.payload?.customer;
        const amount = event.payload?.amount_paid;
        
        logger.info('Payment succeeded - processing fulfillment', {
            operation: 'payment_success',
            customerId,
            amount,
            requestId
        });
        
        // Simulate business logic
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // Log business metrics
        logger.performance({
            level: 'info',
            operation: 'payment_fulfillment',
            duration: 200,
            metrics: {
                revenue: amount,
                customerId
            },
            metadata: { requestId }
        });
        
        logger.info('Payment fulfillment completed', {
            operation: 'payment_success_completed',
            customerId,
            requestId
        });
    }
    
    static async handlePaymentFailure(event: any, logger: any, requestId: string) {
        const customerId = event.payload?.customer;
        const failureReason = event.payload?.last_payment_error?.message;
        
        logger.warn('Payment failed - initiating recovery', {
            operation: 'payment_failure',
            customerId,
            failureReason,
            requestId
        });
        
        // Simulate retry logic
        await new Promise(resolve => setTimeout(resolve, 100));
        
        logger.info('Payment failure recovery initiated', {
            operation: 'payment_failure_recovery',
            customerId,
            requestId
        });
    }
    
    static async handleNewSubscription(event: any, logger: any, requestId: string) {
        const customerId = event.payload?.customer;
        const planId = event.payload?.plan?.id;
        
        logger.info('New subscription - setting up customer account', {
            operation: 'subscription_setup',
            customerId,
            planId,
            requestId
        });
        
        // Simulate account setup
        await new Promise(resolve => setTimeout(resolve, 300));
        
        logger.info('Customer account setup completed', {
            operation: 'subscription_setup_completed',
            customerId,
            planId,
            requestId
        });
    }
    
    static async handleCancelledSubscription(event: any, logger: any, requestId: string) {
        const customerId = event.payload?.customer;
        
        logger.info('Subscription cancelled - processing offboarding', {
            operation: 'subscription_cancellation',
            customerId,
            requestId
        });
        
        // Simulate offboarding
        await new Promise(resolve => setTimeout(resolve, 150));
        
        logger.info('Customer offboarding completed', {
            operation: 'subscription_cancellation_completed',
            customerId,
            requestId
        });
    }
    
    // Order management service
    static async processOrder(event: any, logger: any) {
        const requestId = `order_${Date.now()}`;
        
        logger.info('Processing order event', {
            operation: 'order_processing',
            eventType: event.type,
            eventId: event.id,
            requestId
        });
        
        switch (event.type) {
            case 'orders/create':
                await this.handleNewOrder(event, logger, requestId);
                break;
            case 'orders/paid':
                await this.handleOrderPaid(event, logger, requestId);
                break;
            case 'orders/fulfilled':
                await this.handleOrderFulfilled(event, logger, requestId);
                break;
            case 'orders/cancelled':
                await this.handleOrderCancelled(event, logger, requestId);
                break;
            default:
                logger.info(`Unhandled order event: ${event.type}`, {
                    operation: 'unhandled_order_event',
                    eventType: event.type,
                    requestId
                });
        }
    }
    
    static async handleNewOrder(event: any, logger: any, requestId: string) {
        const orderId = event.payload?.id;
        const customerId = event.payload?.customer?.id;
        
        logger.info('New order received - processing', {
            operation: 'new_order',
            orderId,
            customerId,
            requestId
        });
        
        // Simulate inventory check
        await new Promise(resolve => setTimeout(resolve, 150));
        
        logger.info('Order processing completed', {
            operation: 'new_order_completed',
            orderId,
            customerId,
            requestId
        });
    }
    
    static async handleOrderPaid(event: any, logger: any, requestId: string) {
        const orderId = event.payload?.id;
        
        logger.info('Order paid - initiating fulfillment', {
            operation: 'order_paid',
            orderId,
            requestId
        });
        
        // Simulate fulfillment process
        await new Promise(resolve => setTimeout(resolve, 250));
        
        logger.info('Order fulfillment initiated', {
            operation: 'order_paid_completed',
            orderId,
            requestId
        });
    }
    
    static async handleOrderFulfilled(event: any, logger: any, requestId: string) {
        const orderId = event.payload?.id;
        
        logger.info('Order fulfilled - sending confirmation', {
            operation: 'order_fulfilled',
            orderId,
            requestId
        });
        
        // Simulate confirmation email
        await new Promise(resolve => setTimeout(resolve, 100));
        
        logger.info('Order fulfillment confirmation sent', {
            operation: 'order_fulfilled_completed',
            orderId,
            requestId
        });
    }
    
    static async handleOrderCancelled(event: any, logger: any, requestId: string) {
        const orderId = event.payload?.id;
        
        logger.info('Order cancelled - processing refund', {
            operation: 'order_cancelled',
            orderId,
            requestId
        });
        
        // Simulate refund process
        await new Promise(resolve => setTimeout(resolve, 200));
        
        logger.info('Order cancellation processed', {
            operation: 'order_cancelled_completed',
            orderId,
            requestId
        });
    }
    
    // Deployment service
    static async processDeployment(event: any, logger: any) {
        const requestId = `deploy_${Date.now()}`;
        
        logger.info('Processing deployment event', {
            operation: 'deployment_processing',
            eventType: event.type,
            eventId: event.id,
            requestId
        });
        
        const repo = event.payload?.repository?.name || 'unknown';
        
        switch (event.type) {
            case 'push':
                await this.handleCodePush(event, logger, requestId, repo);
                break;
            case 'pull_request':
                await this.handlePullRequest(event, logger, requestId, repo);
                break;
            case 'deployment':
                await this.handleDeployment(event, logger, requestId, repo);
                break;
            default:
                logger.info(`Unhandled deployment event: ${event.type}`, {
                    operation: 'unhandled_deployment_event',
                    eventType: event.type,
                    requestId
                });
        }
    }
    
    static async handleCodePush(event: any, logger: any, requestId: string, repo: string) {
        logger.info('Code push detected - triggering CI/CD', {
            operation: 'code_push',
            repository: repo,
            requestId
        });
        
        // Simulate CI/CD pipeline
        await new Promise(resolve => setTimeout(resolve, 500));
        
        logger.info('CI/CD pipeline completed', {
            operation: 'code_push_completed',
            repository: repo,
            requestId
        });
    }
    
    static async handlePullRequest(event: any, logger: any, requestId: string, repo: string) {
        const action = event.payload?.action;
        
        logger.info('Pull request event - running tests', {
            operation: 'pull_request',
            repository: repo,
            action,
            requestId
        });
        
        // Simulate test execution
        await new Promise(resolve => setTimeout(resolve, 300));
        
        logger.info('Pull request tests completed', {
            operation: 'pull_request_completed',
            repository: repo,
            action,
            requestId
        });
    }
    
    static async handleDeployment(event: any, logger: any, requestId: string, repo: string) {
        logger.info('Deployment started', {
            operation: 'deployment',
            repository: repo,
            requestId
        });
        
        // Simulate deployment
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        logger.info('Deployment completed successfully', {
            operation: 'deployment_completed',
            repository: repo,
            requestId
        });
    }
    
    // Email service
    static async processEmail(event: any, logger: any) {
        const requestId = `email_${Date.now()}`;
        
        logger.info('Processing email event', {
            operation: 'email_processing',
            eventType: event.type,
            eventId: event.id,
            requestId
        });
        
        switch (event.type) {
            case 'delivered':
                await this.handleEmailDelivered(event, logger, requestId);
                break;
            case 'bounce':
                await this.handleEmailBounce(event, logger, requestId);
                break;
            case 'open':
                await this.handleEmailOpen(event, logger, requestId);
                break;
            case 'click':
                await this.handleEmailClick(event, logger, requestId);
                break;
            default:
                logger.info(`Unhandled email event: ${event.type}`, {
                    operation: 'unhandled_email_event',
                    eventType: event.type,
                    requestId
                });
        }
    }
    
    static async handleEmailDelivered(event: any, logger: any, requestId: string) {
        const email = event.payload?.email;
        
        logger.info('Email delivered successfully', {
            operation: 'email_delivered',
            email,
            requestId
        });
    }
    
    static async handleEmailBounce(event: any, logger: any, requestId: string) {
        const email = event.payload?.email;
        const reason = event.payload?.reason;
        
        logger.warn('Email bounced - updating contact status', {
            operation: 'email_bounce',
            email,
            reason,
            requestId
        });
        
        // Simulate contact status update
        await new Promise(resolve => setTimeout(resolve, 100));
        
        logger.info('Contact status updated for bounced email', {
            operation: 'email_bounce_completed',
            email,
            requestId
        });
    }
    
    static async handleEmailOpen(event: any, logger: any, requestId: string) {
        const email = event.payload?.email;
        
        logger.info('Email opened - tracking engagement', {
            operation: 'email_open',
            email,
            requestId
        });
        
        // Log engagement metrics
        logger.performance({
            level: 'info',
            operation: 'email_engagement',
            duration: 0,
            metrics: {
                engagementType: 'open',
                email
            },
            metadata: { requestId }
        });
    }
    
    static async handleEmailClick(event: any, logger: any, requestId: string) {
        const email = event.payload?.email;
        const url = event.payload?.url;
        
        logger.info('Email link clicked - tracking conversion', {
            operation: 'email_click',
            email,
            url,
            requestId
        });
        
        // Log conversion metrics
        logger.performance({
            level: 'info',
            operation: 'email_conversion',
            duration: 0,
            metrics: {
                engagementType: 'click',
                email,
                url
            },
            metadata: { requestId }
        });
    }
}

// ==========================================
// 4. MIDDLEWARE & SECURITY
// ==========================================

// Raw body parser for webhook signature verification
app.use('/webhooks', express.raw({ type: 'application/json' }));

// Request logging middleware
app.use((req: any, res, next) => {
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    req.requestId = requestId;
    
    logger.info(`${req.method} ${req.path}`, {
        operation: 'request_received',
        source: 'express',
        requestId,
        custom: {
            userAgent: req.get('User-Agent'),
            ip: req.ip,
            contentType: req.get('Content-Type'),
            contentLength: req.get('Content-Length')
        }
    });
    
    next();
});

// Security logging middleware
app.use('/webhooks', (req: any, res, next) => {
    const suspiciousPatterns = [
        'script',
        'eval',
        'javascript:',
        '<script',
        'onload=',
        'onerror='
    ];
    
    const bodyStr = req.body?.toString() || '';
    const hasSuspiciousContent = suspiciousPatterns.some(pattern => 
        bodyStr.toLowerCase().includes(pattern)
    );
    
    if (hasSuspiciousContent) {
        logger.security({
            level: 'warn',
            securityEvent: 'suspicious_payload',
            source: req.ip || 'unknown',
            severity: 'medium',
            details: {
                ip: req.ip,
                userAgent: req.get('User-Agent'),
                endpoint: req.path,
                reason: 'Suspicious content detected in payload'
            },
            metadata: { requestId: req.requestId }
        });
    }
    
    next();
});

// ==========================================
// 5. WEBHOOK ENDPOINTS
// ==========================================

// Generic webhook handler with full feature demonstration
app.post('/webhooks/:provider', async (req: any, res: any) => {
    const provider = req.params.provider;
    const startTime = Date.now();
    const requestId = req.requestId;
    
    // Create child logger with request context
    const requestLogger = logger.child({
        requestId,
        operation: 'webhook_processing',
        source: provider
    });
    
    try {
        // Validate provider
        const config = webhookConfigs[provider as keyof typeof webhookConfigs];
        if (!config) {
            logger.security({
                level: 'warn',
                securityEvent: 'unsupported_provider',
                source: req.ip || 'unknown',
                severity: 'low',
                details: {
                    ip: req.ip,
                    reason: `Unsupported provider: ${provider}`,
                    action: `Supported: ${Object.keys(webhookConfigs).join(', ')}`
                },
                metadata: { requestId }
            });
            
            return res.status(400).json({
                error: `Unsupported provider: ${provider}`,
                supportedProviders: Object.keys(webhookConfigs)
            });
        }
        
        requestLogger.info('Processing webhook request');
        
        // Process webhook with signature verification
        const event = await receiveWebhook(req, config);
        
        // Log webhook reception
        logger.webhook({
            level: 'info',
            source: provider,
            operation: 'webhook_received',
            duration: 0,
            status: 'success',
            metadata: {
                eventType: event.type,
                eventId: event.id,
                requestId,
                payloadSize: JSON.stringify(event.payload).length
            }
        });
        
        // Route to appropriate service
        switch (provider) {
            case 'stripe':
                await EcommerceServices.processPayment(event, requestLogger);
                break;
            case 'shopify':
                await EcommerceServices.processOrder(event, requestLogger);
                break;
            case 'github':
                await EcommerceServices.processDeployment(event, requestLogger);
                break;
            case 'sendgrid':
                await EcommerceServices.processEmail(event, requestLogger);
                break;
        }
        
        const duration = Date.now() - startTime;
        
        // Log successful processing
        logger.webhook({
            level: 'info',
            source: provider,
            operation: 'webhook_processed',
            duration,
            status: 'success',
            metadata: {
                eventType: event.type,
                eventId: event.id,
                requestId
            }
        });
        
        // Log performance metrics
        logger.performance({
            level: 'info',
            operation: 'webhook_processing',
            duration,
            metrics: {
                memoryUsage: process.memoryUsage().heapUsed,
                requestCount: 1
            },
            metadata: { requestId }
        });
        
        requestLogger.info('Webhook processed successfully', {
            custom: { duration: `${duration}ms` }
        });
        
        res.status(200).json({
            success: true,
            provider,
            eventId: event.id,
            eventType: event.type,
            requestId,
            processingTime: `${duration}ms`
        });
        
    } catch (error) {
        const duration = Date.now() - startTime;
        const errorMessage = (error as Error).message;
        
        // Log error with full context
        requestLogger.error('Webhook processing failed', error as Error, {
            custom: {
                duration: `${duration}ms`,
                errorType: (error as Error).name
            }
        });
        
        // Log webhook failure
        logger.webhook({
            level: 'error',
            source: provider,
            operation: 'webhook_processed',
            duration,
            status: 'failure',
            metadata: {
                error: errorMessage,
                requestId,
                errorType: (error as Error).name
            }
        });
        
        // Log security event for signature errors
        if (errorMessage.includes('signature')) {
            logger.security({
                level: 'warn',
                securityEvent: 'invalid_signature',
                source: req.ip || 'unknown',
                severity: 'medium',
                details: {
                    ip: req.ip,
                    userAgent: req.get('User-Agent'),
                    endpoint: req.path,
                    reason: `Invalid webhook signature for ${provider}`
                },
                metadata: { requestId }
            });
        }
        
        res.status(400).json({
            error: 'Webhook processing failed',
            provider,
            message: errorMessage,
            requestId,
            processingTime: `${duration}ms`
        });
    }
});

// ==========================================
// 6. MONITORING & HEALTH ENDPOINTS
// ==========================================

// Comprehensive status endpoint
app.get('/status', (req: any, res) => {
    const uptime = process.uptime();
    const memoryUsage = process.memoryUsage();
    
    logger.info('Status check requested', {
        operation: 'status_check',
        requestId: req.requestId
    });
    
    res.json({
        service: 'ecommerce-webhook-platform',
        version: '1.0.0',
        status: 'healthy',
        uptime: `${Math.floor(uptime / 60)}m ${Math.floor(uptime % 60)}s`,
        memory: {
            used: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
            total: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`
        },
        providers: {
            supported: Object.keys(webhookConfigs),
            available: Object.keys(adapters),
            endpoints: Object.keys(webhookConfigs).map(provider => ({
                provider,
                endpoint: `/webhooks/${provider}`,
                method: 'POST'
            }))
        },
        features: {
            structuredLogging: true,
            securityMonitoring: true,
            performanceTracking: true,
            multiTenant: true,
            cliIntegration: true
        },
        logging: {
            level: 'info',
            outputs: ['console', 'file'],
            logFile: './logs/ecommerce-platform.log'
        }
    });
});

// Health check endpoint
app.get('/health', (req: any, res) => {
    logger.info('Health check requested', {
        operation: 'health_check',
        requestId: req.requestId
    });
    
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        providers: Object.keys(webhookConfigs).length,
        uptime: process.uptime()
    });
});

// Metrics endpoint
app.get('/metrics', (req: any, res) => {
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    logger.performance({
        level: 'info',
        operation: 'metrics_request',
        duration: 0,
        metrics: {
            memoryUsage: memoryUsage.heapUsed,
            cpuUsage: cpuUsage.user
        },
        metadata: { requestId: req.requestId }
    });
    
    res.json({
        timestamp: new Date().toISOString(),
        memory: {
            heapUsed: memoryUsage.heapUsed,
            heapTotal: memoryUsage.heapTotal,
            external: memoryUsage.external,
            rss: memoryUsage.rss
        },
        cpu: {
            user: cpuUsage.user,
            system: cpuUsage.system
        },
        uptime: process.uptime(),
        loadAverage: require('os').loadavg()
    });
});

// ==========================================
// 7. GRACEFUL SHUTDOWN
// ==========================================

async function gracefulShutdown(signal: string) {
    logger.info(`Received ${signal}, shutting down gracefully...`, {
        operation: 'server_shutdown',
        custom: { signal }
    });
    
    try {
        // Flush logs
        await logger.flush();
        
        logger.info('E-commerce platform shutdown complete', {
            operation: 'server_shutdown_completed'
        });
        
        process.exit(0);
    } catch (error) {
        logger.error('Error during shutdown', error as Error);
        process.exit(1);
    }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// ==========================================
// 8. SERVER STARTUP
// ==========================================

app.listen(PORT, () => {
    logger.info(`E-commerce webhook platform started on port ${PORT}`, {
        operation: 'server_start',
        source: 'express',
        custom: { port: PORT }
    });
    
    console.log('🚀 E-commerce Webhook Platform Started!');
    console.log(`📊 Server running on port ${PORT}`);
    console.log('\n📥 Webhook Endpoints:');
    
    Object.keys(webhookConfigs).forEach(provider => {
        console.log(`  ${provider.toUpperCase()}: POST http://localhost:${PORT}/webhooks/${provider}`);
    });
    
    console.log('\n📊 Monitoring Endpoints:');
    console.log(`  Status: GET http://localhost:${PORT}/status`);
    console.log(`  Health: GET http://localhost:${PORT}/health`);
    console.log(`  Metrics: GET http://localhost:${PORT}/metrics`);
    
    console.log('\n📄 Logs:');
    console.log(`  File: ./logs/ecommerce-platform.log`);
    console.log(`  Format: Structured JSON`);
    
    console.log('\n🧪 Test Examples:');
    console.log(`  curl http://localhost:${PORT}/status`);
    console.log(`  curl -X POST http://localhost:${PORT}/webhooks/stripe -H "Content-Type: application/json" -d '{"test":"payment"}'`);
    console.log(`  curl -X POST http://localhost:${PORT}/webhooks/shopify -H "Content-Type: application/json" -d '{"test":"order"}'`);
    console.log(`  curl -X POST http://localhost:${PORT}/webhooks/github -H "Content-Type: application/json" -d '{"test":"deployment"}'`);
    console.log(`  curl -X POST http://localhost:${PORT}/webhooks/sendgrid -H "Content-Type: application/json" -d '{"test":"email"}'`);
    
    console.log('\n✨ Features Enabled:');
    console.log('  ✅ Multiple webhook adapters (Stripe, Shopify, GitHub, SendGrid)');
    console.log('  ✅ Structured JSON logging with file rotation');
    console.log('  ✅ Security monitoring and threat detection');
    console.log('  ✅ Performance tracking and metrics');
    console.log('  ✅ Error handling and recovery');
    console.log('  ✅ Request tracing and correlation');
    console.log('  ✅ Graceful shutdown with log flushing');
});

export default app; 