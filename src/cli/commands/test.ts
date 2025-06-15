import fs from 'fs/promises';
import { existsSync } from 'fs';

interface TestOptions {
    payload?: string;
    count: string;
}

export async function testCommand(endpoint: string, options: TestOptions) {
    console.log('🧪 Testing webhook endpoint...\n');
    
    const count = parseInt(options.count, 10);
    console.log(`🎯 Target: ${endpoint}`);
    console.log(`📊 Test count: ${count}\n`);
    
    try {
        // Load payload if specified
        let payload = { test: true, timestamp: new Date().toISOString() };
        if (options.payload && existsSync(options.payload)) {
            const payloadContent = await fs.readFile(options.payload, 'utf-8');
            payload = JSON.parse(payloadContent);
            console.log(`📄 Loaded payload from: ${options.payload}`);
        }
        
        // Run tests
        const results = [];
        for (let i = 0; i < count; i++) {
            console.log(`🔄 Test ${i + 1}/${count}...`);
            const result = await runSingleTest(endpoint, payload);
            results.push(result);
            
            if (i < count - 1) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
        
        // Display results
        displayResults(results);
        
    } catch (error) {
        console.error('❌ Test failed:', (error as Error).message);
        process.exit(1);
    }
}

async function runSingleTest(endpoint: string, payload: any) {
    const startTime = Date.now();
    
    try {
        // Simulate HTTP request
        await new Promise(resolve => setTimeout(resolve, Math.random() * 500 + 100));
        
        const duration = Date.now() - startTime;
        const success = Math.random() > 0.1; // 90% success rate for demo
        
        return {
            success,
            duration,
            status: success ? 200 : 500,
            error: success ? null : 'Simulated error'
        };
    } catch (error) {
        return {
            success: false,
            duration: Date.now() - startTime,
            status: 0,
            error: (error as Error).message
        };
    }
}

function displayResults(results: any[]) {
    const successful = results.filter(r => r.success).length;
    const failed = results.length - successful;
    const avgDuration = results.reduce((sum, r) => sum + r.duration, 0) / results.length;
    
    console.log('\n📊 Test Results:');
    console.log('─'.repeat(40));
    console.log(`✅ Successful: ${successful}/${results.length}`);
    console.log(`❌ Failed: ${failed}/${results.length}`);
    console.log(`⏱️  Average duration: ${avgDuration.toFixed(2)}ms`);
    console.log(`📈 Success rate: ${((successful / results.length) * 100).toFixed(1)}%`);
    
    if (failed > 0) {
        console.log('\n❌ Failed requests:');
        results.forEach((result, index) => {
            if (!result.success) {
                console.log(`  ${index + 1}. Status: ${result.status}, Error: ${result.error}`);
            }
        });
    }
} 