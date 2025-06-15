export * from './defaults';
export * from './validation';

import { HookEngineConfig } from '../types/config';
import { validateConfig } from './validation';
import { defaultConfig } from './defaults';

/**
 * Load and validate configuration from environment and user options
 */
export function loadConfig(userConfig: Partial<HookEngineConfig> = {}): HookEngineConfig {
  // Merge default config with user config
  const config = {
    ...defaultConfig,
    ...userConfig,
    // Deep merge nested objects
    retry: { ...defaultConfig.retry, ...userConfig.retry },
    security: { ...defaultConfig.security, ...userConfig.security },
    observability: { ...defaultConfig.observability, ...userConfig.observability },
    storage: { ...defaultConfig.storage, ...userConfig.storage },
  };

  // Validate the final configuration
  validateConfig(config);

  return config;
} 