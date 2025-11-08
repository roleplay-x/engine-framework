import { BaseBlueprintConfigValue, BlueprintConfigValueMapper } from '@roleplayx/engine-sdk';

/**
 * Handler function for applying a specific appearance configuration.
 * Can be synchronous or asynchronous.
 */
export type CharacterAppearanceHandler<TConfig extends Record<string, BlueprintConfigValueMapper>> = (
  config: Partial<TConfig>,
) => void | Promise<void>;

/**
 * Hook function that runs before applying appearance.
 * Can transform the config object before it's applied.
 */
export type CharacterAppearancePreApplyHook<TConfig extends Record<string, BlueprintConfigValueMapper>> = (
  config: Partial<TConfig>,
) => Partial<TConfig> | Promise<Partial<TConfig>>;

/**
 * Handler registry entry
 */
export interface HandlerEntry<TConfig extends Record<string, BlueprintConfigValueMapper>> {
  id: string;
  handler: CharacterAppearanceHandler<TConfig>;
}

/**
 * Options for applying appearance
 */
export interface ApplyAppearanceOptions {
  /**
   * Whether to skip hooks
   */
  skipHooks?: boolean;

  /**
   * Whether to apply incrementally (only changed values)
   */
  incremental?: boolean;
}

