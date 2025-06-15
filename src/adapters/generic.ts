import crypto from "crypto";
import type { WebhookAdapter } from "../types/adapter";

/**
 * Generic webhook adapter configuration
 */
export interface GenericAdapterConfig {
  signatureHeader?: string;
  signatureAlgorithm?: 'sha256' | 'sha1' | 'md5';
  signatureEncoding?: 'hex' | 'base64';
  signaturePrefix?: string;
  timestampHeader?: string;
  timestampValidationWindow?: number; // seconds
  payloadFormat?: 'json' | 'form' | 'raw';
  eventTypeField?: string;
  eventIdField?: string;
  timestampField?: string;
}

/**
 * Generic webhook adapter
 * Supports: custom webhook formats with configurable signature verification
 * Use this for any webhook provider not specifically supported
 */
export function createGenericAdapter(config: GenericAdapterConfig = {}): WebhookAdapter {
  const {
    signatureHeader = 'x-signature',
    signatureAlgorithm = 'sha256',
    signatureEncoding = 'hex',
    signaturePrefix = '',
    timestampHeader = 'x-timestamp',
    timestampValidationWindow = 300, // 5 minutes
    payloadFormat = 'json',
    eventTypeField = 'event',
    eventIdField = 'id',
    timestampField = 'timestamp'
  } = config;

  return {
    getSignature(req) {
      return req.headers[signatureHeader.toLowerCase()] as string | undefined;
    },

    verifySignature(rawBody, signature, secret) {
      if (!signature) return false;

      try {
        // Remove prefix if specified
        let cleanSignature = signature;
        if (signaturePrefix && signature.startsWith(signaturePrefix)) {
          cleanSignature = signature.slice(signaturePrefix.length);
        }

        // Generate expected signature
        const hmac = crypto.createHmac(signatureAlgorithm, secret);
        hmac.update(rawBody);
        const expected = hmac.digest(signatureEncoding);

        // Compare signatures
        return crypto.timingSafeEqual(
          Buffer.from(expected),
          Buffer.from(cleanSignature)
        );
      } catch (error) {
        console.error('Generic adapter signature verification error:', error);
        return false;
      }
    },

    parsePayload(body) {
      const bodyString = body.toString("utf8");
      
      switch (payloadFormat) {
        case 'json':
          try {
            return JSON.parse(bodyString);
          } catch {
            throw new Error('Invalid JSON payload');
          }
        
        case 'form':
          const params: Record<string, any> = {};
          const pairs = bodyString.split('&');
          
          for (const pair of pairs) {
            const [key, value] = pair.split('=');
            if (key && value !== undefined) {
              params[decodeURIComponent(key)] = decodeURIComponent(value);
            }
          }
          
          return params;
        
        case 'raw':
          return { rawData: bodyString };
        
        default:
          throw new Error(`Unsupported payload format: ${payloadFormat}`);
      }
    },

    normalize(event, options) {
      let type = 'unknown';
      let id = '';
      let timestamp = Math.floor(Date.now() / 1000);
      let payload: Record<string, any> = {};

      // Extract event type
      if (eventTypeField && event[eventTypeField]) {
        type = `generic.${event[eventTypeField]}`;
      } else if (event.type) {
        type = `generic.${event.type}`;
      } else if (event.event_type) {
        type = `generic.${event.event_type}`;
      } else {
        type = 'generic.unknown';
      }

      // Extract event ID
      if (eventIdField && event[eventIdField]) {
        id = event[eventIdField].toString();
      } else if (event.id) {
        id = event.id.toString();
      } else if (event.event_id) {
        id = event.event_id.toString();
      } else if (event.uuid) {
        id = event.uuid.toString();
      } else {
        id = `generic_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      }

      // Extract timestamp
      if (timestampField && event[timestampField]) {
        const ts = event[timestampField];
        if (typeof ts === 'number') {
          // Assume Unix timestamp
          timestamp = ts > 1e10 ? Math.floor(ts / 1000) : ts;
        } else if (typeof ts === 'string') {
          // Try to parse as ISO date
          const parsed = new Date(ts);
          if (!isNaN(parsed.getTime())) {
            timestamp = Math.floor(parsed.getTime() / 1000);
          }
        }
      } else if (event.timestamp) {
        const ts = event.timestamp;
        if (typeof ts === 'number') {
          timestamp = ts > 1e10 ? Math.floor(ts / 1000) : ts;
        } else if (typeof ts === 'string') {
          const parsed = new Date(ts);
          if (!isNaN(parsed.getTime())) {
            timestamp = Math.floor(parsed.getTime() / 1000);
          }
        }
      } else if (event.created_at) {
        const parsed = new Date(event.created_at);
        if (!isNaN(parsed.getTime())) {
          timestamp = Math.floor(parsed.getTime() / 1000);
        }
      } else if (event.occurred_at) {
        const parsed = new Date(event.occurred_at);
        if (!isNaN(parsed.getTime())) {
          timestamp = Math.floor(parsed.getTime() / 1000);
        }
      }

      // Use the entire event as payload, but clean up some fields
      payload = { ...event };
      
      // Remove fields that are now in the normalized structure
      delete payload[eventTypeField];
      delete payload[eventIdField];
      delete payload[timestampField];

      return {
        id,
        type,
        source: "generic",
        timestamp,
        payload,
        raw: options?.includeRaw ? JSON.stringify(event) : '',
      };
    },
  };
}

/**
 * Default generic adapter with common settings
 */
const generic: WebhookAdapter = createGenericAdapter();

export default generic;