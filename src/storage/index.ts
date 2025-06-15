export * from './sqlite';
export * from './memory';
// export * from './redis'; // TODO: Implement Redis adapter

// Re-export types
export { StorageAdapter, StoredEvent, StorageStats } from '../types/storage';

import { StorageAdapter } from '../types/storage';
import { StorageConfig } from '../types/config';
import { SqliteAdapter } from './sqlite';
import { MemoryAdapter } from './memory';

/**
 * Create storage adapter based on configuration
 */
export function createStorageAdapter(config: StorageConfig): StorageAdapter {
  switch (config.type) {
    case 'sqlite':
      return new SqliteAdapter(config);
    case 'memory':
      return new MemoryAdapter(config);
    case 'redis':
      // Redis adapter will be implemented later
      throw new Error('Redis adapter not yet implemented');
    default:
      throw new Error(`Unsupported storage type: ${config.type}`);
  }
} 