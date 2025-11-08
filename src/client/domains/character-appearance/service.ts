import {
  BaseBlueprintConfigValue,
  BlueprintConfigValueMapper,
  mapBlueprintConfigValuesFrom,
} from '@roleplayx/engine-sdk';

import { RPClientService } from '../../core/client-service';
import { ClientTypes } from '../../core/types';

import {
  CharacterAppearanceHandler,
  CharacterAppearancePreApplyHook,
  HandlerEntry,
  ApplyAppearanceOptions,
} from './types';

/**
 * Abstract service for managing character appearance.
 *
 * This service provides a flexible, handler-based system for applying character appearance
 * configurations. It supports:
 * - Dynamic handler registration/unregistration
 * - Pre-apply hooks for config transformation
 * - Incremental updates (only changed values)
 * - Generic config types for platform-specific implementations
 *
 * @example
 * ```typescript
 * // In platform implementation (e.g., VEF)
 * class FiveMCharacterAppearanceService extends CharacterAppearanceService<FiveMAppearanceConfig> {
 *   async init() {
 *     await super.init();
 *
 *     // Register handlers for each config
 *     this.registerHandler('HAIR_COLOR', (config) => {
 *       if (config.HAIR_COLOR?.index) {
 *         SetPedHairColor(GetPlayerPed(-1), config.HAIR_COLOR.index);
 *       }
 *     });
 *
 *     this.registerHandler('FATHER', (config) => {
 *       if (config.FATHER?.value) {
 *         // Apply heritage blend...
 *       }
 *     });
 *   }
 * }
 * ```
 */
export abstract class CharacterAppearanceService<
  TConfig extends Record<string, BlueprintConfigValueMapper> = Record<string, BlueprintConfigValueMapper>,
> extends RPClientService<ClientTypes> {
  private handlers: Map<string, HandlerEntry<TConfig>> = new Map();
  private preApplyHooks: CharacterAppearancePreApplyHook<TConfig>[] = [];
  private lastAppliedConfig: Partial<TConfig> | null = null;

  /**
   * Applies character appearance from blueprint config values.
   *
   * @param values - Array of blueprint config values
   * @param options - Apply options
   */
  public async applyAppearance(
    values: BaseBlueprintConfigValue[],
    options: ApplyAppearanceOptions = {},
  ): Promise<void> {
    // Convert values array to typed config object
    let config = mapBlueprintConfigValuesFrom<TConfig>(values);

    // Run pre-apply hooks unless skipped
    if (!options.skipHooks) {
      config = await this.runPreApplyHooks(config);
    }

    // Determine which configs to apply
    const configsToApply = options.incremental
      ? this.getChangedConfigs(config)
      : Object.keys(config);

    this.logger.debug(`Applying appearance for ${configsToApply.length} config(s)`, {
      configs: configsToApply,
      incremental: options.incremental,
    });

    // Execute handlers for each config
    await this.executeHandlers(config, configsToApply);

    // Store last applied config for incremental updates
    this.lastAppliedConfig = config;
  }

  /**
   * Registers a handler for a specific appearance configuration.
   *
   * @param configKey - The config key this handler applies to
   * @param handler - The handler function
   * @returns Handler ID for later removal
   *
   * @example
   * ```typescript
   * const handlerId = service.registerHandler('HAIR_COLOR', (config) => {
   *   if (config.HAIR_COLOR?.index) {
   *     SetPedHairColor(ped, config.HAIR_COLOR.index);
   *   }
   * });
   * ```
   */
  public registerHandler(
    configKey: keyof TConfig,
    handler: CharacterAppearanceHandler<TConfig>,
  ): string {
    const id = `${String(configKey)}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    this.handlers.set(String(configKey), {
      id,
      handler,
    });

    this.logger.debug(`Registered handler for ${String(configKey)}`, { id });

    return id;
  }

  /**
   * Unregisters a handler by config key.
   *
   * @param configKey - The config key to unregister
   * @returns True if handler was found and removed
   */
  public unregisterHandler(configKey: keyof TConfig): boolean {
    const removed = this.handlers.delete(String(configKey));

    if (removed) {
      this.logger.debug(`Unregistered handler for ${String(configKey)}`);
    }

    return removed;
  }

  /**
   * Registers a pre-apply hook that can transform the config before application.
   *
   * @param hook - Hook function
   *
   * @example
   * ```typescript
   * service.registerPreApplyHook((config) => {
   *   // Ensure minimum hair opacity
   *   if (config.HAIR_OPACITY && config.HAIR_OPACITY.value < 0.5) {
   *     return {
   *       ...config,
   *       HAIR_OPACITY: { ...config.HAIR_OPACITY, value: 0.5 }
   *     };
   *   }
   *   return config;
   * });
   * ```
   */
  public registerPreApplyHook(hook: CharacterAppearancePreApplyHook<TConfig>): void {
    this.preApplyHooks.push(hook);
    this.logger.debug('Registered pre-apply hook');
  }

  /**
   * Clears all registered handlers.
   */
  public clearHandlers(): void {
    this.handlers.clear();
    this.logger.debug('Cleared all handlers');
  }

  /**
   * Clears all pre-apply hooks.
   */
  public clearHooks(): void {
    this.preApplyHooks = [];
    this.logger.debug('Cleared all pre-apply hooks');
  }

  /**
   * Gets the last applied config.
   */
  public getLastAppliedConfig(): Partial<TConfig> | null {
    return this.lastAppliedConfig;
  }

  /**
   * Clears the last applied config (useful for forcing full re-application).
   */
  public clearLastAppliedConfig(): void {
    this.lastAppliedConfig = null;
  }

  /**
   * Runs all pre-apply hooks sequentially.
   */
  private async runPreApplyHooks(
    config: Partial<TConfig>,
  ): Promise<Partial<TConfig>> {
    let transformedConfig = config;

    for (const hook of this.preApplyHooks) {
      try {
        transformedConfig = await hook(transformedConfig);
      } catch (error) {
        this.logger.error('Pre-apply hook failed', error);
      }
    }

    return transformedConfig;
  }

  /**
   * Gets configs that have changed since last application.
   */
  private getChangedConfigs(config: Partial<TConfig>): string[] {
    if (!this.lastAppliedConfig) {
      return Object.keys(config);
    }

    const changedConfigs: string[] = [];

    for (const key of Object.keys(config)) {
      const currentValue = config[key as keyof TConfig];
      const lastValue = this.lastAppliedConfig[key as keyof TConfig];

      if (JSON.stringify(currentValue) !== JSON.stringify(lastValue)) {
        changedConfigs.push(key);
      }
    }

    return changedConfigs;
  }

  /**
   * Executes handlers for specified configs.
   */
  private async executeHandlers(
    config: Partial<TConfig>,
    configKeys: string[],
  ): Promise<void> {
    const executionPromises: Promise<void>[] = [];

    for (const key of configKeys) {
      const entry = this.handlers.get(key);

      if (!entry) {
        this.logger.trace(`No handler registered for ${key}`);
        continue;
      }

      try {
        const result = entry.handler(config);
        if (result instanceof Promise) {
          executionPromises.push(result);
        }
      } catch (error) {
        this.logger.error(`Handler for ${key} failed`, error);
      }
    }

    // Wait for all async handlers to complete
    if (executionPromises.length > 0) {
      await Promise.all(executionPromises);
    }
  }

  /**
   * Dispose the service.
   */
  public async dispose(): Promise<void> {
    this.clearHandlers();
    this.clearHooks();
    this.lastAppliedConfig = null;
    await super.dispose();
  }
}

