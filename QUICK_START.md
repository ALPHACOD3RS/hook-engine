# 🚀 Hook Engine - Quick Start Guide

## ✅ **WORKING EXAMPLE**

The hook-engine package is ready to use! Here's how to get started with a **working example**.

---

## 📦 **Installation**

```bash
npm install hook-engine
```

---

## 🎯 **Basic Usage (5 minutes)**

### 1. **Simple Webhook Handler**

```typescript
import express from 'express';
import { receiveWebhook, StructuredLogger } from 'hook-engine';

const app = express();

// Setup logging
const logger = new StructuredLogger({
    level: 'info',
    format: 'json',
    outputs: [{ type: 'console', config: {} }],
    enableColors: true,
    enableTimestamps: true,
    enableStackTrace: true,
    maxFileSize: 10 * 1024 * 1024,
    maxFiles: 5,
    rotateDaily: false
});

// Webhook config
const config = {
    source: 'stripe',
    secret: process.env.STRIPE_WEBHOOK_SECRET || 'your_webhook_secret'
};

// Raw body parser for signature verification
app.use('/webhooks', express.raw({ type: 'application/json' }));

// Webhook endpoint
app.post('/webhooks/stripe', async (req, res) => {
    try {
        const event = await receiveWebhook(req, config);
        
        // Log the webhook
        logger.webhook({
            level: 'info',
            source: 'stripe',
            operation: 'webhook_received',
            duration: 0,
            status: 'success',
            metadata: { eventType: event.type }
        });
        
        // Your business logic here
        console.log(`Received ${event.type} webhook:`, event.id);
        
        res.status(200).json({ success: true, eventId: event.id });
    } catch (error) {
        logger.error('Webhook failed', error as Error);
        res.status(400).json({ error: 'Webhook processing failed' });
    }
});

app.listen(3000, () => {
    console.log('🚀 Webhook server running on port 3000');
});
```

---

## 🧪 **Test the Working Demo**

### 1. **Run the Demo Server**

```bash
# Clone or navigate to hook-engine project
cd hook-engine

# Start the working demo
npx ts-node examples/working-express-demo.ts
```

### 2. **Test the Endpoints**

```bash
# Check server status
curl http://localhost:3000/status

# Health check
curl http://localhost:3000/health

# Test webhook (will fail signature validation - expected!)
curl -X POST http://localhost:3000/webhooks/stripe \
  -H "Content-Type: application/json" \
  -d '{"id":"evt_test","type":"invoice.payment_succeeded"}'
```

### 3. **Expected Responses**

**Status endpoint:**
```json
{
  "service": "hook-engine-working-demo",
  "version": "0.2.0",
  "features": {
    "adapters": ["stripe", "github", "discord", "shopify", "paypal", "twilio", "sendgrid", "generic"],
    "supportedSources": ["stripe", "github", "discord", "shopify"],
    "logging": "structured JSON logging"
  }
}
```

**Health endpoint:**
```json
{
  "status": "healthy",
  "timestamp": "2025-06-15T09:42:43.754Z",
  "uptime": 27.635,
  "memory": { "rss": 160399360, "heapTotal": 36683776 },
  "adapters": 8,
  "supportedSources": ["stripe", "github", "discord", "shopify"]
}
```

**Webhook test (signature validation failure - expected):**
```json
{
  "error": "Webhook processing failed",
  "message": "Missing signature header for source: stripe",
  "source": "stripe",
  "duration": "0ms"
}
```

---

## 🎯 **Supported Webhook Sources**

The hook-engine supports these webhook providers out of the box:

- ✅ **Stripe** - Payment processing
- ✅ **GitHub** - Git events, pull requests, issues
- ✅ **Discord** - Server events, messages
- ✅ **Shopify** - E-commerce events
- ✅ **PayPal** - Payment events
- ✅ **Twilio** - SMS, call events
- ✅ **SendGrid** - Email events
- ✅ **Generic** - Any webhook provider

---

## 📋 **Available Features**

### **Core Features**
- ✅ Webhook signature verification
- ✅ Automatic retry with exponential backoff
- ✅ Event deduplication
- ✅ Structured JSON logging
- ✅ Multiple webhook adapters

### **Advanced Features**
- ✅ Multi-tenant support
- ✅ Event filtering and routing
- ✅ Batch processing
- ✅ Performance monitoring
- ✅ Health checks

### **CLI Tools**
```bash
# Install globally for CLI access
npm install -g hook-engine

# Available commands
hook-engine init my-project     # Project scaffolding
hook-engine validate config.json # Config validation
hook-engine test http://localhost:3000/webhooks/stripe # Endpoint testing
hook-engine monitor             # Real-time monitoring
hook-engine benchmark           # Performance testing
```

---

## 🔧 **Configuration Examples**

### **Basic Configuration**
```typescript
const config = {
    source: 'stripe',
    secret: 'whsec_your_webhook_secret'
};
```

### **With Structured Logging**
```typescript
import { StructuredLogger } from 'hook-engine';

const logger = new StructuredLogger({
    level: 'info',
    format: 'json',
    outputs: [
        { type: 'console', config: { colorize: true } },
        { type: 'file', config: { filename: './logs/webhooks.log' } }
    ],
    enableColors: true,
    enableTimestamps: true,
    enableStackTrace: true,
    maxFileSize: 10 * 1024 * 1024,
    maxFiles: 5,
    rotateDaily: false
});
```

---

## 🚀 **Production Deployment**

### **Environment Variables**
```bash
# Webhook secrets
STRIPE_WEBHOOK_SECRET=whsec_your_stripe_secret
GITHUB_WEBHOOK_SECRET=your_github_secret
DISCORD_WEBHOOK_SECRET=your_discord_secret

# Server config
PORT=3000
NODE_ENV=production
```

### **Docker Example**
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["node", "dist/examples/working-express-demo.js"]
```

---

## 📝 **Real-World Example**

Here's how you'd handle Stripe webhooks in production:

```typescript
import { receiveWebhook, StructuredLogger } from 'hook-engine';

const logger = new StructuredLogger(/* config */);

app.post('/webhooks/stripe', async (req, res) => {
    const startTime = Date.now();
    
    try {
        const event = await receiveWebhook(req, {
            source: 'stripe',
            secret: process.env.STRIPE_WEBHOOK_SECRET!
        });
        
        // Handle different event types
        switch (event.type) {
            case 'invoice.payment_succeeded':
                await handlePaymentSuccess(event);
                break;
            case 'invoice.payment_failed':
                await handlePaymentFailure(event);
                break;
            case 'customer.subscription.created':
                await handleSubscriptionCreated(event);
                break;
            default:
                logger.info(`Unhandled event: ${event.type}`);
        }
        
        // Log success
        logger.webhook({
            level: 'info',
            source: 'stripe',
            operation: 'webhook_processed',
            duration: Date.now() - startTime,
            status: 'success',
            metadata: { eventType: event.type }
        });
        
        res.status(200).json({ success: true, eventId: event.id });
        
    } catch (error) {
        logger.error('Stripe webhook failed', error as Error);
        res.status(400).json({ error: 'Webhook processing failed' });
    }
});

async function handlePaymentSuccess(event: any) {
    const customerId = event.payload?.customer;
    logger.info(`Payment succeeded for customer: ${customerId}`);
    
    // Your business logic:
    // - Update database
    // - Send confirmation email
    // - Grant access to premium features
    // - etc.
}
```

---

## 🎉 **You're Ready!**

The hook-engine is now ready for production use with:

- ✅ **Working examples** that actually compile and run
- ✅ **Comprehensive logging** with structured JSON output
- ✅ **Multiple webhook providers** supported
- ✅ **Production-ready features** (retry, deduplication, monitoring)
- ✅ **CLI tools** for development and operations

**Next Steps:**
1. Try the working demo: `npx ts-node examples/working-express-demo.ts`
2. Adapt the code for your webhook provider
3. Deploy to production with proper environment variables
4. Monitor with the built-in health and metrics endpoints

Happy webhook processing! 🚀 