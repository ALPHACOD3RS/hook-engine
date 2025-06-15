import fs from 'fs/promises';
import path from 'path';
import { existsSync } from 'fs';

interface InitOptions {
    template: string;
    directory: string;
    force: boolean;
    typescript: boolean;
    docker: boolean;
}

export async function initCommand(options: InitOptions) {
    console.log('🚀 Initializing Hook Engine project...\n');
    
    const targetDir = path.resolve(options.directory);
    const projectName = path.basename(targetDir);
    
    try {
        // Check if directory exists and is not empty
        if (existsSync(targetDir)) {
            const files = await fs.readdir(targetDir);
            if (files.length > 0 && !options.force) {
                console.error('❌ Directory is not empty. Use --force to overwrite.');
                process.exit(1);
            }
        } else {
            await fs.mkdir(targetDir, { recursive: true });
        }

        console.log(`📁 Creating project in: ${targetDir}`);
        console.log(`📋 Template: ${options.template}`);
        console.log(`💻 Language: ${options.typescript ? 'TypeScript' : 'JavaScript'}\n`);

        // Create project structure
        await createProjectStructure(targetDir, options);
        
        // Generate configuration files
        await generateConfigFiles(targetDir, projectName, options);
        
        // Generate source files
        await generateSourceFiles(targetDir, options);
        
        // Generate package.json
        await generatePackageJson(targetDir, projectName, options);
        
        // Generate additional files
        if (options.docker) {
            await generateDockerFiles(targetDir);
        }
        
        console.log('✅ Project initialized successfully!\n');
        console.log('📝 Next steps:');
        console.log(`   cd ${path.relative(process.cwd(), targetDir)}`);
        console.log('   npm install');
        console.log('   npm start\n');
        
    } catch (error) {
        console.error('❌ Failed to initialize project:', (error as Error).message);
        process.exit(1);
    }
}

async function createProjectStructure(targetDir: string, options: InitOptions) {
    const dirs = [
        'src',
        'src/adapters',
        'src/config',
        'src/handlers',
        'src/middleware',
        'tests',
        'docs',
        'examples'
    ];
    
    if (options.template === 'enterprise') {
        dirs.push(
            'src/security',
            'src/monitoring',
            'src/migrations',
            'k8s',
            'scripts'
        );
    }
    
    for (const dir of dirs) {
        await fs.mkdir(path.join(targetDir, dir), { recursive: true });
    }
    
    console.log('📂 Created directory structure');
}

async function generateConfigFiles(targetDir: string, projectName: string, options: InitOptions) {
    const ext = options.typescript ? 'ts' : 'js';
    
    // Hook Engine configuration
    const configContent = `${options.typescript ? 'import { HookEngineConfig } from \'hook-engine\';\n\n' : ''}${options.typescript ? 'const' : 'module.exports ='} config${options.typescript ? ': HookEngineConfig' : ''} = {
  adapters: {
    github: {
      secret: process.env.GITHUB_WEBHOOK_SECRET || 'your-github-secret',
      events: ['push', 'pull_request', 'issues']
    }
  },
  storage: {
    type: 'sqlite',
    config: {
      database: './webhooks.db'
    }
  },
  retry: {
    maxAttempts: 3,
    baseDelay: 1000,
    maxDelay: 30000
  },
  observability: {
    logging: {
      level: 'info',
      format: 'json'
    }
  }
};

${options.typescript ? 'export default config;' : ''}`;

    await fs.writeFile(
        path.join(targetDir, `src/config/hook-engine.config.${ext}`),
        configContent
    );
    
    // Environment file
    const envContent = `# Hook Engine Configuration
NODE_ENV=development
PORT=3000
LOG_LEVEL=info

# Webhook Secrets
GITHUB_WEBHOOK_SECRET=your-github-secret-here
STRIPE_WEBHOOK_SECRET=your-stripe-secret-here

# Database
DATABASE_URL=sqlite:./webhooks.db

# Security
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW=60000

# Monitoring
METRICS_PORT=9090
HEALTH_CHECK_PORT=8080`;

    await fs.writeFile(path.join(targetDir, '.env.example'), envContent);
    
    console.log('⚙️  Generated configuration files');
}

async function generateSourceFiles(targetDir: string, options: InitOptions) {
    const ext = options.typescript ? 'ts' : 'js';
    
    // Main application file
    const mainContent = `${options.typescript ? 'import { HookEngine } from \'hook-engine\';\nimport config from \'./config/hook-engine.config\';\n\n' : 'const { HookEngine } = require(\'hook-engine\');\nconst config = require(\'./config/hook-engine.config\');\n\n'}async function main() {
  const engine = new HookEngine(config);
  
  // Register webhook handlers
  engine.on('github:push', async (event) => {
    console.log('Received push event:', event.repository.name);
    // Handle push event
  });
  
  engine.on('github:pull_request', async (event) => {
    console.log('Received PR event:', event.action);
    // Handle pull request event
  });
  
  // Start the engine
  await engine.start();
  console.log('🚀 Hook Engine started successfully!');
}

main().catch(console.error);`;

    await fs.writeFile(
        path.join(targetDir, `src/index.${ext}`),
        mainContent
    );
    
    // Sample webhook handler
    const handlerContent = `${options.typescript ? 'import { WebhookEvent } from \'hook-engine\';\n\n' : ''}${options.typescript ? 'export ' : ''}async function handleGitHubPush(event${options.typescript ? ': WebhookEvent' : ''}) {
  console.log(\`Push to \${event.repository.name} by \${event.pusher.name}\`);
  
  // Example: Send notification to Slack
  // await sendSlackNotification({
  //   text: \`New push to \${event.repository.name}\`,
  //   channel: '#deployments'
  // });
  
  // Example: Trigger CI/CD pipeline
  // await triggerBuild(event.repository.name, event.after);
}

${options.typescript ? 'export ' : ''}async function handlePullRequest(event${options.typescript ? ': WebhookEvent' : ''}) {
  console.log(\`PR \${event.action}: \${event.pull_request.title}\`);
  
  // Example: Run automated tests
  // if (event.action === 'opened' || event.action === 'synchronize') {
  //   await runTests(event.pull_request.head.sha);
  // }
}

${options.typescript ? '' : 'module.exports = { handleGitHubPush, handlePullRequest };'}`;

    await fs.writeFile(
        path.join(targetDir, `src/handlers/github.${ext}`),
        handlerContent
    );
    
    console.log('📄 Generated source files');
}

async function generatePackageJson(targetDir: string, projectName: string, options: InitOptions) {
    const packageJson = {
        name: projectName,
        version: '1.0.0',
        description: 'Hook Engine webhook processing application',
        main: options.typescript ? 'dist/index.js' : 'src/index.js',
        scripts: {
            start: options.typescript ? 'node dist/index.js' : 'node src/index.js',
            dev: options.typescript ? 'ts-node src/index.ts' : 'nodemon src/index.js',
            build: options.typescript ? 'tsc' : 'echo "No build step required"',
            test: 'jest',
            lint: options.typescript ? 'eslint src/**/*.ts' : 'eslint src/**/*.js',
            'hook-engine': 'hook-engine'
        },
        dependencies: {
            'hook-engine': '^1.0.0',
            'dotenv': '^16.0.0'
        },
        devDependencies: {
            'jest': '^29.0.0',
            'nodemon': '^2.0.0'
        },
        keywords: ['webhook', 'hook-engine', 'automation'],
        author: '',
        license: 'MIT'
    };
    
    if (options.typescript) {
        packageJson.devDependencies = {
            ...packageJson.devDependencies,
            'typescript': '^5.0.0',
            'ts-node': '^10.0.0',
            '@types/node': '^20.0.0',
            '@typescript-eslint/eslint-plugin': '^6.0.0',
            '@typescript-eslint/parser': '^6.0.0'
        } as any;
    }
    
    await fs.writeFile(
        path.join(targetDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
    );
    
    // TypeScript configuration
    if (options.typescript) {
        const tsConfig = {
            compilerOptions: {
                target: 'ES2020',
                module: 'commonjs',
                lib: ['ES2020'],
                outDir: './dist',
                rootDir: './src',
                strict: true,
                esModuleInterop: true,
                skipLibCheck: true,
                forceConsistentCasingInFileNames: true,
                resolveJsonModule: true,
                declaration: true,
                declarationMap: true,
                sourceMap: true
            },
            include: ['src/**/*'],
            exclude: ['node_modules', 'dist', 'tests']
        };
        
        await fs.writeFile(
            path.join(targetDir, 'tsconfig.json'),
            JSON.stringify(tsConfig, null, 2)
        );
    }
    
    console.log('📦 Generated package.json');
}

async function generateDockerFiles(targetDir: string) {
    const dockerfile = `FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Build if TypeScript
RUN npm run build 2>/dev/null || true

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \\
  CMD curl -f http://localhost:3000/health || exit 1

# Start application
CMD ["npm", "start"]`;

    await fs.writeFile(path.join(targetDir, 'Dockerfile'), dockerfile);
    
    const dockerCompose = `version: '3.8'

services:
  hook-engine:
    build: .
    ports:
      - "3000:3000"
      - "9090:9090"  # Metrics
    environment:
      - NODE_ENV=production
      - PORT=3000
    volumes:
      - ./data:/app/data
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    restart: unless-stopped

volumes:
  redis_data:`;

    await fs.writeFile(path.join(targetDir, 'docker-compose.yml'), dockerCompose);
    
    const dockerignore = `node_modules
npm-debug.log
dist
.git
.gitignore
README.md
.env
.nyc_output
coverage
.nyc_output
.coverage
.coverage/
.vscode
.idea`;

    await fs.writeFile(path.join(targetDir, '.dockerignore'), dockerignore);
    
    console.log('🐳 Generated Docker files');
} 