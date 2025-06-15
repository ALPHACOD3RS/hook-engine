/**
 * 04 - CLI Tools Example
 * 
 * This example demonstrates how to use the CLI tools for
 * webhook development, testing, and monitoring.
 */

import { spawn } from 'child_process';
import path from 'path';

// CLI tool paths
const CLI_PATH = path.join(__dirname, '../dist/cli');

/**
 * Example: Using CLI tools programmatically
 */
export class CLIToolsDemo {
    
    /**
     * Test webhook endpoint using CLI
     */
    static async testWebhookEndpoint(url: string, provider: string = 'stripe') {
        console.log(`🧪 Testing webhook endpoint: ${url}`);
        
        return new Promise((resolve, reject) => {
            const testProcess = spawn('node', [
                `${CLI_PATH}/test-webhook.js`,
                '--url', url,
                '--provider', provider,
                '--payload', JSON.stringify({ test: 'data', timestamp: Date.now() })
            ]);
            
            let output = '';
            let errorOutput = '';
            
            testProcess.stdout.on('data', (data) => {
                output += data.toString();
                console.log(`📤 ${data.toString().trim()}`);
            });
            
            testProcess.stderr.on('data', (data) => {
                errorOutput += data.toString();
                console.error(`❌ ${data.toString().trim()}`);
            });
            
            testProcess.on('close', (code) => {
                if (code === 0) {
                    console.log('✅ Webhook test completed successfully');
                    resolve(output);
                } else {
                    console.error(`❌ Webhook test failed with code ${code}`);
                    reject(new Error(errorOutput || `Process exited with code ${code}`));
                }
            });
        });
    }
    
    /**
     * Generate webhook configuration using CLI
     */
    static async generateConfig(provider: string, outputPath: string) {
        console.log(`⚙️  Generating configuration for ${provider}`);
        
        return new Promise((resolve, reject) => {
            const configProcess = spawn('node', [
                `${CLI_PATH}/generate-config.js`,
                '--provider', provider,
                '--output', outputPath,
                '--format', 'json'
            ]);
            
            let output = '';
            
            configProcess.stdout.on('data', (data) => {
                output += data.toString();
                console.log(`📝 ${data.toString().trim()}`);
            });
            
            configProcess.stderr.on('data', (data) => {
                console.error(`❌ ${data.toString().trim()}`);
            });
            
            configProcess.on('close', (code) => {
                if (code === 0) {
                    console.log(`✅ Configuration generated: ${outputPath}`);
                    resolve(output);
                } else {
                    reject(new Error(`Config generation failed with code ${code}`));
                }
            });
        });
    }
    
    /**
     * Monitor webhook performance using CLI
     */
    static async monitorWebhooks(duration: number = 30) {
        console.log(`📊 Monitoring webhooks for ${duration} seconds`);
        
        return new Promise((resolve, reject) => {
            const monitorProcess = spawn('node', [
                `${CLI_PATH}/monitor.js`,
                '--duration', duration.toString(),
                '--format', 'json',
                '--output', './logs/webhook-monitor.log'
            ]);
            
            let output = '';
            
            monitorProcess.stdout.on('data', (data) => {
                const line = data.toString().trim();
                output += line + '\n';
                
                // Parse monitoring output
                try {
                    const monitorData = JSON.parse(line);
                    console.log(`📈 ${monitorData.timestamp}: ${monitorData.metric} = ${monitorData.value}`);
                } catch {
                    console.log(`📊 ${line}`);
                }
            });
            
            monitorProcess.stderr.on('data', (data) => {
                console.error(`❌ ${data.toString().trim()}`);
            });
            
            monitorProcess.on('close', (code) => {
                if (code === 0) {
                    console.log('✅ Monitoring completed');
                    resolve(output);
                } else {
                    reject(new Error(`Monitoring failed with code ${code}`));
                }
            });
        });
    }
    
    /**
     * Validate webhook signatures using CLI
     */
    static async validateSignature(payload: string, signature: string, secret: string, provider: string = 'stripe') {
        console.log(`🔐 Validating webhook signature for ${provider}`);
        
        return new Promise((resolve, reject) => {
            const validateProcess = spawn('node', [
                `${CLI_PATH}/validate-signature.js`,
                '--provider', provider,
                '--payload', payload,
                '--signature', signature,
                '--secret', secret
            ]);
            
            let output = '';
            
            validateProcess.stdout.on('data', (data) => {
                output += data.toString();
                console.log(`🔍 ${data.toString().trim()}`);
            });
            
            validateProcess.stderr.on('data', (data) => {
                console.error(`❌ ${data.toString().trim()}`);
            });
            
            validateProcess.on('close', (code) => {
                if (code === 0) {
                    console.log('✅ Signature validation completed');
                    resolve(output);
                } else {
                    reject(new Error(`Signature validation failed with code ${code}`));
                }
            });
        });
    }
    
    /**
     * Run comprehensive CLI demo
     */
    static async runDemo() {
        console.log('🚀 Starting CLI Tools Demo\n');
        
        try {
            // 1. Generate configuration
            console.log('=== Step 1: Generate Configuration ===');
            await this.generateConfig('stripe', './examples/generated-stripe-config.json');
            console.log('');
            
            // 2. Test webhook endpoint (assuming a server is running)
            console.log('=== Step 2: Test Webhook Endpoint ===');
            try {
                await this.testWebhookEndpoint('http://localhost:3000/webhooks/stripe', 'stripe');
            } catch (error) {
                console.log('⚠️  Webhook endpoint test failed (server may not be running)');
                console.log('   Start a webhook server first with: npm run example:basic');
            }
            console.log('');
            
            // 3. Validate signature
            console.log('=== Step 3: Validate Signature ===');
            const testPayload = JSON.stringify({ test: 'data', timestamp: Date.now() });
            const testSignature = 'test_signature';
            const testSecret = 'whsec_test_secret';
            
            try {
                await this.validateSignature(testPayload, testSignature, testSecret, 'stripe');
            } catch (error) {
                console.log('⚠️  Signature validation failed (expected for demo data)');
            }
            console.log('');
            
            // 4. Monitor webhooks (short duration for demo)
            console.log('=== Step 4: Monitor Webhooks ===');
            try {
                await this.monitorWebhooks(5); // 5 seconds for demo
            } catch (error) {
                console.log('⚠️  Monitoring failed (may need active webhook traffic)');
            }
            
            console.log('\n✅ CLI Tools Demo completed!');
            console.log('\n📚 Available CLI commands:');
            console.log('  hook-engine test --url <url> --provider <provider>');
            console.log('  hook-engine generate --provider <provider> --output <file>');
            console.log('  hook-engine monitor --duration <seconds>');
            console.log('  hook-engine validate --provider <provider> --payload <data> --signature <sig> --secret <secret>');
            
        } catch (error) {
            console.error('❌ CLI Demo failed:', (error as Error).message);
        }
    }
}

/**
 * CLI Usage Examples
 */
export const CLI_EXAMPLES = {
    // Test webhook endpoints
    testWebhook: {
        description: 'Test a webhook endpoint with sample data',
        commands: [
            'hook-engine test --url http://localhost:3000/webhooks/stripe --provider stripe',
            'hook-engine test --url http://localhost:3001/webhooks/github --provider github --payload \'{"action":"opened","pull_request":{"id":1}}\'',
            'hook-engine test --url http://localhost:3002/webhooks/shopify --provider shopify --headers \'{"X-Shopify-Topic":"orders/create"}\''
        ]
    },
    
    // Generate configurations
    generateConfig: {
        description: 'Generate webhook configurations for different providers',
        commands: [
            'hook-engine generate --provider stripe --output ./config/stripe.json',
            'hook-engine generate --provider github --output ./config/github.json --format yaml',
            'hook-engine generate --provider all --output ./config/ --format json'
        ]
    },
    
    // Monitor webhooks
    monitor: {
        description: 'Monitor webhook performance and metrics',
        commands: [
            'hook-engine monitor --duration 60 --format json',
            'hook-engine monitor --output ./logs/metrics.log --interval 5',
            'hook-engine monitor --providers stripe,github --format table'
        ]
    },
    
    // Validate signatures
    validateSignature: {
        description: 'Validate webhook signatures',
        commands: [
            'hook-engine validate --provider stripe --payload \'{"data":"test"}\' --signature "t=123,v1=abc" --secret "whsec_secret"',
            'hook-engine validate --provider github --payload \'{"action":"push"}\' --signature "sha256=hash" --secret "github_secret"',
            'hook-engine validate --provider shopify --payload \'{"id":123}\' --signature "hmac_hash" --secret "shopify_secret"'
        ]
    },
    
    // Development helpers
    development: {
        description: 'Development and debugging tools',
        commands: [
            'hook-engine dev --port 3000 --provider stripe --auto-reload',
            'hook-engine debug --log-level debug --output ./logs/debug.log',
            'hook-engine benchmark --provider stripe --requests 100 --concurrent 10'
        ]
    }
};

// Run demo if this file is executed directly
if (require.main === module) {
    CLIToolsDemo.runDemo().catch(console.error);
}

export default CLIToolsDemo; 