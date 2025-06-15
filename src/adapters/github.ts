import crypto from "crypto";
import type { WebhookAdapter } from "../types/adapter";

/**
 * GitHub webhook adapter
 * Supports: push, pull_request, issues, releases, workflow_run, and more
 * Documentation: https://docs.github.com/en/developers/webhooks-and-events/webhooks
 */
const github: WebhookAdapter = {
  getSignature(req) {
    // GitHub sends signature in X-Hub-Signature-256 header (preferred) or X-Hub-Signature (legacy)
    return req.headers["x-hub-signature-256"] || req.headers["x-hub-signature"] as string | undefined;
  },

  verifySignature(rawBody, sigHeader, secret) {
    if (!sigHeader) return false;

    try {
      let signature: string;
      let algorithm: string;

      if (sigHeader.startsWith('sha256=')) {
        // Modern GitHub signature format
        algorithm = 'sha256';
        signature = sigHeader.slice(7);
      } else if (sigHeader.startsWith('sha1=')) {
        // Legacy GitHub signature format
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
  },

  parsePayload(body) {
    return JSON.parse(body.toString("utf8"));
  },

  normalize(event, options) {
    // Extract common fields
    const action = event.action || 'unknown';
    const eventType = event.zen ? 'ping' : (event.hook_id ? 'ping' : 'unknown');
    
    // Determine event type from webhook event structure
    let type = 'unknown';
    let id = '';
    let timestamp = Math.floor(Date.now() / 1000);
    let payload: Record<string, any> = {};

    // Handle different GitHub event types
    if (event.zen) {
      // Ping event
      type = 'ping';
      id = `ping_${event.hook_id || Date.now()}`;
      payload = { zen: event.zen, hook_id: event.hook_id };
    } else if (event.commits) {
      // Push event
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
    } else if (event.pull_request) {
      // Pull request event
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
    } else if (event.issue) {
      // Issue event
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
    } else if (event.release) {
      // Release event
      type = `release.${action}`;
      id = `release_${event.release.id}_${action}`;
      timestamp = Math.floor(new Date(event.release.published_at || event.release.created_at).getTime() / 1000);
      payload = {
        action,
        release: event.release,
        repository: event.repository,
        sender: event.sender
      };
    } else if (event.workflow_run) {
      // GitHub Actions workflow run
      type = `workflow_run.${action}`;
      id = `workflow_${event.workflow_run.id}_${action}`;
      timestamp = Math.floor(new Date(event.workflow_run.updated_at).getTime() / 1000);
      payload = {
        action,
        workflow_run: event.workflow_run,
        repository: event.repository,
        sender: event.sender
      };
    } else if (event.deployment) {
      // Deployment event
      type = `deployment.${action || 'created'}`;
      id = `deployment_${event.deployment.id}`;
      timestamp = Math.floor(new Date(event.deployment.updated_at).getTime() / 1000);
      payload = {
        action: action || 'created',
        deployment: event.deployment,
        repository: event.repository,
        sender: event.sender
      };
    } else if (event.check_run) {
      // Check run event
      type = `check_run.${action}`;
      id = `check_run_${event.check_run.id}_${action}`;
      timestamp = Math.floor(new Date(event.check_run.completed_at || event.check_run.started_at).getTime() / 1000);
      payload = {
        action,
        check_run: event.check_run,
        repository: event.repository,
        sender: event.sender
      };
    } else if (event.check_suite) {
      // Check suite event
      type = `check_suite.${action}`;
      id = `check_suite_${event.check_suite.id}_${action}`;
      timestamp = Math.floor(new Date(event.check_suite.updated_at).getTime() / 1000);
      payload = {
        action,
        check_suite: event.check_suite,
        repository: event.repository,
        sender: event.sender
      };
    } else if (event.star) {
      // Star event
      type = `star.${action}`;
      id = `star_${event.repository.id}_${event.sender.id}_${action}`;
      payload = {
        action,
        starred_at: event.starred_at,
        repository: event.repository,
        sender: event.sender
      };
    } else if (event.fork) {
      // Fork event
      type = 'fork';
      id = `fork_${event.forkee.id}`;
      timestamp = Math.floor(new Date(event.forkee.created_at).getTime() / 1000);
      payload = {
        forkee: event.forkee,
        repository: event.repository,
        sender: event.sender
      };
    } else if (event.member) {
      // Member event (collaborator added/removed)
      type = `member.${action}`;
      id = `member_${event.member.id}_${action}`;
      payload = {
        action,
        member: event.member,
        repository: event.repository,
        sender: event.sender
      };
    } else if (event.organization) {
      // Organization event
      type = `organization.${action}`;
      id = `org_${event.organization.id}_${action}`;
      payload = {
        action,
        organization: event.organization,
        sender: event.sender,
        membership: event.membership
      };
    } else {
      // Generic fallback for unknown events
      type = action ? `unknown.${action}` : 'unknown';
      id = `github_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      payload = event;
    }

    return {
      id,
      type,
      source: "github",
      timestamp,
      payload,
      raw: options?.includeRaw ? JSON.stringify(event) : '',
    };
  },
};

export default github;

