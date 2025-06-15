/**
 * 03 - Structured Logging Example
 * 
 * This example demonstrates the structured logging capabilities
 * with JSON output, multiple transports, and rich metadata.
 */

import express from 'express';
import { receiveWebhook, StructuredLogger } from '../src/index';

const app = express();
const PORT = 3002;

// Setup structured logging with multiple outputs
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
                filename: './logs/webhook-structured.log'
            }
        }
    ],
    enableColors: true,
    enableTimestamps: true,
    enableStackTrace: true,
    maxFileSize: 10 * 1024 * 1024, // 10MB
    maxFiles: 5,
    rotateDaily: false
});

// Raw body parser
app.use('/webhooks', express.raw({ type: 'application/json' }));

// Logging middleware
app.use((req, res, next) => {
    // Log all incoming requests
    logger.info(`${req.method} ${req.path}`, {
        operation: 'request_received',
        source: 'express',
        custom: {
            userAgent: req.get('User-Agent'),
            ip: req.ip,
            contentType: req.get('Content-Type')
        }
    });
    next();
});

// Webhook configuration
const config = {
    source: 'stripe',
    secret: process.env.STRIPE_WEBHOOK_SECRET || 'whsec_test_secret'
};

// Webhook endpoint with comprehensive logging
app.post('/webhooks/stripe', async (req, res) => {
    const startTime = Date.now();
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Create child logger with request context
    const requestLogger = logger.child({
        requestId,
        operation: 'webhook_processing',
        source: 'stripe'
    });
    
    try {
        requestLogger.info('Processing webhook request');
        
        // Process webhook
        const event = await receiveWebhook(req, config);
        
        // Log webhook details using structured webhook logging
        logger.webhook({
            level: 'info',
            source: 'stripe',
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
        
        // Simulate business logic with detailed logging
        await processStripeEvent(event, requestLogger);
        
        const duration = Date.now() - startTime;
        
        // Log successful processing
        logger.webhook({
            level: 'info',
            source: 'stripe',
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
            metadata: {
                requestId,
                eventType: event.type
            }
        });
        
        requestLogger.info('Webhook processed successfully', {
            custom: { duration: `${duration}ms` }
        });
        
        res.status(200).json({
            success: true,
            eventId: event.id,
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
            source: 'stripe',
            operation: 'webhook_processed',
            duration,
            status: 'failure',
            metadata: {
                error: errorMessage,
                requestId,
                errorType: (error as Error).name
            }
        });
        
        // Log security event if it's a signature error
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
                    reason: 'Invalid webhook signature'
                },
                metadata: { requestId }
            });
        }
        
        res.status(400).json({
            error: 'Webhook processing failed',
            message: errorMessage,
            requestId,
            processingTime: `${duration}ms`
        });
    }
});

// Business logic with detailed logging
async function processStripeEvent(event: any, logger: any) {
    logger.info(`Processing ${event.type} event`, {
        webhookId: event.id
    });
    
    switch (event.type) {
        case 'invoice.payment_succeeded':
            logger.info('Payment succeeded - processing', {
                operation: 'payment_success',
                webhookId: event.id,
                custom: {
                    customerId: event.payload?.customer,
                    amount: event.payload?.amount_paid
                }
            });
            
            // Simulate async processing
            await new Promise(resolve => setTimeout(resolve, 100));
            
            logger.info('Payment processing completed', {
                operation: 'payment_success_completed',
                webhookId: event.id
            });
            break;
            
        case 'invoice.payment_failed':
            logger.warn('Payment failed - handling', {
                operation: 'payment_failure',
                webhookId: event.id,
                custom: {
                    customerId: event.payload?.customer,
                    failureReason: event.payload?.last_payment_error?.message
                }
            });
            break;
            
        case 'customer.subscription.created':
            logger.info('New subscription created', {
                operation: 'subscription_created',
                webhookId: event.id,
                custom: {
                    customerId: event.payload?.customer,
                    planId: event.payload?.plan?.id
                }
            });
            break;
            
        default:
            logger.info(`Unhandled event type: ${event.type}`, {
                operation: 'unhandled_event',
                webhookId: event.id
            });
    }
}

// Monitoring endpoints
app.get('/health', (req, res) => {
    logger.info('Health check requested', {
        operation: 'health_check'
    });
    
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        logging: {
            level: 'info',
            outputs: ['console', 'file'],
            logFile: './logs/webhook-structured.log'
        }
    });
});

app.get('/logs/sample', (req, res) => {
    // Generate sample log entries for demonstration
    logger.info('Sample info log', {
        operation: 'sample_generation',
        custom: { type: 'info' }
    });
    
    logger.warn('Sample warning log', {
        operation: 'sample_generation',
        custom: { type: 'warning' }
    });
    
    logger.webhook({
        level: 'info',
        source: 'sample',
        operation: 'sample_webhook',
        duration: 150,
        status: 'success',
        metadata: { type: 'demonstration' }
    });
    
    logger.performance({
        level: 'info',
        operation: 'sample_performance',
        duration: 200,
        metrics: {
            memoryUsage: process.memoryUsage().heapUsed,
            cpuUsage: process.cpuUsage().user
        },
        metadata: { type: 'demonstration' }
    });
    
    res.json({
        message: 'Sample logs generated',
        logFile: './logs/webhook-structured.log',
        note: 'Check console output and log file for structured JSON logs'
    });
});

// Graceful shutdown with log flushing
async function gracefulShutdown(signal: string) {
    logger.info(`Received ${signal}, shutting down gracefully...`);
    
    try {
        await logger.flush();
        logger.info('Logs flushed, shutdown complete');
        process.exit(0);
    } catch (error) {
        logger.error('Error during shutdown', error as Error);
        process.exit(1);
    }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

app.listen(PORT, () => {
    logger.info(`Structured logging webhook server started on port ${PORT}`, {
        operation: 'server_start',
        source: 'express'
    });
    
    console.log(`🚀 Structured logging server running on port ${PORT}`);
    console.log(`📥 Webhook: POST http://localhost:${PORT}/webhooks/stripe`);
    console.log(`❤️  Health: GET http://localhost:${PORT}/health`);
    console.log(`📝 Sample logs: GET http://localhost:${PORT}/logs/sample`);
    console.log(`📄 Log file: ./logs/webhook-structured.log`);
    
    console.log('\n🧪 Test with:');
    console.log(`curl -X POST http://localhost:${PORT}/webhooks/stripe -H "Content-Type: application/json" -d '{"test":"data"}'`);
    console.log(`curl http://localhost:${PORT}/logs/sample`);
});

export default app; 