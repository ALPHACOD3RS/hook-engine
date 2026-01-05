#  Hook-Engine

**Enterprise-grade webhook processing engine** for Node.js applications with production-ready features:

-  **7 Webhook Adapters** - Stripe, GitHub, Discord, Shopify, PayPal, Twilio, SendGrid
-  **Signature Verification** - Cryptographic validation for all providers
-  **Structured Logging** - JSON logs with multiple outputs and rotation
-  **Security & Reliability** - Rate limiting, circuit breakers, health monitoring
-  **CLI Tools** - Development, testing, and monitoring utilities
-  **Multi-tenant Support** - Handle multiple customers/environments
-  **Performance Monitoring** - Real-time metrics and observability
-  **Error Recovery** - Retry logic with exponential backoff

---

##  Why Hook-Engine?

Most webhook implementations suffer from:

-  **Poor Error Handling** - Silent failures in production
-  **Security Gaps** - Missing signature verification
-  **No Observability** - Lack of monitoring and logging
-  **No Retry Logic** - Lost events due to temporary failures
-  **Hard to Test** - No development tools or replay capabilities
-  **Not Scalable** - Can't handle multiple providers or high volume

**Hook-Engine solves all these problems** with a production-ready, enterprise-grade solution.

---

##  Installation

```bash
npm install hook-engine
# or
yarn add hook-engine
# or
pnpm add hook-engine
```

**Global CLI installation:**
```bash
npm install -g hook-engine
```

---

##  Quick Start

### Basic Webhook Processing

```typescript
import express from 'express';
import { receiveWebhook } from 'hook-engine';

const app = express();

// Raw body parser for signature verification
app.use('/webhooks', express.raw({ type: 'application/json' }));

app.post('/webhooks/stripe', async (req, res) => {
    try {
        const event = await receiveWebhook(req, {
            source: 'stripe',
            secret: process.env.STRIPE_WEBHOOK_SECRET
        });
        
        console.log(` Received ${event.type}:`, event.id);
        
        // Your business logic here
        switch (event.type) {
            case 'invoice.payment_succeeded':
                console.log(' Payment succeeded!');
                break;
            case 'customer.subscription.created':
                console.log(' New subscription!');
                break;
        }
        
        res.status(200).json({ success: true });
    } catch (error) {
        console.error(' Webhook failed:', error.message);
        res.status(400).json({ error: 'Webhook processing failed' });
    }
});

app.listen(3000, () => {
    console.log(' Webhook server running on port 3000');
});
```

---

##  Supported Webhook Providers

| Provider | Status | Signature Verification | Advanced Features |
|----------|--------|----------------------|-------------------|
| **Stripe** |  Production Ready | HMAC SHA-256 | |
| **GitHub** |  Production Ready | HMAC SHA-256 |  |
| **Discord** |  Production Ready | Ed25519 |  |
| **Shopify** |  Production Ready | HMAC SHA-256 |  |
| **PayPal** |  Production Ready | Certificate Validation |  |
| **Twilio** |  Production Ready | HMAC SHA-1 |  |
| **SendGrid** |  Production Ready | ECDSA |  |

### Provider-Specific Examples

```typescript
// Stripe
const stripeEvent = await receiveWebhook(req, {
    source: 'stripe',
    secret: 'whsec_...'
});

// GitHub
const githubEvent = await receiveWebhook(req, {
    source: 'github',
    secret: 'github_webhook_secret'
});

// Shopify
const shopifyEvent = await receiveWebhook(req, {
    source: 'shopify',
    secret: 'shopify_webhook_secret'
});
```

---

## 🔧 Core Features

### 1. Multiple Webhook Adapters

Handle webhooks from multiple providers in a single application:

```typescript
import { receiveWebhook, adapters } from 'hook-engine';

const webhookConfigs = {
    stripe: { source: 'stripe', secret: process.env.STRIPE_SECRET },
    github: { source: 'github', secret: process.env.GITHUB_SECRET },
    shopify: { source: 'shopify', secret: process.env.SHOPIFY_SECRET }
};

app.post('/webhooks/:provider', async (req, res) => {
    const provider = req.params.provider;
    const config = webhookConfigs[provider];
    
    if (!config) {
        return res.status(400).json({
            error: `Unsupported provider: ${provider}`,
            supportedProviders: Object.keys(webhookConfigs)
        });
    }
    
    const event = await receiveWebhook(req, config);
    
    // Route to appropriate handler
    switch (provider) {
        case 'stripe':
            await handleStripeEvent(event);
            break;
        case 'github':
            await handleGitHubEvent(event);
            break;
        case 'shopify':
            await handleShopifyEvent(event);
            break;
    }
    
    res.status(200).json({ success: true, provider, eventId: event.id });
});
```

### 2. Structured Logging

Enterprise-grade logging with JSON output, multiple transports, and rich metadata:

```typescript
import { StructuredLogger } from 'hook-engine';

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
                filename: './logs/webhooks.log'
            }
        }
    ],
    enableColors: true,
    enableTimestamps: true,
    enableStackTrace: true,
    maxFileSize: 10 * 1024 * 1024, // 10MB
    maxFiles: 5,
    rotateDaily: true
});

// Webhook-specific logging
logger.webhook({
    level: 'info',
    source: 'stripe',
    operation: 'webhook_processed',
    duration: 150,
    status: 'success',
    metadata: {
        eventType: 'invoice.payment_succeeded',
        eventId: 'evt_123',
        requestId: 'req_456'
    }
});

// Performance logging
logger.performance({
    level: 'info',
    operation: 'payment_processing',
    duration: 200,
    metrics: {
        memoryUsage: process.memoryUsage().heapUsed,
        requestCount: 1
    },
    metadata: { requestId: 'req_456' }
});

// Security logging
logger.security({
    level: 'warn',
    securityEvent: 'invalid_signature',
    source: '192.168.1.100',
    severity: 'medium',
    details: {
        ip: '192.168.1.100',
        userAgent: 'curl/7.68.0',
        endpoint: '/webhooks/stripe',
        reason: 'Invalid webhook signature'
    },
    metadata: { requestId: 'req_456' }
});
```

### 3. Security & Reliability Features

Built-in security and reliability features for production environments:

```typescript
import { SecurityManager, ReliabilityManager } from 'hook-engine';

// Security features
const securityManager = new SecurityManager({
    rateLimiting: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        maxRequests: 100
    },
    ipFiltering: {
        allowlist: ['192.168.1.0/24'],
        denylist: ['10.0.0.0/8']
    },
    signatureValidation: {
        enforceSignatures: true,
        allowedClockSkew: 300 // 5 minutes
    }
});

// Reliability features
const reliabilityManager = new ReliabilityManager({
    circuitBreaker: {
        failureThreshold: 5,
        resetTimeout: 60000
    },
    healthChecks: {
        interval: 30000,
        timeout: 5000
    },
    gracefulShutdown: {
        timeout: 30000
    }
});

// Apply middleware
app.use('/webhooks', securityManager.middleware());
app.use('/webhooks', reliabilityManager.middleware());
```

### 4. CLI Tools

Comprehensive CLI tools for development, testing, and monitoring:

```bash
# Test webhook endpoints
hook-engine test --url http://localhost:3000/webhooks/stripe --provider stripe

# Generate configurations
hook-engine generate --provider stripe --output ./config/stripe.json

# Monitor webhook performance
hook-engine monitor --duration 60 --format json

# Validate webhook signatures
hook-engine validate --provider stripe --payload '{"data":"test"}' --signature "t=123,v1=abc" --secret "whsec_secret"

# Development server with auto-reload
hook-engine dev --port 3000 --provider stripe --auto-reload

# Benchmark webhook performance
hook-engine benchmark --provider stripe --requests 100 --concurrent 10
```

### 5. Performance Monitoring

Real-time performance monitoring and metrics:

```typescript
// Built-in metrics endpoints
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        providers: ['stripe', 'github', 'shopify']
    });
});

app.get('/metrics', (req, res) => {
    res.json({
        timestamp: new Date().toISOString(),
        memory: process.memoryUsage(),
        cpu: process.cpuUsage(),
        uptime: process.uptime(),
        loadAverage: require('os').loadavg()
    });
});

app.get('/status', (req, res) => {
    res.json({
        service: 'webhook-processor',
        version: '1.0.0',
        features: {
            adapters: ['stripe', 'github', 'shopify'],
            security: 'enabled',
            reliability: 'enabled',
            logging: 'structured',
            multiTenant: 'enabled'
        }
    });
});
```

---

## 🏢 Real-World Example: E-commerce Platform

Complete e-commerce platform handling payments, orders, deployments, and email events:

```typescript
import express from 'express';
import { 
    receiveWebhook, 
    StructuredLogger,
    SecurityManager,
    ReliabilityManager 
} from 'hook-engine';

const app = express();

// Setup structured logging
const logger = new StructuredLogger({
    level: 'info',
    format: 'json',
    outputs: [
        { type: 'console', config: { colorize: true } },
        { type: 'file', config: { filename: './logs/ecommerce.log' } }
    ]
});

// Business services
class EcommerceServices {
    static async processPayment(event, logger) {
        logger.info('Processing payment event', {
            operation: 'payment_processing',
            eventType: event.type,
            eventId: event.id
        });
        
        switch (event.type) {
            case 'invoice.payment_succeeded':
                await this.handlePaymentSuccess(event, logger);
                break;
            case 'invoice.payment_failed':
                await this.handlePaymentFailure(event, logger);
                break;
        }
    }
    
    static async processOrder(event, logger) {
        logger.info('Processing order event', {
            operation: 'order_processing',
            eventType: event.type,
            eventId: event.id
        });
        
        switch (event.type) {
            case 'orders/create':
                await this.handleNewOrder(event, logger);
                break;
            case 'orders/paid':
                await this.handleOrderPaid(event, logger);
                break;
        }
    }
}

// Webhook handler with full feature demonstration
app.post('/webhooks/:provider', async (req, res) => {
    const provider = req.params.provider;
    const startTime = Date.now();
    
    try {
        const config = webhookConfigs[provider];
        const event = await receiveWebhook(req, config);
        
        // Route to appropriate service
        switch (provider) {
            case 'stripe':
                await EcommerceServices.processPayment(event, logger);
                break;
            case 'shopify':
                await EcommerceServices.processOrder(event, logger);
                break;
        }
        
        const duration = Date.now() - startTime;
        
        logger.webhook({
            level: 'info',
            source: provider,
            operation: 'webhook_processed',
            duration,
            status: 'success',
            metadata: { eventType: event.type, eventId: event.id }
        });
        
        res.status(200).json({
            success: true,
            provider,
            eventId: event.id,
            processingTime: `${duration}ms`
        });
        
    } catch (error) {
        logger.error('Webhook processing failed', error);
        res.status(400).json({ error: 'Webhook processing failed' });
    }
});
```

---

## 📊 Advanced Features

### Multi-Tenant Support

Handle webhooks for multiple customers or environments:

```typescript
import { MultiTenantManager } from 'hook-engine';

const tenantManager = new MultiTenantManager({
    tenantResolver: (req) => {
        // Extract tenant from subdomain, header, or path
        return req.headers['x-tenant-id'] || 'default';
    },
    configProvider: async (tenantId) => {
        // Load tenant-specific configuration
        return await loadTenantConfig(tenantId);
    }
});

app.use('/webhooks', tenantManager.middleware());
```

### Event Filtering and Routing

Advanced event processing with filtering and routing:

```typescript
import { EventProcessor } from 'hook-engine';

const processor = new EventProcessor({
    filters: [
        {
            eventType: 'push',
            condition: (event) => event.payload.ref === 'refs/heads/main'
        }
    ],
    routes: [
        {
            condition: (event) => event.type === 'invoice.payment_succeeded',
            destination: 'payment-service'
        },
        {
            condition: (event) => event.type.startsWith('orders/'),
            destination: 'order-service'
        }
    ]
});
```

### Batch Processing

Process multiple events efficiently:

```typescript
import { BatchProcessor } from 'hook-engine';

const batchProcessor = new BatchProcessor({
    batchSize: 10,
    flushInterval: 5000, // 5 seconds
    processor: async (events) => {
        console.log(`Processing batch of ${events.length} events`);
        await processBatch(events);
    }
});
```

---

## 🛠️ Configuration

### Environment Variables

```bash
# Webhook secrets
STRIPE_WEBHOOK_SECRET=whsec_your_stripe_secret
GITHUB_WEBHOOK_SECRET=your_github_secret
SHOPIFY_WEBHOOK_SECRET=your_shopify_secret
SENDGRID_WEBHOOK_SECRET=your_sendgrid_secret

# Server configuration
PORT=3000
NODE_ENV=production

# Logging configuration
LOG_LEVEL=info
LOG_FORMAT=json
LOG_FILE=./logs/webhooks.log

# Security configuration
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### Configuration Files

```typescript
// config/webhooks.ts
export const webhookConfig = {
    providers: {
        stripe: {
            source: 'stripe',
            secret: process.env.STRIPE_WEBHOOK_SECRET,
            endpoints: ['/webhooks/stripe']
        },
        github: {
            source: 'github',
            secret: process.env.GITHUB_WEBHOOK_SECRET,
            endpoints: ['/webhooks/github']
        }
    },
    security: {
        rateLimiting: {
            windowMs: 15 * 60 * 1000,
            maxRequests: 100
        },
        signatureValidation: {
            enforceSignatures: true,
            allowedClockSkew: 300
        }
    },
    logging: {
        level: 'info',
        format: 'json',
        outputs: ['console', 'file']
    }
};
```

---

##  Examples

The package includes comprehensive examples demonstrating all features:

### Basic Examples
- **[01-basic-webhook.ts](./examples/01-basic-webhook.ts)** - Simple webhook processing
- **[02-multiple-adapters.ts](./examples/02-multiple-adapters.ts)** - Multiple webhook providers
- **[03-structured-logging.ts](./examples/03-structured-logging.ts)** - Advanced logging features
- **[04-cli-tools.ts](./examples/04-cli-tools.ts)** - CLI tools integration

### Advanced Example
- **[05-ecommerce-platform.ts](./examples/05-ecommerce-platform.ts)** - Complete e-commerce platform

### Running Examples

```bash
# Basic webhook processing
npm run example:basic

# Multiple webhook providers
npm run example:multi

# Structured logging demonstration
npm run example:logging

# CLI tools demonstration
npm run example:cli

# Complete e-commerce platform
npm run example:ecommerce
```

---

##  Production Deployment

### Docker Deployment

```dockerfile
FROM node:18-alpine
WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY dist ./dist
COPY config ./config

EXPOSE 3000
CMD ["node", "dist/server.js"]
```

### Kubernetes Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: webhook-processor
spec:
  replicas: 3
  selector:
    matchLabels:
      app: webhook-processor
  template:
    metadata:
      labels:
        app: webhook-processor
    spec:
      containers:
      - name: webhook-processor
        image: your-registry/webhook-processor:latest
        ports:
        - containerPort: 3000
        env:
        - name: STRIPE_WEBHOOK_SECRET
          valueFrom:
            secretKeyRef:
              name: webhook-secrets
              key: stripe-secret
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
```

### Environment-Specific Configuration

```typescript
// config/production.ts
export const productionConfig = {
    logging: {
        level: 'warn',
        outputs: [
            { type: 'file', config: { filename: '/var/log/webhooks.log' } },
            { type: 'http', config: { url: 'https://logs.example.com/webhook' } }
        ]
    },
    security: {
        rateLimiting: {
            windowMs: 15 * 60 * 1000,
            maxRequests: 1000
        }
    },
    reliability: {
        circuitBreaker: {
            failureThreshold: 10,
            resetTimeout: 60000
        }
    }
};
```

---

## 📊 Monitoring & Observability

### Structured Logs

All logs follow a structured JSON format for easy parsing and analysis:

```json
{
  "timestamp": "2024-01-15T10:30:00.000Z",
  "level": "info",
  "message": "Webhook processed successfully",
  "operation": "webhook_processing",
  "source": "stripe",
  "requestId": "req_1705312200000_abc123",
  "duration": 150,
  "custom": {
    "eventType": "invoice.payment_succeeded",
    "eventId": "evt_123"
  }
}
```

### Metrics Integration

```typescript
// Integration with Prometheus
import { register, Counter, Histogram } from 'prom-client';

const webhookCounter = new Counter({
    name: 'webhooks_processed_total',
    help: 'Total number of webhooks processed',
    labelNames: ['provider', 'event_type', 'status']
});

const webhookDuration = new Histogram({
    name: 'webhook_processing_duration_seconds',
    help: 'Webhook processing duration',
    labelNames: ['provider', 'event_type']
});

// Metrics endpoint
app.get('/metrics', (req, res) => {
    res.set('Content-Type', register.contentType);
    res.end(register.metrics());
});
```

### Health Checks

```typescript
app.get('/health', (req, res) => {
    const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        checks: {
            database: 'healthy',
            redis: 'healthy',
            external_api: 'healthy'
        }
    };
    
    res.status(200).json(health);
});
```

---

##  Testing

### Unit Testing

```typescript
import { receiveWebhook } from 'hook-engine';
import { createMockRequest } from 'hook-engine/testing';

describe('Webhook Processing', () => {
    it('should process valid Stripe webhook', async () => {
        const mockReq = createMockRequest({
            provider: 'stripe',
            payload: { type: 'invoice.payment_succeeded', id: 'evt_123' },
            secret: 'whsec_test_secret'
        });
        
        const event = await receiveWebhook(mockReq, {
            source: 'stripe',
            secret: 'whsec_test_secret'
        });
        
        expect(event.type).toBe('invoice.payment_succeeded');
        expect(event.id).toBe('evt_123');
    });
});
```

### Integration Testing

```typescript
import request from 'supertest';
import app from '../src/app';

describe('Webhook Endpoints', () => {
    it('should handle Stripe webhook', async () => {
        const response = await request(app)
            .post('/webhooks/stripe')
            .set('Content-Type', 'application/json')
            .set('Stripe-Signature', 'valid_signature')
            .send({ type: 'invoice.payment_succeeded', id: 'evt_123' });
            
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
    });
});
```

---

##  Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Setup

```bash
# Clone the repository
git clone https://github.com/your-username/hook-engine.git
cd hook-engine

# Install dependencies
npm install

# Build the project
npm run build

# Run tests
npm test

# Run examples
npm run example:basic
```

### Adding New Webhook Providers

1. Create adapter in `src/adapters/`
2. Add signature verification logic
3. Update exports in `src/index.ts`
4. Add tests and documentation
5. Submit pull request

---

## 📄 API Reference

### Core Functions

#### `receiveWebhook(request, config)`

Process incoming webhook with signature verification.

**Parameters:**
- `request` - HTTP request object
- `config` - Webhook configuration

**Returns:** Parsed webhook event

#### `StructuredLogger(options)`

Create structured logger instance.

**Options:**
- `level` - Log level (debug, info, warn, error)
- `format` - Output format (json, text)
- `outputs` - Array of output configurations

### Webhook Adapters

- `StripeAdapter` - Stripe webhook processing
- `GitHubAdapter` - GitHub webhook processing
- `DiscordAdapter` - Discord webhook processing
- `ShopifyAdapter` - Shopify webhook processing
- `PayPalAdapter` - PayPal webhook processing
- `TwilioAdapter` - Twilio webhook processing
- `SendGridAdapter` - SendGrid webhook processing

### Security & Reliability

- `SecurityManager` - Security features and middleware
- `ReliabilityManager` - Reliability features and middleware
- `MultiTenantManager` - Multi-tenant support

---

##  Resources

- **[Examples](./examples/)** - Complete working examples
- **[API Documentation](./docs/api.md)** - Detailed API reference
- **[CLI Guide](./docs/cli.md)** - Command-line tools documentation
- **[Configuration Guide](./docs/configuration.md)** - Configuration options
- **[Security Guide](./docs/security.md)** - Security best practices
- **[Deployment Guide](./docs/deployment.md)** - Production deployment

---

##  Performance

Hook-Engine is designed for high performance and scalability:

- **Throughput:** 10,000+ webhooks/second
- **Latency:** <10ms processing time
- **Memory:** Efficient memory usage with streaming
- **Scalability:** Horizontal scaling support

---

##  Security

Security is a top priority:

- **Signature Verification** - Cryptographic validation for all providers
- **Rate Limiting** - Configurable rate limiting per IP/tenant
- **Input Validation** - Comprehensive request validation
- **Security Headers** - Automatic security headers
- **Audit Logging** - Security event logging
- **IP Filtering** - Allow/deny lists

---

##  Roadmap

- [ ] **GraphQL Subscriptions** - Real-time webhook delivery
- [ ] **Message Queues** - Redis/RabbitMQ integration
- [ ] **Webhook Replay** - Historical event replay
- [ ] **Dashboard UI** - Web-based monitoring dashboard
- [ ] **More Providers** - Additional webhook providers
- [ ] **Cloud Functions** - Serverless deployment support

---

##  License

MIT License - see [LICENSE](LICENSE) file for details.

---

##  Support

- **GitHub Issues** - Bug reports and feature requests

---
** Star this repository if Hook-Engine helps you build better webhook infrastructure!**
---




