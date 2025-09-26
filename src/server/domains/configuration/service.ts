import { Config, ConfigKey, ConfigurationApi } from '@roleplayx/engine-sdk';

import { RPServerService } from '../../core/server-service';
import { OnServer } from '../../core/events/decorators';
import { SocketConfigurationUpdated } from '../../socket/events/socket-configuration-updated';

/**
 * Service for managing server configuration in the roleplay server.
 *
 * This service provides functionality for:
 * - Configuration retrieval and caching
 * - Type-safe configuration access by key
 * - Real-time configuration updates through socket events
 * - Automatic cache synchronization
 *
 * The service maintains a local cache of all server configurations that is
 * automatically synchronized with the roleplay engine when configuration
 * changes occur. It provides both array-based and key-based access patterns.
 *
 * @example
 * ```typescript
 * // Get all configurations
 * const allConfigs = configurationService.getConfigs();
 *
 * // Get a specific configuration by key
 * const maxPlayersConfig = configurationService.getConfig('PLAYER_SLOT');
 * if (maxPlayersConfig) {
 *   console.log(`Max players: ${maxPlayersConfig.value}`);
 * }
 *
 * // Listen for configuration changes
 * server.on('configurationUpdated', () => {
 *   console.log('Server configuration has been updated');
 * });
 * ```
 */
export class ConfigurationService extends RPServerService {
  /** Array of all server configurations */
  private configs: Config[] = [];
  /** Map of configurations indexed by their keys for fast lookup */
  private configsMap: Map<ConfigKey, Config> = new Map([]);

  /**
   * Initializes the configuration service by loading all server configurations.
   *
   * This method is called during server startup to populate the local cache
   * with all server configurations from the roleplay engine.
   *
   * @override
   * @returns Promise that resolves when initialization is complete
   */
  public override async init(): Promise<void> {
    this.logger.info('Initializing configuration...');
    await this.refreshConfigs();
    return super.init();
  }

  /**
   * Retrieves all server configurations.
   *
   * Returns the cached array of all server configurations. This method provides
   * access to the complete configuration set without making API calls.
   *
   * @returns Array of all server configurations
   *
   * @example
   * ```typescript
   * const allConfigs = configurationService.getConfigs();
   * allConfigs.forEach(config => {
   *   console.log(`${config.key}: ${config.value}`);
   * });
   * ```
   */
  public getConfigs(): Config[] {
    return this.configs;
  }

  /**
   * Retrieves a specific configuration by its key.
   *
   * Returns the cached configuration for the specified key. This method provides
   * type-safe access to configuration values with proper TypeScript inference.
   *
   * @template K - The configuration key type
   * @param key - The unique key of the configuration to retrieve
   * @returns The configuration if found, undefined otherwise
   *
   * @example
   * ```typescript
   * const maxPlayersConfig = configurationService.getConfig('PLAYER_SLOT');
   * if (maxPlayersConfig) {
   *   console.log(`Server supports ${maxPlayersConfig.value} players`);
   * }
   *
   * const serverNameConfig = configurationService.getConfig('NAME');
   * console.log(`Server: ${serverNameConfig?.value ?? 'Unknown'}`);
   * ```
   */
  public getConfig<K extends ConfigKey>(key: K): Extract<Config, { key: K }> | undefined {
    return this.configsMap.get(key) as Extract<Config, { key: K }> | undefined;
  }

  private async refreshConfigs(): Promise<void> {
    this.configs = await this.getEngineApi(ConfigurationApi).getConfiguration({
      localized: false,
      onlyPublic: false,
      withOptions: false,
    });

    this.configsMap = new Map(this.configs.map((cfg) => [cfg.key, cfg] as [ConfigKey, Config]));
  }

  @OnServer('socketConfigurationUpdated')
  private async onSocketConfigurationUpdated(payload: SocketConfigurationUpdated): Promise<void> {
    await this.refreshConfigs();
    this.eventEmitter.emit('configurationUpdated', { timestamp: payload.timestamp });
  }
}
