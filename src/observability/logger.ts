/**
 * Legacy logger - redirects to structured logger
 * @deprecated Use structured-logger instead
 */

import { logger as structuredLogger } from './structured-logger';

export function logger(event: {
  id: string;
  type: string;
  timestamp: number;
  raw: unknown;
}) {
  // Convert legacy event to structured log entry
  structuredLogger.webhook({
    level: 'info',
    source: 'legacy-logger',
    operation: event.type,
    duration: 0,
    status: 'success',
    metadata: {
      eventId: event.id,
      timestamp: event.timestamp,
      raw: event.raw
    }
  });
}

// Re-export structured logger as default
export { logger as structuredLogger, createLogger } from './structured-logger';
