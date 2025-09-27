import { RPHookBus } from '../../core/bus/hook-bus';
import { RPLogger } from '../../core/logger';

import { RPClientHooks } from './hooks/hooks';
import { ClientPlatformAdapter } from '../natives/adapters';
import { CustomClientContextOptions, IServiceContext } from './types';
import { RPClientService } from './client-service';

/** Configuration options for creating a client context */
export interface RPClientContextOptions<
  THooks extends RPClientHooks = RPClientHooks,
> {
  /** Hook bus for client hooks */
  hookBus: RPHookBus<THooks>;
  /** Logger instance */
  logger: RPLogger;
  /** Platform adapter for the client */
  platformAdapter: ClientPlatformAdapter;
}

/** Constructor type for client context implementations */
export type RPClientContextCtor<
  TOptions extends CustomClientContextOptions = CustomClientContextOptions,
  THooks extends RPClientHooks = RPClientHooks,
  TContext extends RPClientContext<TOptions, THooks> = RPClientContext<
    TOptions,
    THooks
  >,
> = new (options: RPClientContextOptions<THooks> & TOptions) => TContext;

/**
 * Client context that provides dependency injection and service management for the roleplay client.
 *
 * This class serves as the central container for all client infrastructure including:
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
 * // Create a client context
 * const context = new RPClientContext({
 *   engineClient: client,
 *   eventEmitter: emitter,
 *   hookBus: hooks,
 *   logger: logger,
 *   platformAdapter: adapter
 * });
 *
 * // Register services
 * context.addService(PlayerService);
 * context.addService(WorldService);
 *
 * // Initialize all services
 * await context.init();
 *
 * // Use services
 * const playerService = context.getService(PlayerService);
 * const player = await playerService.getPlayer();
 * ```
 *
 * @example With custom options
 * ```typescript
 * interface GameClientOptions {
 *   gameClientConfig: { gameMode: string };
 * }
 *
 * class GameClientContext extends RPClientContext<GameClientOptions> {
 *   constructor(options: RPClientContextOptions & GameClientOptions) {
 *     super(options);
 *     this.setupGameFeatures(options.gameClientConfig);
 *   }
 * }
 * ```
 */
export class RPClientContext<
  TOptions extends CustomClientContextOptions = CustomClientContextOptions,
  THooks extends RPClientHooks = RPClientHooks,
> implements IServiceContext<{ hooks: THooks; options: TOptions }>
{
  /** Map of registered services */
  private readonly services = new Map<unknown, RPClientService>();
  /** Flag indicating whether the context has been initialized */
  private initialized = false;

  /** Logger instance for this context */
  public readonly logger: RPLogger;
  /** Hook bus for client-wide hooks */
  public readonly hookBus: RPHookBus<THooks>;
  /** Custom options of the context */
  public readonly customOptions: TOptions;
  /** Platform adapter for the client */
  public readonly platformAdapter: ClientPlatformAdapter;

  /**
   * Creates a new client context with the provided infrastructure.
   *
   * @param options - The configuration options including client, hooks, and logger plus custom options
   */
  constructor(options: RPClientContextOptions<THooks>);
  constructor(options: RPClientContextOptions<THooks> & TOptions);
  constructor(options: RPClientContextOptions<THooks> & TOptions) {
    this.logger = options.logger;
    this.hookBus = options.hookBus;
    this.customOptions = options;
    this.platformAdapter = options.platformAdapter;
  }

  /**
   * Factory method for creating client context instances.
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
   * class CustomClientContext extends RPClientContext {
   *   // Custom implementation
   * }
   *
   * const context = RPClientContext.create(CustomClientContext, {
   *   engineClient: client,
   *   eventEmitter: emitter,
   *   hookBus: hooks,
   *   logger: logger,
   *   platformAdapter: adapter
   * });
   * ```
   */
  public static create<
    TOptions extends CustomClientContextOptions = CustomClientContextOptions,
    THooks extends RPClientHooks = RPClientHooks,
    TContext extends RPClientContext<TOptions, THooks> = RPClientContext<
      TOptions,
      THooks
    >,
  >(ctor: RPClientContextCtor<TOptions, THooks, TContext>, options: RPClientContextOptions<THooks> & TOptions): TContext {
    return new ctor(options);
  }


  /**
   * Gets a service instance by its constructor.
   *
   * This method provides singleton behavior for service instances, ensuring that
   * each service type is instantiated only once and reused throughout the application
   * lifecycle. The service instance is created on first access and cached for future use.
   *
   * @template T - The service constructor type
   * @param serviceCtor - The service constructor to get an instance for
   * @returns The service instance
   *
   * @example
   * ```typescript
   * const playerService = context.getService(PlayerService);
   * const player = await playerService.getPlayer();
   * ```
   */
  public getService<T extends new (...args: any[]) => RPClientService>(serviceCtor: T): InstanceType<T> {
    if (!this.services.has(serviceCtor)) {
      const service = new serviceCtor(this);
      this.services.set(serviceCtor, service);
    }
    return this.services.get(serviceCtor) as InstanceType<T>;
  }

  /**
   * Adds a service to the context.
   *
   * This method registers a service constructor with the context. The service
   * will be instantiated when first accessed through getService(). Services
   * are initialized in the order they are added when init() is called.
   *
   * @template T - The service constructor type
   * @param serviceCtor - The service constructor to add
   * @returns The context instance for method chaining
   *
   * @example
   * ```typescript
   * context
   *   .addService(PlayerService)
   *   .addService(WorldService)
   *   .addService(UIService);
   * ```
   */
  public addService<T extends new (...args: any[]) => RPClientService>(serviceCtor: T): this {
    if (!this.services.has(serviceCtor)) {
      const service = new serviceCtor(this);
      this.services.set(serviceCtor, service);
    }
    return this;
  }

  /**
   * Initializes all registered services.
   *
   * This method calls the init() method on all registered services in the order
   * they were added. It should be called after all services have been registered
   * and before the context is used for business logic.
   *
   * @returns Promise that resolves when all services are initialized
   *
   * @example
   * ```typescript
   * context
   *   .addService(PlayerService)
   *   .addService(WorldService);
   * 
   * await context.init();
   * console.log('All services initialized');
   * ```
   */
  public async init(): Promise<void> {
    if (this.initialized) {
      return;
    }

    this.logger.info('Initializing client context...');

    for (const service of this.services.values()) {
      await service.init();
    }

    this.initialized = true;
    this.logger.info('Client context initialized successfully');
  }

  /**
   * Disposes all registered services and APIs.
   *
   * This method calls the dispose() method on all registered services in reverse
   * order and clears all caches. It should be called when the context is no longer
   * needed to ensure proper cleanup of resources.
   *
   * @returns Promise that resolves when all services are disposed
   *
   * @example
   * ```typescript
   * await context.dispose();
   * console.log('Context disposed');
   * ```
   */
  public async dispose(): Promise<void> {
    this.logger.info('Disposing client context...');

    const services = Array.from(this.services.values()).reverse();
    for (const service of services) {
      await service.dispose();
    }

    this.services.clear();

    this.initialized = false;
    this.logger.info('Client context disposed successfully');
  }
}
