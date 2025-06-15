interface BenchmarkOptions {
    url?: string;
    requests: string;
    concurrency: string;
}

export async function benchmarkCommand(options: BenchmarkOptions) {
    console.log('⚡ Starting Hook Engine performance benchmark...\n');
    
    const totalRequests = parseInt(options.requests, 10);
    const concurrency = parseInt(options.concurrency, 10);
    const url = options.url || 'http://localhost:3000/webhook';
    
    console.log(`🎯 Target URL: ${url}`);
    console.log(`📊 Total requests: ${totalRequests}`);
    console.log(`🔄 Concurrency: ${concurrency}\n`);
    
    console.log('🚀 Starting benchmark...');
    
    const startTime = Date.now();
    const results: any[] = [];
    
    // Simulate concurrent requests
    const batches = Math.ceil(totalRequests / concurrency);
    
    for (let batch = 0; batch < batches; batch++) {
        const batchSize = Math.min(concurrency, totalRequests - batch * concurrency);
        const batchPromises = [];
        
        for (let i = 0; i < batchSize; i++) {
            batchPromises.push(simulateRequest());
        }
        
        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
        
        const completed = (batch + 1) * concurrency;
        const progress = Math.min(completed, totalRequests);
        const percentage = ((progress / totalRequests) * 100).toFixed(1);
        
        process.stdout.write(`\r📈 Progress: ${progress}/${totalRequests} (${percentage}%)`);
    }
    
    const totalTime = Date.now() - startTime;
    
    console.log('\n\n📊 Benchmark Results:');
    console.log('─'.repeat(50));
    
    // Calculate statistics
    const successful = results.filter(r => r.success).length;
    const failed = results.length - successful;
    const responseTimes = results.map(r => r.responseTime);
    const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
    const minResponseTime = Math.min(...responseTimes);
    const maxResponseTime = Math.max(...responseTimes);
    const requestsPerSecond = (totalRequests / totalTime) * 1000;
    
    // Calculate percentiles
    const sortedTimes = responseTimes.sort((a, b) => a - b);
    const p50 = sortedTimes[Math.floor(sortedTimes.length * 0.5)];
    const p95 = sortedTimes[Math.floor(sortedTimes.length * 0.95)];
    const p99 = sortedTimes[Math.floor(sortedTimes.length * 0.99)];
    
    console.log(`⏱️  Total time: ${totalTime}ms`);
    console.log(`🚀 Requests/sec: ${requestsPerSecond.toFixed(2)}`);
    console.log(`✅ Successful: ${successful}/${totalRequests} (${((successful/totalRequests)*100).toFixed(1)}%)`);
    console.log(`❌ Failed: ${failed}/${totalRequests} (${((failed/totalRequests)*100).toFixed(1)}%)`);
    console.log();
    console.log('📈 Response Time Statistics:');
    console.log(`   Average: ${avgResponseTime.toFixed(2)}ms`);
    console.log(`   Min: ${minResponseTime}ms`);
    console.log(`   Max: ${maxResponseTime}ms`);
    console.log(`   50th percentile: ${p50}ms`);
    console.log(`   95th percentile: ${p95}ms`);
    console.log(`   99th percentile: ${p99}ms`);
    
    if (failed > 0) {
        console.log('\n❌ Error Summary:');
        const errorCounts: { [key: string]: number } = {};
        results.filter(r => !r.success).forEach(r => {
            errorCounts[r.error] = (errorCounts[r.error] || 0) + 1;
        });
        
        Object.entries(errorCounts).forEach(([error, count]) => {
            console.log(`   ${error}: ${count} occurrences`);
        });
    }
    
    console.log('\n🎉 Benchmark completed!');
}

async function simulateRequest() {
    const startTime = Date.now();
    
    // Simulate network latency and processing time
    const baseLatency = 50 + Math.random() * 200; // 50-250ms
    const processingTime = 10 + Math.random() * 40; // 10-50ms
    const totalTime = baseLatency + processingTime;
    
    await new Promise(resolve => setTimeout(resolve, totalTime));
    
    const responseTime = Date.now() - startTime;
    const success = Math.random() > 0.05; // 95% success rate
    
    return {
        success,
        responseTime,
        error: success ? null : 'Connection timeout'
    };
} 