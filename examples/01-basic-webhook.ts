/**
 * 01 - Basic Webhook Example
 * 
 * This example shows the simplest way to use hook-engine
 * to process webhooks from any provider.
 */

import express from 'express';
import { receiveWebhook } from '../src/index';

const app = express();
const PORT = 3000;

// Raw body parser for webhook signature verification
app.use('/webhooks', express.raw({ type: 'application/json' }));

// Basic webhook configuration
const stripeConfig = {
    source: 'stripe',
    secret: process.env.STRIPE_WEBHOOK_SECRET || 'whsec_test_secret'
};

// Simple webhook endpoint
app.post('/webhooks/stripe', async (req, res) => {
    try {
        // Process the webhook with signature verification
        const event = await receiveWebhook(req, stripeConfig);
        
        console.log(`✅ Received ${event.type} webhook:`, event.id);
        
        // Your business logic here
        switch (event.type) {
            case 'invoice.payment_succeeded':
                console.log('💰 Payment succeeded!');
                break;
            case 'customer.subscription.created':
                console.log('🎉 New subscription created!');
                break;
            default:
                console.log(`📝 Unhandled event: ${event.type}`);
        }
        
        res.status(200).json({ 
            success: true, 
            eventId: event.id 
        });
        
    } catch (error) {
        console.error('❌ Webhook failed:', (error as Error).message);
        res.status(400).json({ 
            error: 'Webhook processing failed' 
        });
    }
});

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
    console.log(`🚀 Basic webhook server running on port ${PORT}`);
    console.log(`📥 Webhook endpoint: http://localhost:${PORT}/webhooks/stripe`);
    console.log(`❤️  Health check: http://localhost:${PORT}/health`);
    console.log('\n🧪 Test with:');
    console.log(`curl -X POST http://localhost:${PORT}/webhooks/stripe -H "Content-Type: application/json" -d '{"test":"data"}'`);
});

export default app; 