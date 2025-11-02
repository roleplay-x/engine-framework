import {
  BaseBlueprintConfigValue,
  BlueprintApi,
  BlueprintConfig,
  BlueprintConfigConstraints,
  BlueprintConfigSection,
  mapBlueprintConfigValues,
} from '@roleplayx/engine-sdk';
import _ from 'lodash';
import { BlueprintConfigCategory } from '@roleplayx/engine-sdk/blueprint/models/blueprint-config';

import { RPServerService } from '../../core/server-service';

export type BlueprintConfigKey = string;

/**
 * Service for managing blueprint configurations in the roleplay server.
 *
 * This service handles:
 * - Loading and caching blueprint configurations from the Engine API
 * - Transforming raw data into structured blueprint values
 * - Validating required configuration fields
 * - Automatic periodic refresh of configuration data
 *
 * Blueprint configurations are organized by category (e.g., CharacterAppearance, VehicleCustomization)
 * and cached for fast access during runtime.
 *
 * @example
 * ```typescript
 * const blueprintService = context.getService(BlueprintService);
 *
 * // Transform raw appearance data into blueprint values
 * const values = blueprintService.getValues(
 *   BlueprintConfigCategory.CharacterAppearance,
 *   { hairColor: 'brown', eyeColor: 'blue' }
 * );
 *
 * // Check if required fields are missing
 * const isMissing = blueprintService.isRequiredValuesMissing(
 *   BlueprintConfigCategory.CharacterAppearance,
 *   { hairColor: 'brown' } // missing required fields
 * );
 * ```
 */
export class BlueprintService extends RPServerService {
  /** Cache of blueprint configurations organized by category and config key */
  private configs: Map<BlueprintConfigCategory, Map<BlueprintConfigKey, BlueprintConfig>> =
    new Map();

  /** Set of required configuration keys per category for validation */
  private requiredConfigKeys: Map<BlueprintConfigCategory, Set<BlueprintConfigKey>> = new Map();

  /**
   * Initializes the blueprint service by loading all configurations and setting up periodic refresh.
   *
   * This method:
   * - Loads all enabled blueprint sections from the Engine API
   * - Caches configurations by category
   * - Sets up a 5-minute interval to refresh configurations
   *
   * @returns Promise that resolves when initialization is complete
   */
  override async init(): Promise<void> {
    this.logger.info('Initializing blueprints...');
    await this.refreshSections();
    setInterval(() => {
      try {
        this.refreshSections();
      } catch (error) {
        this.logger.error('Blueprints refresh sections failed', error);
      }
    }, 300000);
    return super.init();
  }

  /**
   * Transforms raw data into structured blueprint configuration values.
   *
   * Converts a key-value map of raw data into typed blueprint values based on
   * the configuration definitions for the specified category. Only returns values
   * for configurations that exist in the cached config map.
   *
   * @param category - The blueprint category to use for transformation
   * @param data - Raw data as key-value pairs
   * @returns Array of structured blueprint configuration values
   *
   * @example
   * ```typescript
   * const values = blueprintService.getValues(
   *   BlueprintConfigCategory.CharacterAppearance,
   *   { hairColor: 'brown', eyeColor: 'blue', height: '180' }
   * );
   * // Returns: [
   * //   { configKey: 'hairColor', type: 'dropdown', value: 'brown' },
   * //   { configKey: 'eyeColor', type: 'dropdown', value: 'blue' },
   * //   { configKey: 'height', type: 'slider', value: 180 }
   * // ]
   * ```
   */
  public getValues(
    category: BlueprintConfigCategory,
    data: Record<string, string>,
  ): BaseBlueprintConfigValue[] {
    const configs = this.configs.get(category);
    if (!configs) {
      return [];
    }

    return mapBlueprintConfigValues(configs, data);
  }

  /**
   * Checks if any required configuration values are missing from the provided data.
   *
   * Validates that all non-optional configuration fields for the given category
   * have values in the provided data object. Returns true if any required field
   * is missing or has a falsy value.
   *
   * @param category - The blueprint category to validate against
   * @param data - Data to validate
   * @param filter
   * @returns True if any required values are missing, false otherwise
   *
   * @example
   * ```typescript
   * // Assuming 'hairColor' and 'eyeColor' are required for CharacterAppearance
   * const isMissing = blueprintService.isRequiredValuesMissing(
   *   BlueprintConfigCategory.CharacterAppearance,
   *   { hairColor: 'brown' } // missing eyeColor
   * );
   * console.log(isMissing); // true
   *
   * const isComplete = blueprintService.isRequiredValuesMissing(
   *   BlueprintConfigCategory.CharacterAppearance,
   *   { hairColor: 'brown', eyeColor: 'blue' }
   * );
   * console.log(isComplete); // false
   * ```
   */
  public isRequiredValuesMissing(
    category: BlueprintConfigCategory,
    data: Record<string, string>,
    filter?: (constraints: BlueprintConfigConstraints) => boolean,
  ): boolean {
    const requiredConfigKeys = this.requiredConfigKeys.get(category);
    if (!requiredConfigKeys?.size) {
      return false;
    }

    for (const key of requiredConfigKeys) {
      if (data[key]) {
        continue;
      }

      if (!filter) {
        return true;
      }

      const config = this.configs.get(category)?.get(key);
      if (!config) {
        continue;
      }

      if (filter(config.constraints)) {
        return true;
      }
    }

    return false;
  }

  private async refreshSections(category?: BlueprintConfigCategory): Promise<void> {
    const sections = await this.getEngineApi(BlueprintApi).getAllBlueprintSections({
      category,
      enabled: true,
      noCache: true,
      includeConfigs: true,
    });

    if (category) {
      this.setSections(category, sections);
      return;
    }

    const grouped = _.groupBy(sections, (section) => section.category);
    for (const [cat, secs] of Object.entries(grouped)) {
      this.setSections(cat as BlueprintConfigCategory, secs);
    }
  }

  private async refreshConfig(category: BlueprintConfigCategory, configKey: BlueprintConfigKey) {
    const existingConfig = this.configs.get(category)?.get(configKey);
    if (!existingConfig) {
      return this.refreshSections(category);
    }

    try {
      const config = await this.getEngineApi(BlueprintApi).getBlueprintConfig(existingConfig.id, {
        includeOptions: true,
        noCache: true,
      });

      if (!config.enabled) {
        this.configs.get(category)?.delete(configKey);
        return;
      }

      this.configs.get(category)?.set(configKey, config);
      if (!config.optional) {
        this.requiredConfigKeys.get(category)?.add(configKey);
      } else {
        this.requiredConfigKeys.get(category)?.delete(configKey);
      }
    } catch (error) {
      this.logger.error(`Error while refreshing blueprint config ${existingConfig.id}`, error);
    }
  }

  private setSections(
    category: BlueprintConfigCategory,
    sections: ReadonlyArray<BlueprintConfigSection>,
  ): void {
    const configs = sections.filter((p) => p.enabled).flatMap((section) => section.configs ?? []);
    this.setConfigs(category, configs);
  }

  private setConfigs(category: BlueprintConfigCategory, configs: ReadonlyArray<BlueprintConfig>) {
    const configMap = configs
      .filter((p) => p.enabled)
      .reduce((acc, config) => {
        return acc.set(config.key, config);
      }, new Map<BlueprintConfigKey, BlueprintConfig>());

    const requiredConfigKeys = new Set(configs.filter((p) => !p.optional).map((p) => p.key));
    this.configs.set(category, configMap);
    this.requiredConfigKeys.set(category, requiredConfigKeys);
  }
}
