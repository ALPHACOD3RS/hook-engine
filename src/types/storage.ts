/**
 * Base interface for storage adapters
 */
export interface StorageAdapter {
  /**
   * Check if an event ID has been seen before
   */
  isDuplicate(eventId: string): Promise<boolean>;

  /**
   * Mark an event ID as seen
   */
  markSeen(eventId: string, metadata?: Record<string, any>): Promise<void>;

  /**
   * Store event data
   */
  storeEvent(eventId: string, event: any): Promise<void>;

  /**
   * Retrieve event data by ID
   */
  getEvent(eventId: string): Promise<any | null>;

  /**
   * Clean up old events (TTL)
   */
  cleanup(): Promise<void>;

  /**
   * Close storage connection
   */
  close(): Promise<void>;
}

/**
 * Event storage entry
 */
export interface StoredEvent {
  id: string;
  type: string;
  source: string;
  timestamp: Date;
  payload: Record<string, any>;
  metadata?: Record<string, any>;
  seenAt: Date;
}

/**
 * Storage statistics
 */
export interface StorageStats {
  totalEvents: number;
  duplicateEvents: number;
  oldestEvent?: Date;
  storageSize?: number;
} 