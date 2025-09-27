import { ApiKeyAuthorization, EngineClient } from '@roleplayx/engine-sdk';

import { RPEventEmitter } from '../core/bus/event-emitter';
import { RPHookBus } from '../core/bus/hook-bus';
import { defaultLogger, RPLogger } from '../core/logger';

import { RPServerEvents } from './core/events/events';
import { RPServerHooks } from './core/hooks/hooks';
import { EngineSocket } from './socket/socket';
import { SessionService } from './domains/session/service';
import { RPServerContext, RPServerContextCtor, RPServerContextOptions } from './core/context';
import { CustomServerContextOptions } from './core/types';
import { AccountService } from './domains/account/service';
import { ConfigurationService } from './domains/configuration/service';
import { LocalizationService } from './domains/localization/service';
import { WorldService } from './domains/world/service';
import { ReferenceService } from './domains/reference/service';
import { ApiControllerCtor, ApiServer, ApiServerConfig } from './api';
import { AccountController } from './domains/account/api.controller';
import { HealthController } from './api/controllers/health.controller';
import { SessionController } from './domains/session/api.controller';
import { PlatformAdapter } from './natives/adapters';

/** Configuration options for creating a roleplay server instance */
export interface RPServerOptions {
  /** Unique identifier for this server instance */
  serverId: string;
  /** Base URL for the roleplay engine API */
  apiUrl: string;
  /** WebSocket URL for real-time communication */
  socketUrl: string;
  /** API key identifier for authentication */
  apiKeyId: string;
  /** API key secret for authentication */
  apiKeySecret: string;
  /** Request timeout in milliseconds (default: 10000) */
  timeout?: number;
  /** Custom logger instance (default: console logger) */
  logger?: RPLogger;
  /** API server configuration */
  api: ApiServerConfig;
}

/** Native integrations and customization options for the server */
export interface RPServerNatives<
  TOptions extends CustomServerContextOptions = CustomServerContextOptions,
  TEvents extends RPServerEvents = RPServerEvents,
  THooks extends RPServerHooks = RPServerHooks,
> {
  /** Optional custom server context configuration */
  customContext?: {
    /** Custom context constructor type */
    type: RPServerContextCtor<TOptions, TEvents, THooks>;
    /** Additional options for the custom context */
    options: TOptions;
  };
}

/**
 * Main roleplay server class that orchestrates all server functionality.
 *
 * This class provides:
 * - Singleton server instance management
 * - Complete server lifecycle (start, stop)
 * - Service registration and dependency injection
 * - WebSocket connection management
 * - Integration with roleplay engine APIs
 * - Event handling and server-to-client communication
 *
 * The server follows a singleton pattern and must be created using the static
 * create() method before use. It automatically registers all core services
 * (Account, Session, World, Configuration, Localization, Reference, etc.) and
 * manages their initialization.
 *
 * @example
 * ```typescript
 * // Create and configure the server
 * const server = RPServer.create({
 *   serverId: 'my-roleplay-server',
 *   apiUrl: 'https://api.eu-central-nova.roleplayx.com',
 *   socketUrl: 'wss://socket.eu-central-nova.roleplayx.com',
 *   apiKeyId: 'your-api-key-id',
 *   apiKeySecret: 'your-api-key-secret',
 *   timeout: 15000
 * }, {
 *   s2cEventsAdapter: new MyS2CEventsAdapter()
 * });
 *
 * // Start the server
 * await server.start();
 *
 * // Access services through the context
 * const context = server.getContext();
 * const accountService = context.getService(AccountService);
 *
 * // Stop the server when done
 * server.stop();
 * ```
 */
export class RPServer {
  /** Singleton instance of the server */
  private static instance: RPServer;

  /** Server context containing all services and infrastructure */
  private readonly context: RPServerContext;
  /** WebSocket connection to the roleplay engine */
  private readonly socket: EngineSocket;
  /** API server instance */
  private readonly apiServer?: ApiServer;
  /** Registered API controllers */
  private readonly apiControllers: ApiControllerCtor[] = [];
  /** Flag to track if shutdown handlers are registered */
  private shutdownHandlersRegistered = false;

  /**
   * Private constructor for singleton pattern.
   * Use RPServer.create() to create an instance.
   *
   * @private
   * @param options - Server configuration options
   * @param natives - Native integrations and adapters
   */
  private constructor(options: RPServerOptions, natives: RPServerNatives, platformAdapter: PlatformAdapter) {
    const logger = options.logger ?? defaultLogger;
    const engineClient = new EngineClient(
      {
        apiUrl: options.apiUrl,
        serverId: options.serverId,
        timeout: options.timeout,
        applicationName: 'gamemode',
      },
      new ApiKeyAuthorization(options.apiKeyId, options.apiKeySecret),
    );

    const eventEmitter = new RPEventEmitter<RPServerEvents>();
    const hookBus = new RPHookBus<RPServerHooks>();

    this.socket = new EngineSocket(
      {
        url: options.socketUrl,
        serverId: options.serverId,
        apiKeyId: options.apiKeyId,
        apiKeySecret: options.apiKeySecret,
      },
      eventEmitter,
      logger,
    );

    const contextType = natives.customContext?.type ?? RPServerContext;
    const contextOptions: RPServerContextOptions & CustomServerContextOptions = {
      engineClient,
      eventEmitter,
      hookBus,
      logger,
      platformAdapter,
      ...natives?.customContext?.options,

    };

    this.context = RPServerContext.create(contextType, contextOptions);
    this.context
      .addService(ConfigurationService)
      .addService(LocalizationService)
      .addService(WorldService)
      .addService(SessionService)
      .addService(ReferenceService)
      .addService(AccountService);

    this.apiServer = new ApiServer(this.context, options.api);
    this.registerController(HealthController)
      .registerController(AccountController)
      .registerController(SessionController);
  }

  /**
   * Creates a new roleplay server instance.
   *
   * This factory method creates and configures a new server instance with all
   * necessary services and connections. The server follows a singleton pattern,
   * so subsequent calls will replace the previous instance.
   *
   * @param config - Server configuration including API endpoints and credentials
   * @param natives - Native integrations required for game engine communication
   * @returns A new configured server instance
   *
   * @example
   * ```typescript
   * const server = RPServer.create({
   *   serverId: 'my-server',
   *   apiUrl: 'https://api.eu-central-nova.roleplayx.com',
   *   socketUrl: 'wss://socket.eu-central-nova.roleplayx.com',
   *   apiKeyId: 'your-key-id',
   *   apiKeySecret: 'your-key-secret'
   * }, {
   *   s2cEventsAdapter: new MyS2CEventsAdapter()
   * });
   * ```
   */
  public static create<
    TOptions extends CustomServerContextOptions = CustomServerContextOptions,
    TEvents extends RPServerEvents = RPServerEvents,
    THooks extends RPServerHooks = RPServerHooks,
  >(config: RPServerOptions, natives: RPServerNatives<TOptions, TEvents, THooks>, platformAdapter: PlatformAdapter): RPServer {
    this.instance = new RPServer(config, natives as RPServerNatives, platformAdapter);
    return this.instance;
  }

  /**
   * Gets the singleton server instance.
   *
   * Returns the previously created server instance. The server must be created
   * using RPServer.create() before calling this method.
   *
   * @returns The singleton server instance
   * @throws {Error} When no server instance has been created
   *
   * @example
   * ```typescript
   * // Somewhere in your application after RPServer.create()
   * const server = RPServer.get();
   * const context = server.getContext();
   * ```
   */
  public static get(): RPServer {
    if (!RPServer.instance) {
      throw new Error('RPServer instance is not created. Use RPServer.create() first.');
    }
    return RPServer.instance;
  }

  /**
   * Registers an API controller with the server.
   * Controllers must be registered before the server starts.
   *
   * @param controllerCtor - The controller class constructor
   * @returns The server instance for method chaining
   *
   * @example
   * ```typescript
   * server
   *   .registerController(HealthController)
   *   .registerController(SessionController);
   * ```
   */
  public registerController(controllerCtor: ApiControllerCtor): this {
    if (!this.apiServer) {
      throw new Error('API server is not configured. Set api options in RPServerOptions.');
    }
    this.apiControllers.push(controllerCtor);
    return this;
  }

  /**
   * Starts the roleplay server.
   *
   * This method initializes the WebSocket connection to the roleplay engine
   * and starts all registered services. It also registers process signal handlers
   * for graceful shutdown. The server will be ready to handle events and API
   * requests after this method completes.
   *
   * @returns Promise that resolves when the server is fully started
   *
   * @example
   * ```typescript
   * const server = RPServer.create(config, natives);
   * await server.start();
   * console.log('Server is ready!');
   * ```
   */
  public async start(): Promise<void> {
    await this.socket.start();
    await this.context.init();

    if (this.apiServer) {
      for (const controller of this.apiControllers) {
        this.apiServer.registerController(controller);
      }
      await this.apiServer.start();
    }

    this.registerShutdownHandlers();
  }

  /**
   * Stops the roleplay server gracefully.
   *
   * This method performs a complete graceful shutdown by:
   * 1. Stopping the API server if configured
   * 2. Disposing all services in reverse order
   * 3. Closing the WebSocket connection to the roleplay engine
   * 4. Cleaning up all resources
   *
   * @returns Promise that resolves when the server is fully stopped
   *
   * @example
   * ```typescript
   * // Gracefully shutdown the server
   * await server.stop();
   * console.log('Server stopped gracefully');
   * ```
   */
  public async stop(): Promise<void> {
    try {
      if (this.apiServer) {
        await this.apiServer.stop();
      }

      await this.context.dispose();
    } catch (error) {
      this.context.logger.error('Error during service disposal:', error);
    }

    this.socket.close(1000, 'Normal closure');
  }

  /**
   * Gets the server context for accessing services.
   *
   * The context provides dependency injection and service management.
   * Use this to access any of the registered services (Account, Session,
   * World, Configuration, etc.).
   *
   * @template C - The context type (for custom contexts)
   * @returns The server context instance
   *
   * @example
   * ```typescript
   * const context = server.getContext();
   * const accountService = context.getService(AccountService);
   * const sessionService = context.getService(SessionService);
   *
   * // For custom contexts
   * const customContext = server.getContext<MyCustomContext>();
   * ```
   */
  public getContext<C extends RPServerContext>(): C {
    return this.context as C;
  }

  /**
   * Gets the API server instance if configured.
   *
   * @returns The API server instance or undefined if not configured
   */
  public getApiServer(): ApiServer | undefined {
    return this.apiServer;
  }

  /**
   * Registers process signal handlers for graceful shutdown.
   *
   * This method sets up listeners for SIGTERM, SIGINT, and SIGHUP signals
   * to ensure the server shuts down gracefully when receiving system signals.
   * This is especially important in containerized environments.
   *
   * @private
   */
  private registerShutdownHandlers(): void {
    if (this.shutdownHandlersRegistered) {
      return;
    }

    const gracefulShutdown = async (signal: string) => {
      this.context.logger.info(`Received ${signal}, initiating graceful shutdown...`);
      try {
        await this.stop();
        this.context.logger.info('Server shutdown completed successfully');
        process.exit(0);
      } catch (error) {
        this.context.logger.error('Error during graceful shutdown:', error);
        process.exit(1);
      }
    };

    // Handle graceful shutdown signals
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('SIGHUP', () => gracefulShutdown('SIGHUP'));

    // Handle uncaught exceptions and unhandled rejections
    process.on('uncaughtException', (error) => {
      this.context.logger.error('Uncaught exception:', error);
      void gracefulShutdown('uncaughtException');
    });

    process.on('unhandledRejection', (reason, promise) => {
      this.context.logger.error(
        `Unhandled rejection at promise: ${String(promise)}, reason:`,
        reason,
      );
      void gracefulShutdown('unhandledRejection');
    });

    this.shutdownHandlersRegistered = true;
  }
}
