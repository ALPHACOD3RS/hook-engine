import { 
    EventFilter, 
    EventRoute, 
    EventTransformation, 
    EventDestination 
} from '../types/webhook';
import { 
    ProcessingPipeline, 
    TenantConfig 
} from '../core/event-processor';
import { 
    TenantRateLimit, 
    TenantIsolationConfig, 
    MultiTenantConfig 
} from '../core/multi-tenant-handler';

/**
 * Configuration templates for common webhook processing scenarios
 */

// ============================================================================
// FILTER TEMPLATES
// ============================================================================

export const filterTemplates = {
    /**
     * CI/CD Pipeline Events
     */
    cicd: {
        types: [
            'push',
            'pull_request.opened',
            'pull_request.synchronize',
            'workflow_run.completed',
            'release.published'
        ],
        tags: ['ci-cd', 'automation', 'deployment'],
        priority: ['normal', 'high', 'critical']
    } as EventFilter,

    /**
     * Critical Production Events
     */
    production: {
        types: [
            'push',
            'release.published',
            'workflow_run.completed'
        ],
        tags: ['main-branch', 'deployment', 'production'],
        priority: ['high', 'critical'],
        customFilter: (event) => {
            // Only main/master branch events
            const branch = event.payload.ref?.replace('refs/heads/', '') ||
                          event.payload.pull_request?.head?.ref ||
                          event.payload.workflow_run?.head_branch;
            return branch === 'main' || branch === 'master';
        }
    } as EventFilter,

    /**
     * Security-Related Events
     */
    security: {
        types: [
            'issues.opened',
            'pull_request.opened',
            'workflow_run.completed'
        ],
        tags: ['security', 'vulnerability', 'urgent'],
        priority: ['high', 'critical']
    } as EventFilter,

    /**
     * Development Events (Non-Critical)
     */
    development: {
        types: [
            'push',
            'pull_request.opened',
            'pull_request.synchronize',
            'issues.opened'
        ],
        tags: ['development', 'feature'],
        priority: ['low', 'normal'],
        customFilter: (event) => {
            // Exclude main/master branch
            const branch = event.payload.ref?.replace('refs/heads/', '') ||
                          event.payload.pull_request?.head?.ref;
            return branch !== 'main' && branch !== 'master';
        }
    } as EventFilter,

    /**
     * Team Collaboration Events
     */
    collaboration: {
        types: [
            'pull_request.opened',
            'pull_request.review_requested',
            'issues.opened',
            'issues.assigned'
        ],
        tags: ['collaboration', 'review-needed', 'team']
    } as EventFilter
};

// ============================================================================
// TRANSFORMATION TEMPLATES
// ============================================================================

export const transformationTemplates = {
    /**
     * Slack Message Formatter
     */
    slackFormatter: {
        type: 'javascript',
        script: `
            (events) => events.map(event => ({
                ...event,
                payload: {
                    ...event.payload,
                    slack_message: {
                        text: \`\${event.type} event from \${event.source}\`,
                        blocks: [
                            {
                                type: "section",
                                text: {
                                    type: "mrkdwn",
                                    text: \`*\${event.type}* in \${event.metadata?.repository || 'unknown'}\`
                                }
                            },
                            {
                                type: "context",
                                elements: [
                                    {
                                        type: "mrkdwn",
                                        text: \`Priority: \${event.priority || 'normal'} | Time: \${new Date(event.timestamp * 1000).toISOString()}\`
                                    }
                                ]
                            }
                        ]
                    }
                }
            }))
        `
    } as EventTransformation,

    /**
     * Email Formatter
     */
    emailFormatter: {
        type: 'javascript',
        script: `
            (events) => events.map(event => ({
                ...event,
                payload: {
                    ...event.payload,
                    email: {
                        subject: \`[\${event.source.toUpperCase()}] \${event.type} - \${event.metadata?.repository || 'Repository'}\`,
                        body: \`
                            Event: \${event.type}
                            Source: \${event.source}
                            Repository: \${event.metadata?.repository || 'N/A'}
                            Sender: \${event.metadata?.sender || 'N/A'}
                            Priority: \${event.priority || 'normal'}
                            Time: \${new Date(event.timestamp * 1000).toISOString()}
                            
                            Details:
                            \${JSON.stringify(event.payload, null, 2)}
                        \`,
                        priority: event.priority === 'critical' ? 'high' : 'normal'
                    }
                }
            }))
        `
    } as EventTransformation,

    /**
     * Jira Issue Creator
     */
    jiraFormatter: {
        type: 'javascript',
        script: `
            (events) => events.filter(event => 
                event.type.includes('workflow_run') && 
                event.payload.workflow_run?.conclusion === 'failure'
            ).map(event => ({
                ...event,
                payload: {
                    ...event.payload,
                    jira_issue: {
                        project: "DEVOPS",
                        issuetype: "Bug",
                        summary: \`Build failure in \${event.metadata?.repository}\`,
                        description: \`
                            Workflow: \${event.payload.workflow_run?.name}
                            Branch: \${event.payload.workflow_run?.head_branch}
                            Commit: \${event.payload.workflow_run?.head_sha}
                            URL: \${event.payload.workflow_run?.html_url}
                        \`,
                        priority: event.priority === 'critical' ? 'Highest' : 'High',
                        labels: ['automation', 'ci-cd', 'build-failure']
                    }
                }
            }))
        `
    } as EventTransformation,

    /**
     * Metrics Extractor
     */
    metricsExtractor: {
        type: 'javascript',
        script: `
            (events) => events.map(event => ({
                ...event,
                payload: {
                    ...event.payload,
                    metrics: {
                        event_type: event.type,
                        source: event.source,
                        tenant: event.tenant,
                        priority: event.priority,
                        repository: event.metadata?.repository,
                        branch: event.payload.ref?.replace('refs/heads/', '') || 
                               event.payload.pull_request?.head?.ref ||
                               event.payload.workflow_run?.head_branch,
                        timestamp: event.timestamp,
                        tags: event.tags
                    }
                }
            }))
        `
    } as EventTransformation
};

// ============================================================================
// DESTINATION TEMPLATES
// ============================================================================

export const destinationTemplates = {
    slack: (webhookUrl: string): EventDestination => ({
        type: 'webhook',
        config: {
            url: webhookUrl,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            payloadPath: 'payload.slack_message'
        }
    }),

    discord: (webhookUrl: string): EventDestination => ({
        type: 'webhook',
        config: {
            url: webhookUrl,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            payloadPath: 'payload.discord_message'
        }
    }),

    email: (smtpConfig: any): EventDestination => ({
        type: 'custom',
        config: {
            type: 'email',
            smtp: smtpConfig,
            payloadPath: 'payload.email'
        }
    }),

    jira: (jiraConfig: any): EventDestination => ({
        type: 'custom',
        config: {
            type: 'jira',
            baseUrl: jiraConfig.baseUrl,
            auth: jiraConfig.auth,
            payloadPath: 'payload.jira_issue'
        }
    }),

    database: (connectionString: string, table: string): EventDestination => ({
        type: 'database',
        config: {
            connectionString,
            table,
            columns: {
                id: 'id',
                type: 'type',
                source: 'source',
                timestamp: 'timestamp',
                payload: 'payload',
                tenant: 'tenant'
            }
        }
    }),

    queue: (queueUrl: string): EventDestination => ({
        type: 'queue',
        config: {
            url: queueUrl,
            serializer: 'json'
        }
    })
};

// ============================================================================
// PIPELINE TEMPLATES
// ============================================================================

export const pipelineTemplates = {
    /**
     * CI/CD Pipeline with Slack notifications
     */
    cicdSlack: (slackWebhookUrl: string): ProcessingPipeline => ({
        id: 'cicd-slack',
        name: 'CI/CD Slack Notifications',
        filters: [filterTemplates.cicd],
        transformations: [transformationTemplates.slackFormatter],
        routes: [
            {
                id: 'slack-cicd',
                name: 'Slack CI/CD Channel',
                filter: filterTemplates.cicd,
                destination: destinationTemplates.slack(slackWebhookUrl),
                enabled: true,
                priority: 100
            }
        ],
        enabled: true,
        priority: 100
    }),

    /**
     * Production monitoring with multiple channels
     */
    productionMonitoring: (config: {
        slackUrl: string;
        emailConfig: any;
        jiraConfig: any;
    }): ProcessingPipeline => ({
        id: 'production-monitoring',
        name: 'Production Event Monitoring',
        filters: [filterTemplates.production],
        transformations: [
            transformationTemplates.slackFormatter,
            transformationTemplates.emailFormatter,
            transformationTemplates.jiraFormatter
        ],
        routes: [
            {
                id: 'slack-production',
                name: 'Slack Production Alerts',
                filter: filterTemplates.production,
                destination: destinationTemplates.slack(config.slackUrl),
                enabled: true,
                priority: 200
            },
            {
                id: 'email-critical',
                name: 'Email Critical Alerts',
                filter: { ...filterTemplates.production, priority: ['critical'] },
                destination: destinationTemplates.email(config.emailConfig),
                enabled: true,
                priority: 300
            },
            {
                id: 'jira-failures',
                name: 'Jira Build Failures',
                filter: { 
                    types: ['workflow_run.completed'],
                    customFilter: (event) => event.payload.workflow_run?.conclusion === 'failure'
                },
                destination: destinationTemplates.jira(config.jiraConfig),
                enabled: true,
                priority: 150
            }
        ],
        enabled: true,
        priority: 200
    }),

    /**
     * Security event pipeline
     */
    securityPipeline: (config: {
        slackUrl: string;
        emailConfig: any;
    }): ProcessingPipeline => ({
        id: 'security-pipeline',
        name: 'Security Event Processing',
        filters: [filterTemplates.security],
        transformations: [
            transformationTemplates.slackFormatter,
            transformationTemplates.emailFormatter
        ],
        routes: [
            {
                id: 'slack-security',
                name: 'Slack Security Channel',
                filter: filterTemplates.security,
                destination: destinationTemplates.slack(config.slackUrl),
                enabled: true,
                priority: 300
            },
            {
                id: 'email-security',
                name: 'Email Security Team',
                filter: filterTemplates.security,
                destination: destinationTemplates.email(config.emailConfig),
                enabled: true,
                priority: 400
            }
        ],
        enabled: true,
        priority: 300
    }),

    /**
     * Development team collaboration
     */
    teamCollaboration: (slackWebhookUrl: string): ProcessingPipeline => ({
        id: 'team-collaboration',
        name: 'Team Collaboration Events',
        filters: [filterTemplates.collaboration],
        transformations: [transformationTemplates.slackFormatter],
        routes: [
            {
                id: 'slack-team',
                name: 'Slack Team Channel',
                filter: filterTemplates.collaboration,
                destination: destinationTemplates.slack(slackWebhookUrl),
                enabled: true,
                priority: 50
            }
        ],
        enabled: true,
        priority: 50
    })
};

// ============================================================================
// TENANT TEMPLATES
// ============================================================================

export const tenantTemplates = {
    /**
     * Startup tenant (lower limits)
     */
    startup: (tenantId: string, customPipelines: ProcessingPipeline[] = []): TenantConfig => ({
        tenantId,
        pipelines: [
            pipelineTemplates.teamCollaboration(`https://hooks.slack.com/services/${tenantId}/team`),
            ...customPipelines
        ],
        rateLimits: {
            eventsPerSecond: 10,
            burstSize: 50,
            windowSize: 1000
        },
        allowedSources: ['github', 'gitlab', 'bitbucket']
    }),

    /**
     * Enterprise tenant (higher limits)
     */
    enterprise: (tenantId: string, customPipelines: ProcessingPipeline[] = []): TenantConfig => ({
        tenantId,
        pipelines: [
            pipelineTemplates.cicdSlack(`https://hooks.slack.com/services/${tenantId}/cicd`),
            pipelineTemplates.productionMonitoring({
                slackUrl: `https://hooks.slack.com/services/${tenantId}/production`,
                emailConfig: { /* tenant-specific email config */ },
                jiraConfig: { /* tenant-specific jira config */ }
            }),
            pipelineTemplates.securityPipeline({
                slackUrl: `https://hooks.slack.com/services/${tenantId}/security`,
                emailConfig: { /* tenant-specific email config */ }
            }),
            ...customPipelines
        ],
        rateLimits: {
            eventsPerSecond: 100,
            burstSize: 500,
            windowSize: 1000
        },
        allowedSources: ['github', 'gitlab', 'bitbucket', 'jenkins', 'circleci']
    }),

    /**
     * Development tenant (relaxed limits for testing)
     */
    development: (tenantId: string, customPipelines: ProcessingPipeline[] = []): TenantConfig => ({
        tenantId,
        pipelines: [
            pipelineTemplates.teamCollaboration(`https://hooks.slack.com/services/${tenantId}/dev`),
            ...customPipelines
        ],
        rateLimits: {
            eventsPerSecond: 50,
            burstSize: 200,
            windowSize: 1000
        }
    })
};

// ============================================================================
// MULTI-TENANT CONFIGURATION TEMPLATES
// ============================================================================

export const multiTenantTemplates = {
    /**
     * Basic multi-tenant setup
     */
    basic: (): MultiTenantConfig => ({
        defaultRateLimit: {
            eventsPerSecond: 20,
            burstSize: 100,
            windowSize: 1000
        },
        defaultIsolation: {
            enableResourceIsolation: true,
            maxMemoryPerTenant: 50, // 50MB
            maxConcurrentEvents: 25,
            enableNetworkIsolation: false
        },
        enableTenantMetrics: true,
        enableGlobalRateLimit: false
    }),

    /**
     * High-performance multi-tenant setup
     */
    highPerformance: (): MultiTenantConfig => ({
        defaultRateLimit: {
            eventsPerSecond: 100,
            burstSize: 500,
            windowSize: 1000
        },
        defaultIsolation: {
            enableResourceIsolation: true,
            maxMemoryPerTenant: 200, // 200MB
            maxConcurrentEvents: 100,
            enableNetworkIsolation: false
        },
        enableTenantMetrics: true,
        enableGlobalRateLimit: true,
        globalRateLimit: {
            eventsPerSecond: 1000,
            burstSize: 2000,
            windowSize: 1000
        }
    }),

    /**
     * Secure multi-tenant setup
     */
    secure: (): MultiTenantConfig => ({
        defaultRateLimit: {
            eventsPerSecond: 50,
            burstSize: 200,
            windowSize: 1000
        },
        defaultIsolation: {
            enableResourceIsolation: true,
            maxMemoryPerTenant: 100, // 100MB
            maxConcurrentEvents: 50,
            enableNetworkIsolation: true,
            allowedDomains: ['*.company.com', 'api.github.com'],
            blockedDomains: ['*.suspicious.com']
        },
        enableTenantMetrics: true,
        enableGlobalRateLimit: true,
        globalRateLimit: {
            eventsPerSecond: 500,
            burstSize: 1000,
            windowSize: 1000
        }
    })
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Create a custom pipeline from template
 */
export function createCustomPipeline(
    id: string,
    name: string,
    filters: EventFilter[],
    transformations: EventTransformation[],
    routes: EventRoute[],
    options: { enabled?: boolean; priority?: number } = {}
): ProcessingPipeline {
    return {
        id,
        name,
        filters,
        transformations,
        routes,
        enabled: options.enabled ?? true,
        priority: options.priority ?? 100
    };
}

/**
 * Merge multiple filters with AND logic
 */
export function mergeFilters(...filters: EventFilter[]): EventFilter {
    const merged: EventFilter = {};
    
    filters.forEach(filter => {
        if (filter.types) {
            merged.types = merged.types ? 
                merged.types.filter(t => filter.types!.includes(t)) : 
                filter.types;
        }
        if (filter.sources) {
            merged.sources = merged.sources ? 
                merged.sources.filter(s => filter.sources!.includes(s)) : 
                filter.sources;
        }
        if (filter.tenants) {
            merged.tenants = merged.tenants ? 
                merged.tenants.filter(t => filter.tenants!.includes(t)) : 
                filter.tenants;
        }
        if (filter.tags) {
            merged.tags = merged.tags ? 
                [...merged.tags, ...filter.tags] : 
                filter.tags;
        }
        if (filter.priority) {
            merged.priority = merged.priority ? 
                merged.priority.filter(p => filter.priority!.includes(p)) : 
                filter.priority;
        }
    });
    
    return merged;
} 