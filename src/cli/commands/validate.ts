import fs from 'fs/promises';
import path from 'path';
import { existsSync } from 'fs';

interface ValidateOptions {
    strict: boolean;
    format: 'json' | 'yaml' | 'table';
}

interface ValidationResult {
    valid: boolean;
    errors: ValidationError[];
    warnings: ValidationWarning[];
    summary: ValidationSummary;
}

interface ValidationError {
    path: string;
    message: string;
    severity: 'error' | 'warning';
    code: string;
}

interface ValidationWarning {
    path: string;
    message: string;
    suggestion?: string;
}

interface ValidationSummary {
    totalChecks: number;
    passed: number;
    failed: number;
    warnings: number;
}

export async function validateCommand(configPath: string, options: ValidateOptions) {
    console.log('🔍 Validating Hook Engine configuration...\n');
    
    try {
        // Check if config file exists
        if (!existsSync(configPath)) {
            console.error(`❌ Configuration file not found: ${configPath}`);
            process.exit(1);
        }
        
        console.log(`📄 Config file: ${path.resolve(configPath)}`);
        console.log(`🔧 Validation mode: ${options.strict ? 'strict' : 'standard'}\n`);
        
        // Load and parse configuration
        const config = await loadConfiguration(configPath);
        
        // Validate configuration
        const result = await validateConfiguration(config, options);
        
        // Output results
        await outputResults(result, options);
        
        // Exit with appropriate code
        if (!result.valid) {
            process.exit(1);
        }
        
        console.log('\n✅ Configuration validation completed successfully!');
        
    } catch (error) {
        console.error('❌ Validation failed:', (error as Error).message);
        process.exit(1);
    }
}

async function loadConfiguration(configPath: string): Promise<any> {
    const content = await fs.readFile(configPath, 'utf-8');
    const ext = path.extname(configPath).toLowerCase();
    
    try {
        switch (ext) {
            case '.json':
                return JSON.parse(content);
            case '.js':
            case '.ts':
                // For JS/TS files, we need to evaluate them
                // In a real implementation, you'd use a proper module loader
                const moduleContent = content.replace(/export\s+default\s+/, 'module.exports = ');
                const tempFile = path.join(process.cwd(), '.temp-config.js');
                await fs.writeFile(tempFile, moduleContent);
                const config = require(tempFile);
                await fs.unlink(tempFile);
                return config;
            case '.yaml':
            case '.yml':
                // Would use yaml parser in real implementation
                throw new Error('YAML configuration files not yet supported');
            default:
                throw new Error(`Unsupported configuration file format: ${ext}`);
        }
    } catch (error) {
        throw new Error(`Failed to parse configuration file: ${(error as Error).message}`);
    }
}

async function validateConfiguration(config: any, options: ValidateOptions): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    let totalChecks = 0;
    
    // Validate required fields
    totalChecks++;
    if (!config.adapters) {
        errors.push({
            path: 'adapters',
            message: 'Adapters configuration is required',
            severity: 'error',
            code: 'MISSING_ADAPTERS'
        });
    }
    
    // Validate adapters
    if (config.adapters) {
        const adapterResults = validateAdapters(config.adapters, options);
        errors.push(...adapterResults.errors);
        warnings.push(...adapterResults.warnings);
        totalChecks += adapterResults.totalChecks;
    }
    
    // Validate storage configuration
    if (config.storage) {
        const storageResults = validateStorage(config.storage, options);
        errors.push(...storageResults.errors);
        warnings.push(...storageResults.warnings);
        totalChecks += storageResults.totalChecks;
    } else if (options.strict) {
        errors.push({
            path: 'storage',
            message: 'Storage configuration is required in strict mode',
            severity: 'error',
            code: 'MISSING_STORAGE'
        });
    }
    
    // Validate retry configuration
    if (config.retry) {
        const retryResults = validateRetry(config.retry, options);
        errors.push(...retryResults.errors);
        warnings.push(...retryResults.warnings);
        totalChecks += retryResults.totalChecks;
    }
    
    // Validate security configuration
    if (config.security) {
        const securityResults = validateSecurity(config.security, options);
        errors.push(...securityResults.errors);
        warnings.push(...securityResults.warnings);
        totalChecks += securityResults.totalChecks;
    }
    
    // Validate observability configuration
    if (config.observability) {
        const observabilityResults = validateObservability(config.observability, options);
        errors.push(...observabilityResults.errors);
        warnings.push(...observabilityResults.warnings);
        totalChecks += observabilityResults.totalChecks;
    }
    
    const failed = errors.filter(e => e.severity === 'error').length;
    const passed = totalChecks - failed;
    
    return {
        valid: failed === 0,
        errors,
        warnings,
        summary: {
            totalChecks,
            passed,
            failed,
            warnings: warnings.length
        }
    };
}

function validateAdapters(adapters: any, options: ValidateOptions) {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    let totalChecks = 0;
    
    const supportedAdapters = ['github', 'stripe', 'shopify', 'discord', 'twilio', 'sendgrid', 'paypal'];
    
    for (const [adapterName, adapterConfig] of Object.entries(adapters)) {
        totalChecks++;
        
        if (!supportedAdapters.includes(adapterName)) {
            warnings.push({
                path: `adapters.${adapterName}`,
                message: `Unknown adapter: ${adapterName}`,
                suggestion: `Supported adapters: ${supportedAdapters.join(', ')}`
            });
        }
        
        // Validate adapter-specific configuration
        if (adapterName === 'github') {
            totalChecks++;
            if (!(adapterConfig as any).secret) {
                errors.push({
                    path: `adapters.${adapterName}.secret`,
                    message: 'GitHub webhook secret is required',
                    severity: 'error',
                    code: 'MISSING_SECRET'
                });
            }
        }
        
        if (adapterName === 'stripe') {
            totalChecks++;
            if (!(adapterConfig as any).secret) {
                errors.push({
                    path: `adapters.${adapterName}.secret`,
                    message: 'Stripe webhook secret is required',
                    severity: 'error',
                    code: 'MISSING_SECRET'
                });
            }
        }
    }
    
    return { errors, warnings, totalChecks };
}

function validateStorage(storage: any, options: ValidateOptions) {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    let totalChecks = 1;
    
    const supportedTypes = ['sqlite', 'postgresql', 'mysql', 'memory'];
    
    if (!storage.type) {
        errors.push({
            path: 'storage.type',
            message: 'Storage type is required',
            severity: 'error',
            code: 'MISSING_STORAGE_TYPE'
        });
    } else if (!supportedTypes.includes(storage.type)) {
        errors.push({
            path: 'storage.type',
            message: `Unsupported storage type: ${storage.type}`,
            severity: 'error',
            code: 'INVALID_STORAGE_TYPE'
        });
    }
    
    // Validate storage-specific configuration
    if (storage.type === 'sqlite') {
        totalChecks++;
        if (!storage.config?.database) {
            errors.push({
                path: 'storage.config.database',
                message: 'SQLite database path is required',
                severity: 'error',
                code: 'MISSING_DATABASE_PATH'
            });
        }
    }
    
    if (storage.type === 'postgresql' || storage.type === 'mysql') {
        totalChecks += 3;
        if (!storage.config?.host) {
            errors.push({
                path: 'storage.config.host',
                message: 'Database host is required',
                severity: 'error',
                code: 'MISSING_DB_HOST'
            });
        }
        if (!storage.config?.database) {
            errors.push({
                path: 'storage.config.database',
                message: 'Database name is required',
                severity: 'error',
                code: 'MISSING_DB_NAME'
            });
        }
        if (!storage.config?.user) {
            warnings.push({
                path: 'storage.config.user',
                message: 'Database user not specified',
                suggestion: 'Consider specifying a database user for security'
            });
        }
    }
    
    return { errors, warnings, totalChecks };
}

function validateRetry(retry: any, options: ValidateOptions) {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    let totalChecks = 3;
    
    if (typeof retry.maxAttempts !== 'number' || retry.maxAttempts < 1) {
        errors.push({
            path: 'retry.maxAttempts',
            message: 'maxAttempts must be a positive number',
            severity: 'error',
            code: 'INVALID_MAX_ATTEMPTS'
        });
    }
    
    if (typeof retry.baseDelay !== 'number' || retry.baseDelay < 0) {
        errors.push({
            path: 'retry.baseDelay',
            message: 'baseDelay must be a non-negative number',
            severity: 'error',
            code: 'INVALID_BASE_DELAY'
        });
    }
    
    if (retry.maxDelay && (typeof retry.maxDelay !== 'number' || retry.maxDelay < retry.baseDelay)) {
        errors.push({
            path: 'retry.maxDelay',
            message: 'maxDelay must be greater than or equal to baseDelay',
            severity: 'error',
            code: 'INVALID_MAX_DELAY'
        });
    }
    
    if (retry.maxAttempts > 10) {
        warnings.push({
            path: 'retry.maxAttempts',
            message: 'High number of retry attempts may impact performance',
            suggestion: 'Consider reducing maxAttempts to 5 or less'
        });
    }
    
    return { errors, warnings, totalChecks };
}

function validateSecurity(security: any, options: ValidateOptions) {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    let totalChecks = 0;
    
    if (security.rateLimiting) {
        totalChecks += 2;
        if (typeof security.rateLimiting.maxRequests !== 'number' || security.rateLimiting.maxRequests < 1) {
            errors.push({
                path: 'security.rateLimiting.maxRequests',
                message: 'maxRequests must be a positive number',
                severity: 'error',
                code: 'INVALID_RATE_LIMIT'
            });
        }
        
        if (typeof security.rateLimiting.windowMs !== 'number' || security.rateLimiting.windowMs < 1000) {
            errors.push({
                path: 'security.rateLimiting.windowMs',
                message: 'windowMs must be at least 1000ms',
                severity: 'error',
                code: 'INVALID_RATE_WINDOW'
            });
        }
    }
    
    if (security.ipAllowlist?.enabled && (!security.ipAllowlist.allowedIPs || security.ipAllowlist.allowedIPs.length === 0)) {
        warnings.push({
            path: 'security.ipAllowlist.allowedIPs',
            message: 'IP allowlist is enabled but no IPs are specified',
            suggestion: 'Add allowed IP addresses or disable IP allowlisting'
        });
    }
    
    return { errors, warnings, totalChecks };
}

function validateObservability(observability: any, options: ValidateOptions) {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    let totalChecks = 0;
    
    if (observability.logging) {
        totalChecks++;
        const validLevels = ['error', 'warn', 'info', 'debug'];
        if (observability.logging.level && !validLevels.includes(observability.logging.level)) {
            errors.push({
                path: 'observability.logging.level',
                message: `Invalid log level: ${observability.logging.level}`,
                severity: 'error',
                code: 'INVALID_LOG_LEVEL'
            });
        }
    }
    
    return { errors, warnings, totalChecks };
}

async function outputResults(result: ValidationResult, options: ValidateOptions) {
    switch (options.format) {
        case 'json':
            console.log(JSON.stringify(result, null, 2));
            break;
        case 'yaml':
            // Would use yaml serializer in real implementation
            console.log('YAML output not yet implemented');
            break;
        case 'table':
        default:
            outputTableFormat(result);
            break;
    }
}

function outputTableFormat(result: ValidationResult) {
    console.log('📊 Validation Results:');
    console.log('─'.repeat(50));
    console.log(`Total Checks: ${result.summary.totalChecks}`);
    console.log(`✅ Passed: ${result.summary.passed}`);
    console.log(`❌ Failed: ${result.summary.failed}`);
    console.log(`⚠️  Warnings: ${result.summary.warnings}`);
    console.log('─'.repeat(50));
    
    if (result.errors.length > 0) {
        console.log('\n❌ Errors:');
        result.errors.forEach((error, index) => {
            console.log(`${index + 1}. ${error.path}: ${error.message} (${error.code})`);
        });
    }
    
    if (result.warnings.length > 0) {
        console.log('\n⚠️  Warnings:');
        result.warnings.forEach((warning, index) => {
            console.log(`${index + 1}. ${warning.path}: ${warning.message}`);
            if (warning.suggestion) {
                console.log(`   💡 Suggestion: ${warning.suggestion}`);
            }
        });
    }
    
    if (result.valid) {
        console.log('\n🎉 Configuration is valid!');
    } else {
        console.log('\n💥 Configuration has errors that need to be fixed.');
    }
} 