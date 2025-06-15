import { StorageAdapter, StoredEvent, StorageStats } from '../types/storage';
import { StorageConfig } from '../types/config';

/**
 * In-memory storage adapter for development and testing
 */
export class MemoryAdapter implements StorageAdapter {
  private events = new Map<string, StoredEvent>();
  private seenIds = new Set<string>();
  private config: StorageConfig;
  private cleanupTimer?: NodeJS.Timeout;

  constructor(config: StorageConfig) {
    this.config = config;
    this.startCleanupTimer();
  }

  async isDuplicate(eventId: string): Promise<boolean> {
    return this.seenIds.has(eventId);
  }

  async markSeen(eventId: string, metadata?: Record<string, any>): Promise<void> {
    this.seenIds.add(eventId);
    
    if (this.events.has(eventId)) {
      const event = this.events.get(eventId)!;
      event.metadata = { ...event.metadata, ...metadata };
      event.seenAt = new Date();
    }
  }

  async storeEvent(eventId: string, event: any): Promise<void> {
    const storedEvent: StoredEvent = {
      id: eventId,
      type: event.type,
      source: event.source,
      timestamp: new Date(event.timestamp * 1000),
      payload: event.payload,
      metadata: {},
      seenAt: new Date()
    };

    this.events.set(eventId, storedEvent);
    this.seenIds.add(eventId);
  }

  async getEvent(eventId: string): Promise<StoredEvent | null> {
    return this.events.get(eventId) || null;
  }

  async cleanup(): Promise<void> {
    const now = Date.now();
    const ttlMs = this.config.ttl * 1000;

    for (const [eventId, event] of this.events.entries()) {
      if (now - event.seenAt.getTime() > ttlMs) {
        this.events.delete(eventId);
        this.seenIds.delete(eventId);
      }
    }
  }

  async close(): Promise<void> {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    this.events.clear();
    this.seenIds.clear();
  }

  /**
   * Get storage statistics
   */
  getStats(): StorageStats {
    const events = Array.from(this.events.values());
    return {
      totalEvents: events.length,
      duplicateEvents: this.seenIds.size - events.length,
      oldestEvent: events.length > 0 
        ? new Date(Math.min(...events.map(e => e.timestamp.getTime())))
        : undefined
    };
  }

  private startCleanupTimer(): void {
    const intervalMs = this.config.cleanupInterval * 1000;
    this.cleanupTimer = setInterval(() => {
      this.cleanup().catch(console.error);
    }, intervalMs);
  }
} 