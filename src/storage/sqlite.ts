import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { StorageAdapter, StoredEvent, StorageStats } from '../types/storage';
import { StorageConfig } from '../types/config';

/**
 * SQLite storage adapter implementation
 */
export class SqliteAdapter implements StorageAdapter {
  private db: Database.Database;
  private config: StorageConfig;
  private cleanupTimer?: NodeJS.Timeout;

  constructor(config: StorageConfig) {
    this.config = config;
    
    // Create database directory if it doesn't exist
    const dbPath = config.connection?.path || path.resolve(process.cwd(), "db/hook-engine.sqlite");
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    
    // Initialize database
    this.db = new Database(dbPath);
    this.initializeTables();
    this.startCleanupTimer();
  }

  async isDuplicate(eventId: string): Promise<boolean> {
    const row = this.db.prepare("SELECT 1 FROM seen_events WHERE id = ?").get(eventId);
    return !!row;
  }

  async markSeen(eventId: string, metadata?: Record<string, any>): Promise<void> {
    this.db.prepare(`
      INSERT OR REPLACE INTO seen_events (id, seen_at, metadata) 
      VALUES (?, ?, ?)
    `).run(eventId, Date.now(), JSON.stringify(metadata || {}));
  }

  async storeEvent(eventId: string, event: any): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO events (
        id, type, source, timestamp, payload, raw_data, stored_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      eventId,
      event.type,
      event.source,
      event.timestamp,
      JSON.stringify(event.payload),
      JSON.stringify(event.raw),
      Date.now()
    );

    // Also mark as seen
    await this.markSeen(eventId);
  }

  async getEvent(eventId: string): Promise<StoredEvent | null> {
    const row = this.db.prepare(`
      SELECT e.*, s.seen_at, s.metadata 
      FROM events e 
      LEFT JOIN seen_events s ON e.id = s.id 
      WHERE e.id = ?
    `).get(eventId) as any;

    if (!row) return null;

    return {
      id: row.id,
      type: row.type,
      source: row.source,
      timestamp: new Date(row.timestamp * 1000),
      payload: JSON.parse(row.payload),
      metadata: row.metadata ? JSON.parse(row.metadata) : {},
      seenAt: new Date(row.seen_at)
    };
  }

  async cleanup(): Promise<void> {
    const ttlMs = this.config.ttl * 1000;
    const cutoffTime = Date.now() - ttlMs;

    // Clean up old events
    const eventStmt = this.db.prepare("DELETE FROM events WHERE stored_at < ?");
    const eventResult = eventStmt.run(cutoffTime);

    // Clean up old seen events
    const seenStmt = this.db.prepare("DELETE FROM seen_events WHERE seen_at < ?");
    const seenResult = seenStmt.run(cutoffTime);

    console.log(`🧹 Cleaned up ${eventResult.changes} events and ${seenResult.changes} seen records`);
  }

  async close(): Promise<void> {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    this.db.close();
  }

  /**
   * Get storage statistics
   */
  getStats(): StorageStats {
    const totalEvents = this.db.prepare("SELECT COUNT(*) as count FROM events").get() as { count: number };
    const totalSeen = this.db.prepare("SELECT COUNT(*) as count FROM seen_events").get() as { count: number };
    const oldestEvent = this.db.prepare("SELECT MIN(stored_at) as oldest FROM events").get() as { oldest: number };

    return {
      totalEvents: totalEvents.count,
      duplicateEvents: totalSeen.count - totalEvents.count,
      oldestEvent: oldestEvent.oldest ? new Date(oldestEvent.oldest) : undefined
    };
  }

  private initializeTables(): void {
    // Create events table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS events (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        source TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        payload TEXT NOT NULL,
        raw_data TEXT,
        stored_at INTEGER NOT NULL
      );
    `);

    // Create seen events table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS seen_events (
        id TEXT PRIMARY KEY,
        seen_at INTEGER NOT NULL,
        metadata TEXT DEFAULT '{}'
      );
    `);

    // Create indexes for performance
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp);
      CREATE INDEX IF NOT EXISTS idx_events_source ON events(source);
      CREATE INDEX IF NOT EXISTS idx_events_type ON events(type);
      CREATE INDEX IF NOT EXISTS idx_seen_events_seen_at ON seen_events(seen_at);
    `);
  }

  private startCleanupTimer(): void {
    const intervalMs = this.config.cleanupInterval * 1000;
    this.cleanupTimer = setInterval(() => {
      this.cleanup().catch(console.error);
    }, intervalMs);
  }
}

// Legacy exports for backward compatibility
const DB_PATH = path.resolve(process.cwd(), "db/dedupe.sqlite");
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
const legacyDb = new Database(DB_PATH);

legacyDb.exec(`
  CREATE TABLE IF NOT EXISTS seen_events (
    id TEXT PRIMARY KEY,
    seen_at INTEGER
  );
`);

export function isDuplicate(id: string): boolean {
  const row = legacyDb.prepare("SELECT 1 FROM seen_events WHERE id = ?").get(id);
  return !!row;
}

export function markSeen(id: string) {
  legacyDb.prepare("INSERT OR IGNORE INTO seen_events (id, seen_at) VALUES (?, ?)").run(id, Date.now());
}
