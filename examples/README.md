# Hook-Engine Examples

This directory contains focused examples demonstrating all features of the hook-engine package. Each example is designed to showcase specific capabilities and can be run independently.

## 📁 Example Structure

### Basic Examples (Individual Features)

1. **[01-basic-webhook.ts](./01-basic-webhook.ts)** - Simple webhook processing
2. **[02-multiple-adapters.ts](./02-multiple-adapters.ts)** - Multiple webhook providers
3. **[03-structured-logging.ts](./03-structured-logging.ts)** - Advanced logging features
4. **[04-cli-tools.ts](./04-cli-tools.ts)** - CLI tools integration

### Advanced Example (Real-World Use Case)

5. **[05-ecommerce-platform.ts](./05-ecommerce-platform.ts)** - Complete e-commerce platform

## 🚀 Quick Start

### Prerequisites

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Create logs directory
mkdir -p logs
```

### Running Examples

Each example runs on a different port to avoid conflicts:

```bash
# Basic webhook (port 3000)
npx ts-node examples/01-basic-webhook.ts

# Multiple adapters (port 3001)
npx ts-node examples/02-multiple-adapters.ts

# Structured logging (port 3002)
npx ts-node examples/03-structured-logging.ts

# CLI tools demo
npx ts-node examples/04-cli-tools.ts

# E-commerce platform (port 3003)
npx ts-node examples/05-ecommerce-platform.ts
```

## 📖 Example Details

### 1. Basic Webhook Example

**File:** `01-basic-webhook.ts`  
**Port:** 3000  
**Features:** Basic webhook processing with signature verification

```typescript
// Simple usage
const event = await receiveWebhook(req, {
    source: 'stripe',
    secret: 'whsec_test_secret'
});
```

**Endpoints:**
- `POST /webhooks/stripe` - Process Stripe webhooks
- `GET /health` - Health check

**Test:**
```bash
curl -X POST http://localhost:3000/webhooks/stripe \
  -H "Content-Type: application/json" \
  -d '{"test":"data"}'
```

### 2. Multiple Adapters Example

**File:** `02-multiple-adapters.ts`  
**Port:** 3001  
**Features:** Handle multiple webhook providers in one application

**Supported Providers:**
- Stripe (payments)
- GitHub (repository events)
- Discord (server events)
- Shopify (e-commerce events)

**Endpoints:**
- `POST /webhooks/:provider` - Generic webhook handler
- `GET /status` - Service status with provider info
- `GET /health` - Health check

**Test:**
```bash
# Test different providers
curl -X POST http://localhost:3001/webhooks/stripe -H "Content-Type: application/json" -d '{"test":"payment"}'
curl -X POST http://localhost:3001/webhooks/github -H "Content-Type: application/json" -d '{"test":"push"}'
curl -X POST http://localhost:3001/webhooks/shopify -H "Content-Type: application/json" -d '{"test":"order"}'

# Check status
curl http://localhost:3001/status
```

### 3. Structured Logging Example

**File:** `03-structured-logging.ts`  
**Port:** 3002  
**Features:** Advanced logging with JSON output, multiple transports, and rich metadata

**Logging Features:**
- JSON structured output
- Multiple outputs (console + file)
- Request correlation IDs
- Performance metrics
- Security event logging
- Webhook-specific logging
- Log rotation and management

**Endpoints:**
- `POST /webhooks/stripe` - Webhook with comprehensive logging
- `GET /health` - Health check with logging info
- `GET /logs/sample` - Generate sample log entries

**Log File:** `./logs/webhook-structured.log`

**Test:**
```bash
# Process webhook (generates detailed logs)
curl -X POST http://localhost:3002/webhooks/stripe -H "Content-Type: application/json" -d '{"test":"data"}'

# Generate sample logs
curl http://localhost:3002/logs/sample

# View log file
tail -f logs/webhook-structured.log
```

### 4. CLI Tools Example

**File:** `04-cli-tools.ts`  
**Features:** Demonstrates CLI tools for webhook development and testing

**CLI Commands Available:**
- `hook-engine test` - Test webhook endpoints
- `hook-engine generate` - Generate configurations
- `hook-engine monitor` - Monitor webhook performance
- `hook-engine validate` - Validate webhook signatures

**Usage Examples:**
```bash
# Test webhook endpoint
hook-engine test --url http://localhost:3000/webhooks/stripe --provider stripe

# Generate configuration
hook-engine generate --provider stripe --output ./config/stripe.json

# Monitor webhooks
hook-engine monitor --duration 60 --format json

# Validate signature
hook-engine validate --provider stripe --payload '{"data":"test"}' --signature "t=123,v1=abc" --secret "whsec_secret"
```

**Run Demo:**
```bash
npx ts-node examples/04-cli-tools.ts
```

### 5. E-commerce Platform Example (Real-World)

**File:** `05-ecommerce-platform.ts`  
**Port:** 3003  
**Features:** Complete e-commerce platform using ALL hook-engine features

**🏢 Business Scenario:**
A complete e-commerce platform that handles:
- **Payments** (Stripe) - Process payments, subscriptions, failures
- **Orders** (Shopify) - Order lifecycle management
- **Deployments** (GitHub) - CI/CD pipeline triggers
- **Email Events** (SendGrid) - Email delivery tracking

**✨ All Features Demonstrated:**
- ✅ Multiple webhook adapters (4 providers)
- ✅ Structured JSON logging with file rotation
- ✅ Security monitoring and threat detection
- ✅ Performance tracking and metrics
- ✅ Error handling and recovery
- ✅ Request tracing and correlation
- ✅ Multi-tenant support capabilities
- ✅ Graceful shutdown with log flushing

**Business Logic Services:**
1. **Payment Service** - Handle Stripe payment events
2. **Order Service** - Process Shopify order lifecycle
3. **Deployment Service** - Manage GitHub CI/CD events
4. **Email Service** - Track SendGrid email events

**Endpoints:**
- `POST /webhooks/:provider` - Process webhooks (stripe, shopify, github, sendgrid)
- `GET /status` - Comprehensive service status
- `GET /health` - Health check
- `GET /metrics` - Performance metrics

**Security Features:**
- Webhook signature verification
- Suspicious payload detection
- Security event logging
- IP-based monitoring

**Monitoring & Observability:**
- Request correlation IDs
- Performance metrics logging
- Business metrics tracking
- Error tracking and alerting
- Log file rotation (50MB, 10 files)

**Test the Platform:**
```bash
# Start the platform
npx ts-node examples/05-ecommerce-platform.ts

# Test different business scenarios
curl http://localhost:3003/status

# Payment processing
curl -X POST http://localhost:3003/webhooks/stripe \
  -H "Content-Type: application/json" \
  -d '{"type":"invoice.payment_succeeded","id":"evt_123","data":{"object":{"customer":"cus_123","amount_paid":2000}}}'

# Order management
curl -X POST http://localhost:3003/webhooks/shopify \
  -H "Content-Type: application/json" \
  -d '{"type":"orders/create","id":"order_123","data":{"object":{"id":"123","customer":{"id":"cus_123"}}}}'

# Deployment events
curl -X POST http://localhost:3003/webhooks/github \
  -H "Content-Type: application/json" \
  -d '{"type":"push","id":"push_123","data":{"object":{"repository":{"name":"ecommerce-app"}}}}'

# Email tracking
curl -X POST http://localhost:3003/webhooks/sendgrid \
  -H "Content-Type: application/json" \
  -d '{"type":"delivered","id":"email_123","data":{"object":{"email":"customer@example.com"}}}'

# Monitor metrics
curl http://localhost:3003/metrics

# View structured logs
tail -f logs/ecommerce-platform.log
```

## 🔧 Configuration

### Environment Variables

```bash
# Webhook secrets (use real secrets in production)
STRIPE_WEBHOOK_SECRET=whsec_your_stripe_secret
GITHUB_WEBHOOK_SECRET=your_github_secret
DISCORD_WEBHOOK_SECRET=your_discord_secret
SHOPIFY_WEBHOOK_SECRET=your_shopify_secret
SENDGRID_WEBHOOK_SECRET=your_sendgrid_secret

# Server configuration
PORT=3003
NODE_ENV=development
```

### Log Configuration

All examples create logs in the `./logs/` directory:
- `webhook-structured.log` - Structured logging example
- `ecommerce-platform.log` - E-commerce platform logs
- `webhook-monitor.log` - CLI monitoring output

## 📊 Monitoring & Observability

### Log Structure

All logs follow a structured JSON format:

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

### Metrics Tracked

- **Performance**: Request duration, memory usage, CPU usage
- **Business**: Revenue, orders, deployments, email engagement
- **Security**: Invalid signatures, suspicious payloads, failed requests
- **Reliability**: Success rates, error rates, retry attempts

### Health Checks

All examples include health check endpoints:
- Basic health status
- Uptime information
- Memory usage
- Service configuration

## 🛠️ Development

### Adding New Examples

1. Create a new file: `examples/XX-feature-name.ts`
2. Use a unique port number
3. Include comprehensive logging
4. Add documentation to this README
5. Include test commands

### Testing Examples

```bash
# Test all examples compile
npm run build

# Run specific example
npx ts-node examples/01-basic-webhook.ts

# Test with curl
curl http://localhost:3000/health
```

### Debugging

Enable debug logging:
```bash
DEBUG=hook-engine:* npx ts-node examples/05-ecommerce-platform.ts
```

View logs in real-time:
```bash
tail -f logs/*.log | jq '.'
```

## 📚 Additional Resources

- [Hook-Engine Documentation](../README.md)
- [API Reference](../docs/api.md)
- [CLI Tools Guide](../docs/cli.md)
- [Configuration Guide](../docs/configuration.md)

## 🤝 Contributing

To add new examples:
1. Follow the existing pattern
2. Include comprehensive documentation
3. Add test commands
4. Update this README

## 📄 License

Same as the main hook-engine package. 