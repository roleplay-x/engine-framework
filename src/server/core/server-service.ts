import { EngineClient } from '@roleplayx/engine-sdk';

import { RPEventEmitter } from '../../core/bus/event-emitter';
import { RPLogger } from '../../core/logger';
import { RPHookBus } from '../../core/bus/hook-bus';

import { RPServerEvents } from './events/events';
import { getEventHandlers, getClientEventHandlers, getHookHandlers } from './events/decorators';
import { RPClientToServerEvents } from '../../shared/types';
import { IServiceContext, ServerTypes, ServiceConstructor } from './types';
import { PlayerId } from '../domains/session/models/session';

/**
 * Type definition for server event handler methods.
 * Maps event names to their corresponding handler functions.
 */
export type RPServerEventHandlerMethods<Events = RPServerEvents> = {
  [K in keyof Events]?: (payload: Events[K]) => void | Promise<void>;
};

/**
 * Type definition for client event handler methods.
 * Maps client event names to their corresponding handler functions.
 * The first parameter will always be the playerId, followed by the event data.
 */
export type RPClientEventHandlerMethods<Events = RPClientToServerEvents> = {
  [K in keyof Events]?: (playerId: PlayerId, payload: Events[K]) => void | Promise<void>;
};

/**
 * Abstract base class for all server services in the Roleplay Engine.
 *
 * This class provides core functionality for services including:
 * - Event handling with automatic decorator binding
 * - Access to shared infrastructure (event emitter, hook bus, logger)
 * - Service and API resolution through the server context
 * - Lifecycle management with initialization support
 *
 * Services extend this class to implement domain-specific functionality
 * such as account management, session handling, world management, etc.
 *
 * @template C - The server context type (defaults to RPServerContext)
 *
 * @example
 * ```typescript
 * export class MyService extends RPServerService {
 *   public async init(): Promise<void> {
 *     // Initialize service-specific resources
 *     await super.init();
 *   }
 *
 *   @OnServer('playerConnecting')
 *   private async onPlayerConnecting(payload: RPPlayerConnecting) {
 *     // Handle player connection event
 *   }
 * }
 * ```
 *
 * @example With custom context
 * ```typescript
 * export class PlayerService extends RPServerService<GameServerContext> {
 *   // this.context is now typed as GameServerContext
 *   public getPlayer(playerId: string) {
 *     return this.context.players.get(playerId);
 *   }
 * }
 * ```
 */

export abstract class RPServerService<T extends ServerTypes = ServerTypes> {
  public readonly eventHandlers: RPServerEventHandlerMethods<T['events']>;
  public readonly clientEventHandlers: RPClientEventHandlerMethods<RPClientToServerEvents>;
  protected readonly eventEmitter: RPEventEmitter<T['events']>;
  protected readonly hookBus: RPHookBus<T['hooks']>;
  protected readonly logger: RPLogger;

  [key: string]: unknown;

  /**
   * Creates a new service instance.
   *
   * Automatically sets up event handling by scanning for @OnServer decorators
   * and binding them to the event emitter.
   *
   * @param context - The server context providing shared infrastructure
   */
  public constructor(protected readonly context: IServiceContext<T>) {
    this.eventEmitter = context.eventEmitter;
    this.hookBus = context.hookBus;
    this.logger = context.logger;
    this.eventHandlers = this.bindEventEmitters(context.eventEmitter);
    this.clientEventHandlers = this.bindClientEventHandlers();
    this.bindHookHandlers();
  }

  /**
   * Initializes the service. Override this method to perform service-specific initialization.
   *
   * This method is called during server startup after all services have been registered.
   * Use this to set up initial state, load configuration, or prepare resources.
   *
   * @example
   * ```typescript
   * public async init(): Promise<void> {
   *   await super.init();
   *   await this.loadInitialData();
   * }
   * ```
   */
  public async init(): Promise<void> {}

  /**
   * Disposes the service and cleans up resources. Override this method to perform service-specific cleanup.
   *
   * This method is called during server shutdown to allow services to clean up resources,
   * close connections, save state, or perform other cleanup operations.
   *
   * @example
   * ```typescript
   * public async dispose(): Promise<void> {
   *   await this.saveState();
   *   this.closeConnections();
   *   await super.dispose();
   * }
   * ```
   */
  public async dispose(): Promise<void> {}

  /**
   * Scans the service instance for @OnServer decorated methods and binds them to events.
   *
   * @private
   * @param eventEmitter - The event emitter to bind handlers to
   * @returns A map of event names to their bound handler functions
   */
  private bindEventEmitters(
    eventEmitter: RPEventEmitter<T['events']>,
  ): RPServerEventHandlerMethods<T['events']> {
    const handlers = getEventHandlers<T['events']>(this) || [];
    const handlerMethods: RPServerEventHandlerMethods<T['events']> = {};
    for (const { method, event } of handlers) {
      const fn = (this as Record<string, unknown>)[method];
      if (typeof fn === 'function') {
        eventEmitter.on(event, fn.bind(this));
        handlerMethods[event] = fn.bind(this);
      }
    }

    return handlerMethods;
  }

  /**
   * Scans the service instance for @OnClient decorated methods and binds them to client events.
   * This method should be overridden by platform-specific implementations to actually
   * register the event handlers with the platform's event system.
   *
   * @private
   * @returns A map of client event names to their bound handler functions
   */
  private bindClientEventHandlers(): RPClientEventHandlerMethods<RPClientToServerEvents> {
    const handlers = getClientEventHandlers<RPClientToServerEvents>(this) || [];
    const handlerMethods: RPClientEventHandlerMethods<RPClientToServerEvents> = {};
    
    for (const { method, event } of handlers) {
      const fn = (this as Record<string, unknown>)[method];
      if (typeof fn === 'function') {
        handlerMethods[event] = fn.bind(this);
        
        this.registerClientEventHandler(event, fn.bind(this));
      }
    }

    return handlerMethods;
  }

  /**
   * Registers a client event handler with the platform.
   * Uses the platform adapter's network interface to register client events.
   * The first parameter passed to the handler will always be the playerId.
   *
   * @protected
   * @param event - The event name
   * @param handler - The event handler function
   */
  protected registerClientEventHandler<K extends keyof RPClientToServerEvents>(
    event: K,
    handler: (playerId: PlayerId, data: RPClientToServerEvents[K]) => void
  ): void {
    if (this.context.platformAdapter?.network?.onClientEvent) {
      this.context.platformAdapter.network.onClientEvent(event, handler);
    }
  }

  /**
   * Scans the service instance for @OnHook decorated methods and binds them to hooks.
   *
   * @private
   */
  private bindHookHandlers(): void {
    const handlers = getHookHandlers<T['hooks']>(this) || [];

    for (const { method, hook } of handlers) {
      const fn = (this as Record<string, unknown>)[method];
      if (typeof fn === 'function') {
        this.hookBus.on(hook as Extract<keyof T['hooks'], string>, fn.bind(this));
      }
    }
  }

  /**
   * Gets a roleplay engine API instance for making HTTP requests.
   *
   * This method provides access to the underlying engine-sdk APIs
   * with proper authentication and configuration.
   *
   * @template Api - The API class type
   * @param ApiConstructor - The API class constructor
   * @returns An instance of the requested API
   *
   * @example
   * ```typescript
   * const accountApi = this.getEngineApi(AccountApi);
   * const account = await accountApi.getAccountById(accountId);
   * ```
   */
  protected getEngineApi<Api>(ApiConstructor: new (client: EngineClient) => Api): Api {
    return this.context.getEngineApi(ApiConstructor);
  }

  /**
   * Gets another service instance from the server context.
   *
   * Use this to access functionality provided by other services. Services are
   * singletons within the server context. Supports retrieving services by both
   * their concrete and abstract class constructors.
   *
   * @template Service - The service class type
   * @param ServiceConstructor - The service class constructor (can be abstract or concrete)
   * @returns An instance of the requested service
   *
   * @example
   * ```typescript
   * // Get by concrete class
   * const accountService = this.getService(AccountService);
   * const account = await accountService.getAccount(accountId);
   *
   * // Get by abstract class (returns the registered concrete implementation)
   * const discordService = this.getService(DiscordService); // Returns RPDiscordService instance
   * ```
   */
  protected getService<Service>(
    ServiceConstructor:
      | (new (context: IServiceContext<T>) => Service)
      | (abstract new (context: IServiceContext<T>) => Service),
  ): Service {
    return this.context.getService(ServiceConstructor as ServiceConstructor<Service, unknown>);
  }
}
