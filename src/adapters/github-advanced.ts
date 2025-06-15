import crypto from "crypto";
import { v4 as uuidv4 } from 'uuid';
import { BaseAdvancedAdapter } from './base-advanced';
import { 
    NormalizationOptions, 
    BatchNormalizationOptions, 
    BatchProcessingOptions 
} from '../types/adapter';
import { 
    WebhookEvent, 
    BatchWebhookEvent, 
    EventFilter, 
    EventRoute 
} from '../types/webhook';

/**
 * Advanced GitHub webhook adapter with batch processing, filtering, routing, and multi-tenancy
 * Supports all GitHub webhook events with advanced processing capabilities
 */
export class GitHubAdvancedAdapter extends BaseAdvancedAdapter {
    
    getSignature(req: any): string | undefined {
        return req.headers["x-hub-signature-256"] || req.headers["x-hub-signature"] as string | undefined;
    }

    verifySignature(rawBody: Buffer, sigHeader: string, secret: string): boolean {
        if (!sigHeader) return false;

        try {
            let signature: string;
            let algorithm: string;

            if (sigHeader.startsWith('sha256=')) {
                algorithm = 'sha256';
                signature = sigHeader.slice(7);
            } else if (sigHeader.startsWith('sha1=')) {
                algorithm = 'sha1';
                signature = sigHeader.slice(5);
            } else {
                return false;
            }

            const expected = crypto
                .createHmac(algorithm, secret)
                .update(rawBody)
                .digest("hex");

            return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
        } catch (error) {
            console.error('GitHub signature verification error:', error);
            return false;
        }
    }

    parsePayload(body: Buffer): any {
        return JSON.parse(body.toString("utf8"));
    }

    /**
     * Parse batch payload - GitHub doesn't natively support batches, 
     * but we can handle arrays of events
     */
    parseBatchPayload(rawBody: Buffer): any[] {
        try {
            const parsed = JSON.parse(rawBody.toString());
            // GitHub sends individual events, but we can handle arrays for testing/custom scenarios
            return Array.isArray(parsed) ? parsed : [parsed];
        } catch (error) {
            throw new Error(`Failed to parse GitHub batch payload: ${(error as Error).message}`);
        }
    }

    normalize(event: any, options?: NormalizationOptions): WebhookEvent {
        const action = event.action || 'unknown';
        
        let type = 'unknown';
        let id = '';
        let timestamp = Math.floor(Date.now() / 1000);
        let payload: Record<string, any> = {};
        let priority: 'low' | 'normal' | 'high' | 'critical' = 'normal';
        let tags: string[] = [];

        // Handle different GitHub event types with enhanced metadata
        if (event.zen) {
            type = 'ping';
            id = `ping_${event.hook_id || Date.now()}`;
            payload = { zen: event.zen, hook_id: event.hook_id };
            priority = 'low';
            tags = ['system', 'ping'];
        } else if (event.commits) {
            type = 'push';
            id = event.head_commit?.id || event.after || `push_${Date.now()}`;
            timestamp = event.head_commit?.timestamp ? 
                Math.floor(new Date(event.head_commit.timestamp).getTime() / 1000) : 
                timestamp;
            payload = {
                ref: event.ref,
                before: event.before,
                after: event.after,
                commits: event.commits,
                head_commit: event.head_commit,
                repository: event.repository,
                pusher: event.pusher,
                sender: event.sender,
                forced: event.forced,
                created: event.created,
                deleted: event.deleted
            };
            
            // Set priority based on branch and commit count
            if (event.ref === 'refs/heads/main' || event.ref === 'refs/heads/master') {
                priority = 'high';
                tags.push('main-branch');
            }
            if (event.commits && event.commits.length > 10) {
                priority = 'high';
                tags.push('large-push');
            }
            if (event.forced) {
                priority = 'critical';
                tags.push('force-push');
            }
            tags.push('code-change', 'git');
            
        } else if (event.pull_request) {
            type = `pull_request.${action}`;
            id = `pr_${event.pull_request.id}_${action}`;
            timestamp = Math.floor(new Date(event.pull_request.updated_at).getTime() / 1000);
            payload = {
                action,
                number: event.pull_request.number,
                pull_request: event.pull_request,
                repository: event.repository,
                sender: event.sender,
                changes: event.changes
            };
            
            // Set priority based on PR state and labels
            if (action === 'opened' || action === 'ready_for_review') {
                priority = 'high';
                tags.push('review-needed');
            }
            if (event.pull_request.draft) {
                priority = 'low';
                tags.push('draft');
            }
            if (event.pull_request.labels?.some((label: any) => 
                ['urgent', 'critical', 'hotfix'].includes(label.name.toLowerCase()))) {
                priority = 'critical';
                tags.push('urgent');
            }
            tags.push('pull-request', 'code-review');
            
        } else if (event.issue) {
            type = `issues.${action}`;
            id = `issue_${event.issue.id}_${action}`;
            timestamp = Math.floor(new Date(event.issue.updated_at).getTime() / 1000);
            payload = {
                action,
                issue: event.issue,
                repository: event.repository,
                sender: event.sender,
                assignee: event.assignee,
                label: event.label,
                changes: event.changes
            };
            
            // Set priority based on issue labels and state
            if (event.issue.labels?.some((label: any) => 
                ['bug', 'critical', 'urgent'].includes(label.name.toLowerCase()))) {
                priority = 'high';
                tags.push('bug');
            }
            if (event.issue.labels?.some((label: any) => 
                ['security', 'vulnerability'].includes(label.name.toLowerCase()))) {
                priority = 'critical';
                tags.push('security');
            }
            tags.push('issue', 'project-management');
            
        } else if (event.workflow_run) {
            type = `workflow_run.${action}`;
            id = `workflow_${event.workflow_run.id}_${action}`;
            timestamp = Math.floor(new Date(event.workflow_run.updated_at).getTime() / 1000);
            payload = {
                action,
                workflow_run: event.workflow_run,
                repository: event.repository,
                sender: event.sender
            };
            
            // Set priority based on workflow status and branch
            if (event.workflow_run.conclusion === 'failure') {
                priority = 'high';
                tags.push('build-failure');
            }
            if (event.workflow_run.head_branch === 'main' || event.workflow_run.head_branch === 'master') {
                priority = 'high';
                tags.push('main-branch');
            }
            tags.push('ci-cd', 'automation');
            
        } else if (event.release) {
            type = `release.${action}`;
            id = `release_${event.release.id}_${action}`;
            timestamp = Math.floor(new Date(event.release.published_at || event.release.created_at).getTime() / 1000);
            payload = {
                action,
                release: event.release,
                repository: event.repository,
                sender: event.sender
            };
            
            if (action === 'published') {
                priority = 'high';
                tags.push('deployment');
            }
            if (event.release.prerelease) {
                tags.push('prerelease');
            } else {
                tags.push('stable-release');
            }
            tags.push('release', 'versioning');
            
        } else {
            // Generic fallback with basic categorization
            type = action ? `${this.getEventCategory(event)}.${action}` : 'unknown';
            id = `github_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            payload = event;
            tags.push('generic');
        }

        // Extract tenant information
        let tenant = options?.tenant;
        if (!tenant) {
            tenant = this.extractTenant(event);
        }

        return {
            id,
            type,
            source: "github",
            timestamp,
            payload,
            tenant,
            priority: options?.priority || priority,
            tags: [...(options?.tags || []), ...tags],
            metadata: {
                ...options?.metadata,
                repository: event.repository?.full_name,
                sender: event.sender?.login,
                action
            },
            raw: options?.includeRaw ? JSON.stringify(event) : ''
        };
    }

    /**
     * Extract tenant from GitHub event
     */
    extractTenant(event: any, req?: any): string | undefined {
        // Try organization first
        if (event.organization?.login) {
            return event.organization.login;
        }
        
        // Try repository owner
        if (event.repository?.owner?.login) {
            return event.repository.owner.login;
        }
        
        // Try installation (for GitHub Apps)
        if (event.installation?.account?.login) {
            return event.installation.account.login;
        }
        
        // Try sender as fallback
        if (event.sender?.login) {
            return event.sender.login;
        }
        
        return super.extractTenant(event, req);
    }

    /**
     * Validate tenant access for GitHub events
     */
    validateTenant(tenant: string, event: WebhookEvent): boolean {
        // GitHub-specific tenant validation
        const repoOwner = event.metadata?.repository?.split('/')[0];
        const organization = event.payload.organization?.login;
        
        // Tenant must match repository owner or organization
        return tenant === repoOwner || 
               tenant === organization || 
               super.validateTenant(tenant, event);
    }

    /**
     * GitHub-specific event filtering with repository and organization awareness
     */
    filterEvents(events: WebhookEvent[], filter: EventFilter): WebhookEvent[] {
        let filteredEvents = super.filterEvents(events, filter);
        
        // Additional GitHub-specific filters
        if ((filter as any).repositories) {
            filteredEvents = filteredEvents.filter(event => {
                const repo = event.metadata?.repository;
                return repo && (filter as any).repositories.includes(repo);
            });
        }
        
        if ((filter as any).organizations) {
            filteredEvents = filteredEvents.filter(event => {
                const org = event.payload.organization?.login || 
                           event.metadata?.repository?.split('/')[0];
                return org && (filter as any).organizations.includes(org);
            });
        }
        
        if ((filter as any).branches) {
            filteredEvents = filteredEvents.filter(event => {
                const branch = event.payload.ref?.replace('refs/heads/', '') ||
                              event.payload.pull_request?.head?.ref ||
                              event.payload.workflow_run?.head_branch;
                return branch && (filter as any).branches.includes(branch);
            });
        }
        
        return filteredEvents;
    }

    /**
     * GitHub-specific event routing with smart defaults
     */
    routeEvent(event: WebhookEvent, routes: EventRoute[]): EventRoute[] {
        const matchingRoutes = super.routeEvent(event, routes);
        
        // Add GitHub-specific routing logic
        const enhancedRoutes = matchingRoutes.map(route => {
            // Add GitHub context to route metadata
            const githubContext = {
                repository: event.metadata?.repository,
                organization: event.payload.organization?.login,
                sender: event.metadata?.sender,
                branch: this.extractBranch(event),
                isMainBranch: this.isMainBranch(event),
                isCritical: event.priority === 'critical'
            };
            
            return {
                ...route,
                metadata: {
                    ...route.metadata,
                    github: githubContext
                }
            };
        });
        
        return enhancedRoutes;
    }

    /**
     * Process GitHub event with repository-specific logic
     */
    protected async processEvent(event: WebhookEvent, timeout: number): Promise<void> {
        // GitHub-specific processing logic
        const startTime = Date.now();
        
        try {
            // Simulate repository-specific processing
            if (event.type.startsWith('push')) {
                await this.processPushEvent(event);
            } else if (event.type.startsWith('pull_request')) {
                await this.processPullRequestEvent(event);
            } else if (event.type.startsWith('workflow_run')) {
                await this.processWorkflowEvent(event);
            } else {
                await super.processEvent(event, timeout);
            }
            
        } catch (error) {
            console.error(`GitHub event processing failed for ${event.id}:`, error);
            throw error;
        }
    }

    /**
     * Process push events with commit analysis
     */
    private async processPushEvent(event: WebhookEvent): Promise<void> {
        // Simulate commit analysis
        const commits = event.payload.commits || [];
        const analysisTime = Math.min(commits.length * 10, 100); // Max 100ms
        await new Promise(resolve => setTimeout(resolve, analysisTime));
    }

    /**
     * Process pull request events with review analysis
     */
    private async processPullRequestEvent(event: WebhookEvent): Promise<void> {
        // Simulate PR analysis
        const changedFiles = event.payload.pull_request?.changed_files || 1;
        const analysisTime = Math.min(changedFiles * 5, 50); // Max 50ms
        await new Promise(resolve => setTimeout(resolve, analysisTime));
    }

    /**
     * Process workflow events with build analysis
     */
    private async processWorkflowEvent(event: WebhookEvent): Promise<void> {
        // Simulate workflow analysis
        const duration = event.payload.workflow_run?.run_duration_ms || 1000;
        const analysisTime = Math.min(duration / 100, 30); // Max 30ms
        await new Promise(resolve => setTimeout(resolve, analysisTime));
    }

    /**
     * Get event category for unknown events
     */
    private getEventCategory(event: any): string {
        if (event.check_run || event.check_suite) return 'check';
        if (event.deployment) return 'deployment';
        if (event.star) return 'star';
        if (event.fork) return 'fork';
        if (event.member) return 'member';
        if (event.organization) return 'organization';
        return 'unknown';
    }

    /**
     * Extract branch from event
     */
    private extractBranch(event: WebhookEvent): string | undefined {
        return event.payload.ref?.replace('refs/heads/', '') ||
               event.payload.pull_request?.head?.ref ||
               event.payload.workflow_run?.head_branch;
    }

    /**
     * Check if event is from main branch
     */
    private isMainBranch(event: WebhookEvent): boolean {
        const branch = this.extractBranch(event);
        return branch === 'main' || branch === 'master';
    }
}

// Create and export the advanced GitHub adapter instance
const githubAdvanced = new GitHubAdvancedAdapter();
export default githubAdvanced;