import { RPHookBus } from '../../core/bus/hook-bus';
import { RPLogger } from '../../core/logger';
import { RPClientContext } from './context';
import { getEventHandlers } from './events/decorators';
import { ClientTypes } from './types';
import { GameEventName } from '../natives/events/game-events';

export type RPClientEventHandlerMethods = {
  [K in string]?: ((...args: any[]) => void)[];
};

/**
 * Abstract base class for all client services in the Roleplay Engine.
 *
 * This class provides core functionality for services including:
 * - Event handling with automatic decorator binding
 * - Access to shared infrastructure (event emitter, hook bus, logger)
 * - Service and API resolution through the client context
 * - Lifecycle management with initialization support
 *
 * Services extend this class to implement domain-specific functionality
 * such as player management, world handling, UI management, etc.
 *
 * @template C - The client context type (defaults to RPClientContext)
 *
 * @example
 * ```typescript
 * export class MyService extends RPClientService {
 *   public async init(): Promise<void> {
 *     // Initialize service-specific resources
 *     await super.init();
 *   }
 *
 *   @OnClient('playerSpawned')
 *   private async onPlayerSpawned(payload: RPPlayerSpawned) {
 *     // Handle player spawn event
 *   }
 * }
 * ```
 *
 * @example With custom context
 * ```typescript
 * export class PlayerService extends RPClientService<GameClientContext> {
 *   // this.context is now typed as GameClientContext
 *   public getPlayer() {
 *     return this.context.player;
 *   }
 * }
 * ```
 */
export abstract class RPClientService<T extends ClientTypes = ClientTypes> {
  public readonly eventHandlers: RPClientEventHandlerMethods;

  /**
   * Creates a new client service instance.
   *
   * @param context - The client context containing shared infrastructure
   */
  constructor(protected readonly context: RPClientContext<any, T['hooks']>) {
    this.eventHandlers = this.getEventHandlers();
  }

  /**
   * Gets the logger instance for this service.
   *
   * @returns The logger instance
   */
  protected get logger(): RPLogger {
    return this.context.logger;
  }

  /**
   * Gets the event service for this service.
   *
   * @returns The event service instance
   */
  protected get eventService() {
    const { EventService } = require('../domains/event/service');
    return this.context.getService(EventService);
  }

  /**
   * Gets the hook bus for this service.
   *
   * @returns The hook bus instance
   */
  protected get hookBus(): RPHookBus<T['hooks']> {
    return this.context.hookBus;
  }

  /**
   * Gets the platform adapter for this service.
   *
   * @returns The platform adapter instance
   */
  protected get platformAdapter(): T['platformAdapter'] {
    return this.context.platformAdapter;
  }

  /**
   * Initializes the service.
   *
   * This method is called during client startup after all services have been
   * registered. Override this method to perform service-specific initialization
   * such as setting up event listeners, loading configuration, or connecting
   * to external services.
   *
   * @returns Promise that resolves when initialization is complete
   *
   * @example
   * ```typescript
   * public async init(): Promise<void> {
   *   // Set up event listeners
   *   this.eventEmitter.on('playerSpawned', this.onPlayerSpawned.bind(this));
   *
   *   // Load configuration
   *   await this.loadConfig();
   *
   *   // Call parent implementation
   *   await super.init();
   * }
   * ```
   */
  public async init(): Promise<void> {
    this.bindEventHandlers();
  }

  /**
   * Disposes the service.
   *
   * This method is called during client shutdown to clean up resources.
   * Override this method to perform service-specific cleanup such as
   * removing event listeners, closing connections, or saving state.
   *
   * @returns Promise that resolves when disposal is complete
   *
   * @example
   * ```typescript
   * public async dispose(): Promise<void> {
   *   // Remove event listeners
   *   this.eventEmitter.off('playerSpawned', this.onPlayerSpawned);
   *
   *   // Save state
   *   await this.saveState();
   *
   *   // Call parent implementation
   *   await super.dispose();
   * }
   * ```
   */
  public async dispose(): Promise<void> {
    this.unbindEventHandlers();
  }

  /**
   * Gets event handlers from the service instance.
   *
   * This method uses reflection to find all methods decorated with @OnClient
   * and returns them as a map of event names to handler methods.
   *
   * @returns Map of event handlers
   * @private
   */
  private getEventHandlers(): RPClientEventHandlerMethods {
    const handlers: RPClientEventHandlerMethods = {};

    const eventHandlers = getEventHandlers(this as Record<string, unknown>);

    for (const [event, handlerList] of Object.entries(eventHandlers)) {
      if (Array.isArray(handlerList)) {
        handlers[event] = handlerList.map((handler) => handler.bind(this));
      }
    }

    return handlers;
  }

  /**
   * Binds event handlers to the event service.
   *
   * This method registers all event handlers found by getEventHandlers()
   * with the event service.
   *
   * @private
   */
  private bindEventHandlers(): void {
    for (const [event, handlerList] of Object.entries(this.eventHandlers)) {
      if (handlerList && Array.isArray(handlerList)) {
        for (const handler of handlerList) {
          if (event.startsWith('server:')) {
            const serverEvent = event.replace('server:', '');
            this.eventService.onServerEvent(serverEvent, handler);
          } else if (event.startsWith('game:')) {
            const gameEvent = event.replace('game:', '') as GameEventName;
            this.eventService.onGameEvent(gameEvent, handler);
          } else {
            this.eventService.on(event, handler);
          }
        }
      }
    }
  }

  /**
   * Unbinds event handlers from the event service.
   *
   * This method removes all event handlers from the event service.
   *
   * @private
   */
  private unbindEventHandlers(): void {
    for (const [event, handlerList] of Object.entries(this.eventHandlers)) {
      if (handlerList && Array.isArray(handlerList)) {
        for (const handler of handlerList) {
          if (event.startsWith('server:')) {
            const serverEvent = event.replace('server:', '');
            this.eventService.off(serverEvent, handler);
          } else if (event.startsWith('game:')) {
            const gameEvent = event.replace('game:', '') as GameEventName;
            this.eventService.offGameEvent(gameEvent, handler);
          } else {
            this.eventService.off(event, handler);
          }
        }
      }
    }
  }
}
