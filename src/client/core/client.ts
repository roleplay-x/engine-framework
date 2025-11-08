import { RPHookBus } from '../../core/bus/hook-bus';
import { defaultLogger, RPLogger } from '../../core/logger';

import { RPClientHooks } from './hooks/hooks';
import { ClientPlatformAdapter } from '../natives/adapters';
import { CustomClientContextOptions } from './types';
import { RPClientContext, RPClientContextCtor, RPClientContextOptions } from './context';
import { EventService } from '../domains/event/service';
import { PlayerService } from '../domains/player/service';
import { HealthService } from '../domains/health/service';
import { SpawnService } from '../domains/spawn/service';
import { CameraService } from '../domains/camera/service';
import { WebViewService } from '../domains/webview/service';
import { UIService } from '../domains/ui/service';
import { CharacterService } from '../domains/character/service';
import { CharacterSelectionScreen, CharacterAppearanceScreen } from '../domains/webview/screens';

/** Configuration options for creating a roleplay client instance */
export interface RPClientOptions {
  /** Unique identifier for this client instance */
  clientId: string;
  /** Custom logger instance (default: console logger) */
  logger?: RPLogger;
}

/** Native integrations and customization options for the client */
export interface RPClientNatives<
  TOptions extends CustomClientContextOptions = CustomClientContextOptions,
  THooks extends RPClientHooks = RPClientHooks,
> {
  /** Custom context type and options */
  customContext?: {
    type: RPClientContextCtor<TOptions, THooks>;
    options: TOptions;
  };
}

/**
 * Main roleplay client class that orchestrates all client functionality.
 *
 * This class provides:
 * - Singleton client instance management
 * - Complete client lifecycle (start, stop)
 * - Service registration and dependency injection
 * - WebSocket connection management
 * - Integration with roleplay engine APIs
 * - Event handling and client-to-server communication
 *
 * The client follows a singleton pattern and must be created using the static
 * create() method before use. It automatically registers all core services
 * and manages their initialization.
 *
 * @example
 * ```typescript
 * // Create and configure the client
 * const client = RPClient.create({
 *   clientId: 'my-roleplay-client'
 * }, {
 *   platformAdapter: new MyPlatformAdapter()
 * });
 *
 * // Start the client
 * await client.start();
 *
 * // Access services through the context
 * const context = client.getContext();
 * const playerService = context.getService(PlayerService);
 *
 * // Stop the client when done
 * client.stop();
 * ```
 */
export class RPClient {
  /** Singleton instance of the client */
  private static instance: RPClient;

  /** Client context containing all services and infrastructure */
  private readonly context: RPClientContext;
  /** Flag to track if shutdown handlers are registered */
  private shutdownHandlersRegistered = false;

  /**
   * Private constructor for singleton pattern.
   * Use RPClient.create() to create an instance.
   *
   * @private
   * @param options - Client configuration options
   * @param natives - Native integrations and adapters
   */
  private constructor(
    options: RPClientOptions,
    natives: RPClientNatives,
    platformAdapter: ClientPlatformAdapter,
  ) {
    const logger = options.logger ?? defaultLogger;
    const hookBus = new RPHookBus<RPClientHooks>();

    const contextType = natives.customContext?.type ?? RPClientContext;
    const contextOptions: RPClientContextOptions & CustomClientContextOptions = {
      clientId: options.clientId,
      hookBus,
      logger,
      platformAdapter,
      ...natives?.customContext?.options,
    };

    this.context = RPClientContext.create(contextType, contextOptions);

    // Core services
    this.registerScreenServices();
    this.context.addService(EventService);
    this.context.addService(PlayerService);
    this.context.addService(HealthService);
    this.context.addService(SpawnService);
    this.context.addService(CameraService);
    this.context.addService(WebViewService);
    this.context.addService(UIService);
    this.context.addService(CharacterService);
  }

  /**
   * Register all screen services
   * Add new screen services here as they are created
   */
  private registerScreenServices(): void {
    this.context.addService(CharacterSelectionScreen);
    this.context.addService(CharacterAppearanceScreen);
  }

  /**
   * Creates a new roleplay client instance.
   *
   * This factory method creates and configures a new client instance with all
   * necessary services and connections. The client follows a singleton pattern,
   * so subsequent calls will replace the previous instance.
   *
   * @param config - Client configuration including API endpoints and credentials
   * @param natives - Native integrations required for game engine communication
   * @returns A new configured client instance
   *
   * @example
   * ```typescript
   * const client = RPClient.create({
   *   clientId: 'my-client'
   * }, {
   *   platformAdapter: new MyPlatformAdapter()
   * });
   * ```
   */
  public static create<
    TOptions extends CustomClientContextOptions = CustomClientContextOptions,
    THooks extends RPClientHooks = RPClientHooks,
  >(
    config: RPClientOptions,
    natives: RPClientNatives<TOptions, THooks>,
    platformAdapter: ClientPlatformAdapter,
  ): RPClient {
    this.instance = new RPClient(config, natives as RPClientNatives, platformAdapter);
    return this.instance;
  }

  /**
   * Gets the singleton client instance.
   *
   * Returns the previously created client instance. The client must be created
   * using RPClient.create() before calling this method.
   *
   * @returns The singleton client instance
   * @throws {Error} When no client instance has been created
   *
   * @example
   * ```typescript
   * // Somewhere in your application after RPClient.create()
   * const client = RPClient.get();
   * const context = client.getContext();
   * ```
   */
  public static get(): RPClient {
    if (!RPClient.instance) {
      throw new Error('RPClient instance is not created. Use RPClient.create() first.');
    }
    return RPClient.instance;
  }

  /**
   * Gets the client context containing all services and infrastructure.
   *
   * The context provides access to all registered services, APIs, and shared
   * infrastructure components. This is the primary way to interact with
   * client functionality.
   *
   * @returns The client context instance
   *
   * @example
   * ```typescript
   * const context = client.getContext();
   * const playerService = context.getService(PlayerService);
   * const account = await playerService.getAccount();
   * ```
   */
  public getContext(): RPClientContext {
    return this.context;
  }

  /**
   * Starts the roleplay client.
   *
   * This method initializes all registered services and registers process signal handlers
   * for graceful shutdown. The client will be ready to handle events after this method completes.
   *
   * @returns Promise that resolves when the client is fully started
   *
   * @example
   * ```typescript
   * const client = RPClient.create(config, natives);
   * await client.start();
   * console.log('Client is ready!');
   * ```
   */
  public async start(): Promise<void> {
    await this.context.init();
    this.registerShutdownHandlers();
  }

  /**
   * Stops the roleplay client gracefully.
   *
   * This method performs a complete graceful shutdown by:
   * 1. Disposing all services in reverse order
   * 2. Cleaning up all resources
   *
   * @returns Promise that resolves when the client is fully stopped
   *
   * @example
   * ```typescript
   * // Gracefully shutdown the client
   * await client.stop();
   * console.log('Client stopped gracefully');
   * ```
   */
  public async stop(): Promise<void> {
    await this.context.dispose();
  }

  /**
   * Registers process signal handlers for graceful shutdown.
   *
   * This method sets up handlers for SIGINT, SIGTERM, and uncaught exceptions
   * to ensure the client shuts down gracefully when the process is terminated.
   * The handlers are only registered once per client instance and only in Node.js environments.
   *
   * @private
   */
  private registerShutdownHandlers(): void {
    if (this.shutdownHandlersRegistered) {
      return;
    }

    this.shutdownHandlersRegistered = true;
  }
}
