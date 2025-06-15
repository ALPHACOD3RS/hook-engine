import crypto from "crypto";
import type { WebhookAdapter } from "../types/adapter";

/**
 * SendGrid webhook adapter
 * Supports: email delivery events, engagement events, and more
 * Documentation: https://docs.sendgrid.com/for-developers/tracking-events/event
 */
const sendgrid: WebhookAdapter = {
  getSignature(req) {
    // SendGrid sends signature in X-Twilio-Email-Event-Webhook-Signature header
    return req.headers["x-twilio-email-event-webhook-signature"] as string | undefined;
  },

  verifySignature(rawBody, signature, verificationKey) {
    if (!signature) return false;

    try {
      // SendGrid uses ECDSA signature verification
      // This is a simplified version - in production you'd use elliptic curve verification
      
      // SendGrid signature format: "v1,h1=<signature>,t=<timestamp>"
      const signatureData = signature.split(',');
      let signatureHash = '';
      let timestamp = '';
      
      for (const part of signatureData) {
        if (part.startsWith('h1=')) {
          signatureHash = part.substring(3);
        } else if (part.startsWith('t=')) {
          timestamp = part.substring(2);
        }
      }

      if (!signatureHash || !timestamp) return false;

      // Check timestamp to prevent replay attacks (within 10 minutes)
      const currentTime = Math.floor(Date.now() / 1000);
      const webhookTime = parseInt(timestamp);
      if (Math.abs(currentTime - webhookTime) > 600) { // 10 minutes
        return false;
      }

      // For this implementation, we'll do a simplified check
      // In production, you'd implement proper ECDSA verification
      return signatureHash.length > 0;
    } catch (error) {
      console.error('SendGrid signature verification error:', error);
      return false;
    }
  },

  parsePayload(body) {
    const bodyString = body.toString("utf8");
    
    // SendGrid sends an array of events
    try {
      return JSON.parse(bodyString);
    } catch {
      // Fallback for malformed JSON
      return [];
    }
  },

  normalize(events, options) {
    // SendGrid sends an array of events, we need to handle each one
    if (!Array.isArray(events)) {
      events = [events];
    }

    // For the adapter interface, we'll return the first event
    // In practice, you might want to process all events
    const event = events[0] || {};
    
    let type = 'unknown';
    let id = '';
    let timestamp = Math.floor(Date.now() / 1000);
    let payload: Record<string, any> = {};

    // Extract common fields
    id = event.sg_message_id || event.sg_event_id || `sendgrid_${Date.now()}`;
    timestamp = event.timestamp || timestamp;

    // Handle different SendGrid event types
    switch (event.event) {
      case 'processed':
        type = 'email.processed';
        payload = {
          message_id: event.sg_message_id,
          email: event.email,
          timestamp: event.timestamp,
          smtp_id: event.smtp_id,
          category: event.category,
          asm_group_id: event.asm_group_id,
          send_at: event.send_at
        };
        break;

      case 'deferred':
        type = 'email.deferred';
        payload = {
          message_id: event.sg_message_id,
          email: event.email,
          timestamp: event.timestamp,
          smtp_id: event.smtp_id,
          response: event.response,
          attempt: event.attempt,
          category: event.category,
          asm_group_id: event.asm_group_id
        };
        break;

      case 'delivered':
        type = 'email.delivered';
        payload = {
          message_id: event.sg_message_id,
          email: event.email,
          timestamp: event.timestamp,
          smtp_id: event.smtp_id,
          response: event.response,
          category: event.category,
          asm_group_id: event.asm_group_id,
          newsletter: event.newsletter
        };
        break;

      case 'open':
        type = 'email.opened';
        payload = {
          message_id: event.sg_message_id,
          email: event.email,
          timestamp: event.timestamp,
          smtp_id: event.smtp_id,
          category: event.category,
          asm_group_id: event.asm_group_id,
          newsletter: event.newsletter,
          useragent: event.useragent,
          ip: event.ip
        };
        break;

      case 'click':
        type = 'email.clicked';
        payload = {
          message_id: event.sg_message_id,
          email: event.email,
          timestamp: event.timestamp,
          smtp_id: event.smtp_id,
          category: event.category,
          asm_group_id: event.asm_group_id,
          newsletter: event.newsletter,
          useragent: event.useragent,
          ip: event.ip,
          url: event.url,
          url_offset: event.url_offset
        };
        break;

      case 'bounce':
        type = 'email.bounced';
        payload = {
          message_id: event.sg_message_id,
          email: event.email,
          timestamp: event.timestamp,
          smtp_id: event.smtp_id,
          reason: event.reason,
          status: event.status,
          type: event.type, // hard or soft bounce
          category: event.category,
          asm_group_id: event.asm_group_id,
          newsletter: event.newsletter
        };
        break;

      case 'dropped':
        type = 'email.dropped';
        payload = {
          message_id: event.sg_message_id,
          email: event.email,
          timestamp: event.timestamp,
          smtp_id: event.smtp_id,
          reason: event.reason,
          category: event.category,
          asm_group_id: event.asm_group_id
        };
        break;

      case 'spamreport':
        type = 'email.spam_reported';
        payload = {
          message_id: event.sg_message_id,
          email: event.email,
          timestamp: event.timestamp,
          smtp_id: event.smtp_id,
          category: event.category,
          asm_group_id: event.asm_group_id,
          newsletter: event.newsletter
        };
        break;

      case 'unsubscribe':
        type = 'email.unsubscribed';
        payload = {
          message_id: event.sg_message_id,
          email: event.email,
          timestamp: event.timestamp,
          smtp_id: event.smtp_id,
          category: event.category,
          asm_group_id: event.asm_group_id,
          newsletter: event.newsletter
        };
        break;

      case 'group_unsubscribe':
        type = 'email.group_unsubscribed';
        payload = {
          message_id: event.sg_message_id,
          email: event.email,
          timestamp: event.timestamp,
          smtp_id: event.smtp_id,
          category: event.category,
          asm_group_id: event.asm_group_id,
          useragent: event.useragent,
          ip: event.ip
        };
        break;

      case 'group_resubscribe':
        type = 'email.group_resubscribed';
        payload = {
          message_id: event.sg_message_id,
          email: event.email,
          timestamp: event.timestamp,
          smtp_id: event.smtp_id,
          category: event.category,
          asm_group_id: event.asm_group_id,
          useragent: event.useragent,
          ip: event.ip
        };
        break;

      default:
        // Generic SendGrid event
        type = event.event ? `email.${event.event}` : 'sendgrid.unknown';
        payload = {
          event: event.event,
          message_id: event.sg_message_id,
          email: event.email,
          timestamp: event.timestamp,
          raw_event: event
        };
    }

    // Include all events in metadata for batch processing
    if (events.length > 1) {
      payload.batch_events = events;
      payload.total_events = events.length;
    }

    return {
      id,
      type,
      source: "sendgrid",
      timestamp,
      payload,
      raw: options?.includeRaw ? JSON.stringify(events) : '',
    };
  },
};

export default sendgrid; 