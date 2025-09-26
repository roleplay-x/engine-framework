import { EngineClient } from '@roleplayx/engine-sdk';

import { RPEventEmitter } from '../../core/bus/event-emitter';
import { RPHookBus } from '../../core/bus/hook-bus';
import { RPLogger } from '../../core/logger';

import { RPServerEvents } from './events/events';
import { RPServerHooks } from './hooks/hooks';
import { RPServerService } from './server-service';
import { CustomServerContextOptions, IServiceContext } from './types';

/** Configuration options for creating a server context */
export interface RPServerContextOptions<
  TEvents extends RPServerEvents = RPServerEvents,
  THooks extends RPServerHooks = RPServerHooks,
> {
  /** The engine client for API communication */
  engineClient: EngineClient;
  /** Event emitter for server events */
  eventEmitter: RPEventEmitter<TEvents>;
  /** Hook bus for server hooks */
  hookBus: RPHookBus<THooks>;
  /** Logger instance */
  logger: RPLogger;
}

/** Constructor type for server context implementations */
export type RPServerContextCtor<
  TOptions extends CustomServerContextOptions = CustomServerContextOptions,
  TEvents extends RPServerEvents = RPServerEvents,
  THooks extends RPServerHooks = RPServerHooks,
  TContext extends RPServerContext<TOptions, TEvents, THooks> = RPServerContext<
    TOptions,
    TEvents,
    THooks
  >,
> = new (options: RPServerContextOptions<TEvents, THooks> & TOptions) => TContext;

/**
 * Server context that provides dependency injection and service management for the roleplay server.
 *
 * This class serves as the central container for all server infrastructure including:
 * - API instances with automatic caching and reuse
 * - Service registration and dependency injection
 * - Shared infrastructure (event emitter, hook bus, logger)
 * - Service lifecycle management with initialization
 *
 * The context follows a singleton pattern for APIs and services, ensuring that each
 * service type and API type is instantiated only once and reused throughout the
 * application lifecycle.
 *
 * @template TOptions - Custom options type for extending the context
 *
 * @example
 * ```typescript
 * // Create a server context
 * const context = new RPServerContext({
 *   engineClient: client,
 *   eventEmitter: emitter,
 *   hookBus: hooks,
 *   logger: logger
 * });
 *
 * // Register services
 * context.addService(AccountService);
 * context.addService(SessionService);
 *
 * // Initialize all services
 * await context.init();
 *
 * // Use services
 * const accountService = context.getService(AccountService);
 * const account = await accountService.getAccount('acc_123');
 * ```
 *
 * @example With custom options
 * ```typescript
 * interface GameServerOptions {
 *   gameServerConfig: { gameMode: string };
 * }
 *
 * class GameServerContext extends RPServerContext<GameServerOptions> {
 *   constructor(options: RPServerContextOptions & GameServerOptions) {
 *     super(options);
 *     this.setupGameFeatures(options.gameServerConfig);
 *   }
 * }
 * ```
 */
export class RPServerContext<
  TOptions extends CustomServerContextOptions = CustomServerContextOptions,
  TEvents extends RPServerEvents = RPServerEvents,
  THooks extends RPServerHooks = RPServerHooks,
> implements IServiceContext<{ events: TEvents; hooks: THooks; options: TOptions }>
{
  /** Cache of API instances to ensure singleton behavior */
  private readonly apis = new Map<new (c: EngineClient) => unknown, unknown>();
  /** Map of registered services */
  private readonly services = new Map<unknown, RPServerService>();
  /** Flag indicating whether the context has been initialized */
  private initialized = false;

  /** The engine client for making API requests */
  protected readonly engineClient: EngineClient;

  /** Logger instance for this context */
  public readonly logger: RPLogger;
  /** Event emitter for server-wide events */
  public readonly eventEmitter: RPEventEmitter<TEvents>;
  /** Hook bus for server-wide hooks */
  public readonly hookBus: RPHookBus<THooks>;
  /** Custom options of the context */
  public readonly customOptions: TOptions;

  /**
   * Creates a new server context with the provided infrastructure.
   *
   * @param options - The configuration options including client, emitter, hooks, and logger plus custom options
   */
  constructor(options: RPServerContextOptions<TEvents, THooks>);
  constructor(options: RPServerContextOptions<TEvents, THooks> & TOptions);
  constructor(options: RPServerContextOptions<TEvents, THooks> & TOptions) {
    this.logger = options.logger;
    this.engineClient = options.engineClient;
    this.eventEmitter = options.eventEmitter;
    this.hookBus = options.hookBus;
    this.customOptions = options;

    this.eventEmitter.setErrorHandler((error, event, payload) => {
      this.logger.error(`Async event handler error in '${event}':`, error, payload);
      if (event !== 'error') {
        this.eventEmitter.emit('eventEmitterError', { error, event, payload });
      }
    });
  }

  /**
   * Factory method for creating server context instances.
   *
   * This method allows for dependency injection of custom context implementations
   * while maintaining type safety and proper initialization.
   *
   * @param ctor - The context constructor to use
   * @param options - The configuration options for the context
   * @returns A new instance of the specified context type
   *
   * @example
   * ```typescript
   * class CustomServerContext extends RPServerContext {
   *   // Custom implementation
   * }
   *
   * const context = RPServerContext.create(CustomServerContext, {
   *   engineClient: client,
   *   eventEmitter: emitter,
   *   hookBus: hooks,
   *   logger: logger
   * });
   * ```
   */
  public static create<
    TOptions extends CustomServerContextOptions = CustomServerContextOptions,
    TEvents extends RPServerEvents = RPServerEvents,
    THooks extends RPServerHooks = RPServerHooks,
    TContext = RPServerContext<TOptions, TEvents, THooks>,
  >(
    ctor: new (options: RPServerContextOptions<TEvents, THooks> & TOptions) => TContext,
    options: RPServerContextOptions<TEvents, THooks> & TOptions,
  ): TContext {
    return new ctor(options) as TContext;
  }

  /**
   * Gets a roleplay engine API instance with automatic caching.
   *
   * This method implements the singleton pattern for API instances, ensuring that
   * each API type is instantiated only once and reused for subsequent requests.
   * The API instances are automatically configured with the context's engine client.
   *
   * @template Api - The API class type
   * @param ApiConstructor - The API class constructor
   * @returns A singleton instance of the requested API
   *
   * @example
   * ```typescript
   * const accountApi = context.getEngineApi(AccountApi);
   * const sessionApi = context.getEngineApi(SessionApi);
   *
   * // Subsequent calls return the same instances
   * const sameAccountApi = context.getEngineApi(AccountApi); // Same instance as above
   * ```
   */
  public getEngineApi<Api>(ApiConstructor: new (client: EngineClient) => Api): Api {
    let api = this.apis.get(ApiConstructor);
    if (!api) {
      api = new ApiConstructor(this.engineClient);
      this.apis.set(ApiConstructor, api);
    }
    return api as Api;
  }

  /**
   * Registers a service with the context.
   *
   * Services must be registered before the context is initialized. Once registered,
   * services can be retrieved using getService() and will be automatically
   * initialized when the context is initialized.
   *
   * @param serviceConstructor - The service class constructor to register (can be concrete or abstract)
   * @returns The context instance for method chaining
   * @throws {Error} When attempting to add a service after initialization
   *
   * @example
   * ```typescript
   * // Register concrete services
   * context
   *   .addService(AccountService)
   *   .addService(SessionService)
   *   .addService(WorldService);
   *
   * // Register a concrete implementation of an abstract service
   * context.addService(RPDiscordService); // RPDiscordService extends abstract DiscordService
   *
   * await context.init(); // Initializes all registered services
   * ```
   */
  public addService<Service>(serviceConstructor: new (context: this) => Service) {
    if (this.initialized) {
      throw new Error('Cannot add service after server start.');
    }

    const service = new serviceConstructor(this);

    this.services.set(serviceConstructor, service as unknown as RPServerService);

    let currentProto = Object.getPrototypeOf(serviceConstructor);

    while (currentProto && currentProto !== Function.prototype) {
      if (currentProto.name && !this.services.has(currentProto)) {
        this.services.set(currentProto, service as unknown as RPServerService);
      }

      currentProto = Object.getPrototypeOf(currentProto);
    }

    return this;
  }

  /**
   * Retrieves a registered service instance.
   *
   * Services are singletons within the context - each service type is
   * instantiated only once and the same instance is returned for all requests.
   * Supports retrieving services by both their concrete and abstract class constructors.
   *
   * @template Service - The service class type
   * @param serviceConstructor - The service class constructor (can be abstract or concrete)
   * @returns The singleton instance of the requested service
   * @throws {Error} When the requested service is not registered
   *
   * @example
   * ```typescript
   * // Get by concrete class
   * const accountService = context.getService(AccountService);
   * const sessionService = context.getService(SessionService);
   *
   * // Get by abstract class (returns the registered concrete implementation)
   * const discordService = context.getService(DiscordService); // Returns RPDiscordService instance
   *
   * // Use the services
   * const account = await accountService.getAccount('acc_123');
   * const session = sessionService.getSession('sess_456');
   * ```
   */
  public getService<Service>(
    serviceConstructor:
      | (new (context: this) => Service)
      | (abstract new (context: this) => Service),
  ): Service {
    const service = this.services.get(serviceConstructor);
    if (!service) {
      throw new Error(`Service ${serviceConstructor.name} not registered in the context.`);
    }
    return service as Service;
  }

  /**
   * Initializes the context and all registered services.
   *
   * This method should be called after all services have been registered.
   * It calls the init() method on each registered service in registration order.
   * The context can only be initialized once - subsequent calls are ignored.
   *
   * @returns Promise that resolves when all services are initialized
   *
   * @example
   * ```typescript
   * // Register all services first
   * context.addService(AccountService);
   * context.addService(SessionService);
   *
   * // Then initialize the context
   * await context.init();
   *
   * // Now services are ready to use
   * const accountService = context.getService(AccountService);
   * ```
   */
  public async init() {
    if (this.initialized) {
      return;
    }

    this.initialized = true;
    const uniqueServices = new Set(this.services.values());
    for (const service of uniqueServices) {
      await service.init();
    }
  }

  /**
   * Disposes the context and all registered services.
   *
   * This method calls the dispose() method on each registered service in reverse
   * registration order to ensure proper cleanup. Services are disposed in the
   * opposite order of their initialization to handle dependencies correctly.
   *
   * @returns Promise that resolves when all services are disposed
   *
   * @example
   * ```typescript
   * // Gracefully shutdown the server
   * await context.dispose();
   * console.log('All services disposed');
   * ```
   */
  public async dispose() {
    if (!this.initialized) {
      return;
    }

    const uniqueServices = Array.from(new Set(this.services.values())).reverse();
    for (const service of uniqueServices) {
      try {
        await service.dispose();
      } catch (error) {
        this.logger.error(`Error disposing service ${service.constructor.name}:`, error);
      }
    }

    this.initialized = false;
  }
}
