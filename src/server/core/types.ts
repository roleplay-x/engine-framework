import { EngineClient } from '@roleplayx/engine-sdk';

import { RPEventEmitter } from '../../core/bus/event-emitter';
import { RPHookBus } from '../../core/bus/hook-bus';
import { RPLogger } from '../../core/logger';
import { PlatformAdapter } from '../natives/adapters';

import { RPServerEvents } from './events/events';
import { RPServerHooks } from './hooks/hooks';

/**
 * Custom options that can be passed to server context extensions
 */
export type CustomServerContextOptions = Record<string, unknown>;

/**
 * Server types configuration interface
 * This centralizes all type parameters to avoid circular dependencies
 */
export interface ServerTypes {
  events: RPServerEvents;
  hooks: RPServerHooks;
  options: CustomServerContextOptions;
}

/**
 * Service context interface that provides dependencies without circular references
 * Services depend on this interface, not on the concrete context class
 */
export interface IServiceContext<T extends ServerTypes = ServerTypes> {
  readonly eventEmitter: RPEventEmitter<T['events']>;
  readonly hookBus: RPHookBus<T['hooks']>;
  readonly logger: RPLogger;
  readonly platformAdapter: PlatformAdapter;

  getEngineApi<Api>(ApiConstructor: new (client: EngineClient) => Api): Api;

  getService<Service>(ServiceConstructor: ServiceConstructor<Service, unknown>): Service;
}

/**
 * Service constructor type - accepts the concrete context, not just the interface
 * Supports both concrete and abstract service classes
 */
export type ServiceConstructor<S, TContext = unknown> =
  | (new (context: TContext) => S)
  | (abstract new (context: TContext) => S);
