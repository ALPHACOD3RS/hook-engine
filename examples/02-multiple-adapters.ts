/**
 * 02 - Multiple Adapters Example
 * 
 * This example shows how to handle webhooks from multiple providers
 * (Stripe, GitHub, Discord, Shopify) in a single application.
 */

import express from 'express';
import { receiveWebhook, adapters } from '../src/index';

const app = express();
const PORT = 3001;

// Raw body parser for webhook signature verification
app.use('/webhooks', express.raw({ type: 'application/json' }));

// Webhook configurations for different providers
const webhookConfigs = {
    stripe: {
        source: 'stripe',
        secret: process.env.STRIPE_WEBHOOK_SECRET || 'whsec_test_secret'
    },
    github: {
        source: 'github',
        secret: process.env.GITHUB_WEBHOOK_SECRET || 'github_test_secret'
    },
    discord: {
        source: 'discord',
        secret: process.env.DISCORD_WEBHOOK_SECRET || 'discord_test_secret'
    },
    shopify: {
        source: 'shopify',
        secret: process.env.SHOPIFY_WEBHOOK_SECRET || 'shopify_test_secret'
    }
};

// Business logic handlers for each provider
async function handleStripeWebhook(event: any) {
    console.log(`💳 Stripe: ${event.type}`);
    
    switch (event.type) {
        case 'invoice.payment_succeeded':
            console.log('  💰 Payment succeeded - Grant premium access');
            break;
        case 'invoice.payment_failed':
            console.log('  ❌ Payment failed - Send reminder email');
            break;
        case 'customer.subscription.created':
            console.log('  🎉 New subscription - Welcome email');
            break;
        default:
            console.log(`  📝 Unhandled Stripe event: ${event.type}`);
    }
}

async function handleGitHubWebhook(event: any) {
    console.log(`🐙 GitHub: ${event.type}`);
    
    const repo = event.payload?.repository?.name || 'unknown';
    
    switch (event.type) {
        case 'push':
            console.log(`  📤 Push to ${repo} - Trigger CI/CD`);
            break;
        case 'pull_request':
            console.log(`  🔀 Pull request in ${repo} - Run tests`);
            break;
        case 'issues':
            console.log(`  🐛 Issue in ${repo} - Notify team`);
            break;
        default:
            console.log(`  📝 Unhandled GitHub event: ${event.type}`);
    }
}

async function handleDiscordWebhook(event: any) {
    console.log(`💬 Discord: ${event.type}`);
    console.log('  📢 Process Discord server event');
}

async function handleShopifyWebhook(event: any) {
    console.log(`🛒 Shopify: ${event.type}`);
    
    switch (event.type) {
        case 'orders/create':
            console.log('  📦 New order - Process fulfillment');
            break;
        case 'orders/paid':
            console.log('  💰 Order paid - Send confirmation');
            break;
        default:
            console.log(`  📝 Unhandled Shopify event: ${event.type}`);
    }
}

// Generic webhook handler for all providers
app.post('/webhooks/:provider', async (req: any, res: any) => {
    const provider = req.params.provider;
    const startTime = Date.now();
    
    try {
        // Check if we support this provider
        const config = webhookConfigs[provider as keyof typeof webhookConfigs];
        if (!config) {
            return res.status(400).json({
                error: `Unsupported provider: ${provider}`,
                supportedProviders: Object.keys(webhookConfigs)
            });
        }
        
        // Process the webhook
        const event = await receiveWebhook(req, config);
        
        // Route to appropriate handler
        switch (provider) {
            case 'stripe':
                await handleStripeWebhook(event);
                break;
            case 'github':
                await handleGitHubWebhook(event);
                break;
            case 'discord':
                await handleDiscordWebhook(event);
                break;
            case 'shopify':
                await handleShopifyWebhook(event);
                break;
        }
        
        const duration = Date.now() - startTime;
        
        res.status(200).json({
            success: true,
            provider,
            eventId: event.id,
            eventType: event.type,
            processingTime: `${duration}ms`
        });
        
    } catch (error) {
        const duration = Date.now() - startTime;
        console.error(`❌ ${provider} webhook failed:`, (error as Error).message);
        
        res.status(400).json({
            error: 'Webhook processing failed',
            provider,
            message: (error as Error).message,
            processingTime: `${duration}ms`
        });
    }
});

// Status endpoint showing all supported providers
app.get('/status', (req: any, res: any) => {
    res.json({
        service: 'multi-provider-webhook-server',
        supportedProviders: Object.keys(webhookConfigs),
        availableAdapters: Object.keys(adapters),
        endpoints: Object.keys(webhookConfigs).map(provider => ({
            provider,
            endpoint: `/webhooks/${provider}`,
            method: 'POST'
        }))
    });
});

// Health check
app.get('/health', (req: any, res: any) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        providers: Object.keys(webhookConfigs).length
    });
});

app.listen(PORT, () => {
    console.log(`🚀 Multi-provider webhook server running on port ${PORT}`);
    console.log('\n📥 Webhook endpoints:');
    
    Object.keys(webhookConfigs).forEach(provider => {
        console.log(`  ${provider.toUpperCase()}: POST http://localhost:${PORT}/webhooks/${provider}`);
    });
    
    console.log('\n📊 Monitoring:');
    console.log(`  Status: GET http://localhost:${PORT}/status`);
    console.log(`  Health: GET http://localhost:${PORT}/health`);
    
    console.log('\n🧪 Test examples:');
    console.log(`  curl http://localhost:${PORT}/status`);
    console.log(`  curl -X POST http://localhost:${PORT}/webhooks/stripe -H "Content-Type: application/json" -d '{"test":"data"}'`);
    console.log(`  curl -X POST http://localhost:${PORT}/webhooks/github -H "Content-Type: application/json" -d '{"test":"data"}'`);
});

export default app; 