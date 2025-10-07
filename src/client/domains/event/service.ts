import { RPClientService } from '../../core/client-service';
import { GameEventName, GameEventArgs } from '../../natives/events/game-events';
import { RPServerToClientEvents, RPClientToServerEvents } from '../../../shared/types';
import { ClientTypes } from '../../core/types';
import {
  ClientEventHookData,
  ServerEventHookData,
  GameEventHookData,
  RPClientHooks,
} from '../../core/hooks/hooks';
import { RPHookBus } from '../../../core/bus/hook-bus';

/**
 * Service for managing events in the roleplay client.
 *
 * This service provides functionality for:
 * - Event listening and handling from server
 * - Event emission to server
 * - Game event management with type safety
 * - Event delegation to other services
 *
 * The service acts as a central hub for all event communication,
 * using the platform's network adapter for actual event handling.
 *
 * @example
 * ```typescript
 * // Listen for server events
 * eventService.onServerEvent('playerSpawned', (data) => {
 *   console.log('Player spawned:', data);
 * });
 *
 * // Emit events to server
 * eventService.emitToServer('requestSpawn', { position: { x: 0, y: 0, z: 0 } });
 *
 * // Listen for game events with type safety
 * eventService.onGameEvent('entityDamage', (victim, attacker, weaponHash, damage) => {
 *   console.log(`Entity ${victim} took ${damage} damage from ${attacker}`);
 * });
 * ```
 */
export class EventService extends RPClientService<ClientTypes> {
  /**
   * Initializes the event service.
   *
   * Sets up event forwarding from the platform adapter to internal event handling.
   */
  public async init(): Promise<void> {
    this.logger.info('Initializing event service...');
    await super.init();
  }

  /**
   * Listens for type-safe server events.
   *
   * @param event - Event name to listen for
   * @param handler - Event handler function with typed data
   */
  public onServerEvent<K extends keyof RPServerToClientEvents>(
    event: K,
    handler: (data: RPServerToClientEvents[K]) => void
  ): void {
    const wrappedHandler = async (data: RPServerToClientEvents[K]) => {
      const shouldContinue = await this.executeServerEventHooks(event as string, data, 'before');
      if (!shouldContinue) {
        return;
      }

      try {
        handler(data);
      } catch (error) {
        this.logger.error(`Error in server event handler for '${String(event)}':`, error);
      }

      await this.executeServerEventHooks(event as string, data, 'after');
    };

    this.platformAdapter.network.onServerEvent(event, wrappedHandler);
  }

  /**
   * Removes server event listener.
   *
   * @param event - Event name
   * @param handler - Event handler function to remove
   */
  public offServerEvent<K extends keyof RPServerToClientEvents>(
    event: K,
    handler: (data: RPServerToClientEvents[K]) => void
  ): void {
    this.platformAdapter.network.onServerEvent(event, handler);
  }

  /**
   * Emits type-safe events to the server.
   *
   * @param event - Event name to emit
   * @param data - Event data with correct type
   */
  public emitToServer<K extends keyof RPClientToServerEvents>(
    event: K,
    data: RPClientToServerEvents[K]
  ): void {
    this.platformAdapter.network.emitToServer(event, data);
  }

  /**
   * Listens for local events.
   *
   * @param event - Event name to listen for
   * @param handler - Event handler function
   */
  public on(event: string, handler: (...args: any[]) => void): void {
    const wrappedHandler = async (...args: any[]) => {
      const shouldContinue = await this.executeClientEventHooks(event, args, 'before');
      if (!shouldContinue) {
        return;
      }

      try {
        handler(...args);
      } catch (error) {
        this.logger.error(`Error in event handler for '${event}':`, error);
      }

      await this.executeClientEventHooks(event, args, 'after');
    };

    this.platformAdapter.network.on(event, wrappedHandler);
  }

  /**
   * Removes event listener.
   *
   * @param event - Event name
   * @param handler - Event handler function to remove
   */
  public off(event: string, handler: (...args: any[]) => void): void {
    this.platformAdapter.network.off(event, handler);
  }

  /**
   * Listens for event once.
   *
   * @param event - Event name to listen for
   * @param handler - Event handler function
   */
  public once(event: string, handler: (...args: any[]) => void): void {
    this.platformAdapter.network.once(event, handler);
  }

  /**
   * Emits local events.
   *
   * @param event - Event name to emit
   * @param args - Event arguments
   */
  public emit(event: string, ...args: any[]): void {
    this.platformAdapter.network.emit(event, ...args);
  }

  /**
   * Removes all event listeners.
   *
   * @param event - Optional event name to remove listeners for
   */
  public removeAllListeners(event?: string): void {
    this.platformAdapter.network.removeAllListeners(event);
  }

  /**
   * Gets listener count for an event.
   *
   * @param event - Event name
   * @returns Number of listeners
   */
  public listenerCount(event: string): number {
    return this.platformAdapter.network.listenerCount(event);
  }

  /**
   * Listens for game events with type safety.
   *
   * @param event - Game event name
   * @param handler - Event handler function with typed arguments
   */
  public onGameEvent<T extends GameEventName>(
    event: T,
    handler: (...args: GameEventArgs<T>) => void,
  ): void {
    const wrappedHandler = async (...args: GameEventArgs<T>) => {
      const shouldContinue = await this.executeGameEventHooks(event, args, 'before');
      if (!shouldContinue) {
        return;
      }

      try {
        handler(...args);
      } catch (error) {
        this.logger.error(`Error in game event handler for '${event}':`, error);
      }

      await this.executeGameEventHooks(event, args, 'after');
    };

    this.platformAdapter.network.onGameEvent(event, wrappedHandler);
  }

  /**
   * Removes game event listener.
   *
   * @param event - Game event name
   * @param handler - Event handler function to remove
   */
  public offGameEvent<T extends GameEventName>(
    event: T,
    handler: (...args: GameEventArgs<T>) => void,
  ): void {
    this.platformAdapter.network.offGameEvent(event, handler);
  }

  /**
   * Maps a platform-specific event to a game event.
   *
   * @param platformEvent - Platform-specific event name
   * @param gameEvent - Game event name to map to
   */
  public mapPlatformEvent(platformEvent: string, gameEvent: GameEventName): void {
    this.platformAdapter.network.mapPlatformEvent(platformEvent, gameEvent);
  }

  /**
   * Unmaps a platform-specific event.
   *
   * @param platformEvent - Platform-specific event name
   */
  public unmapPlatformEvent(platformEvent: string): void {
    this.platformAdapter.network.unmapPlatformEvent(platformEvent);
  }

  /**
   * Gets the mapped game event for a platform event.
   *
   * @param platformEvent - Platform-specific event name
   * @returns Mapped game event name or null
   */
  public getMappedGameEvent(platformEvent: string): GameEventName | null {
    return this.platformAdapter.network.getMappedGameEvent(platformEvent);
  }

  /**
   * Sets up event forwarding from platform adapter.
   *
   * This method forwards all events from the platform's network adapter
   * to internal event handling mechanisms.
   *
   * @private
   */
  private setupEventForwarding(): void {
    this.logger.info('Event forwarding setup completed');
  }

  /**
   * Executes hooks with proper type safety.
   *
   * @param hookName - Name of the hook to execute
   * @param hookData - Data to pass to the hook
   * @private
   */
  private async executeHook(hookName: keyof RPClientHooks, hookData: any): Promise<void> {
    try {
      const hookBus = this.hookBus as RPHookBus<RPClientHooks>;

      await hookBus.run(hookName, hookData as never);
    } catch (error) {
      this.logger.error(`Error executing hook ${String(hookName)}:`, error);
    }
  }

  /**
   * Executes hooks for client events.
   *
   * @param event - Event name
   * @param data - Event data
   * @param phase - Hook phase (before or after)
   * @returns Promise that resolves to whether the event should continue
   * @private
   */
  private async executeClientEventHooks(
    event: string,
    data: any,
    phase: 'before' | 'after',
  ): Promise<boolean> {
    const hookData: ClientEventHookData = {
      event,
      data,
      preventDefault: () => {
        /* Will be set by hook system */
      },
      stopPropagation: () => {
        /* Will be set by hook system */
      },
    };

    let shouldContinue = true;
    let shouldStopPropagation = false;

    hookData.preventDefault = () => {
      shouldContinue = false;
    };
    hookData.stopPropagation = () => {
      shouldStopPropagation = true;
    };

    try {
      if (phase === 'before') {
        await this.executeHook('beforeClientEvent', hookData);
        await this.executeHook('beforeEvent', hookData);
      } else {
        await this.executeHook('afterClientEvent', hookData);
        await this.executeHook('afterEvent', hookData);
      }
    } catch (error) {
      this.logger.error('Error executing client event hooks:', error);
    }

    return shouldContinue && !shouldStopPropagation;
  }

  /**
   * Executes hooks for server events.
   *
   * @param event - Event name
   * @param data - Event data
   * @param phase - Hook phase (before or after)
   * @returns Promise that resolves to whether the event should continue
   * @private
   */
  private async executeServerEventHooks(
    event: string,
    data: any,
    phase: 'before' | 'after',
  ): Promise<boolean> {
    const hookData: ServerEventHookData = {
      event,
      data,
      preventDefault: () => {
        /* Will be set by hook system */
      },
      stopPropagation: () => {
        /* Will be set by hook system */
      },
    };

    let shouldContinue = true;
    let shouldStopPropagation = false;

    hookData.preventDefault = () => {
      shouldContinue = false;
    };
    hookData.stopPropagation = () => {
      shouldStopPropagation = true;
    };

    try {
      if (phase === 'before') {
        await this.executeHook('beforeServerEvent', hookData);
        await this.executeHook('beforeEvent', hookData);
      } else {
        await this.executeHook('afterServerEvent', hookData);
        await this.executeHook('afterEvent', hookData);
      }
    } catch (error) {
      this.logger.error('Error executing server event hooks:', error);
    }

    return shouldContinue && !shouldStopPropagation;
  }

  /**
   * Executes hooks for game events.
   *
   * @param event - Game event name
   * @param args - Event arguments
   * @param phase - Hook phase (before or after)
   * @returns Promise that resolves to whether the event should continue
   * @private
   */
  private async executeGameEventHooks<T extends GameEventName>(
    event: T,
    args: GameEventArgs<T>,
    phase: 'before' | 'after',
  ): Promise<boolean> {
    const hookData: GameEventHookData<T> = {
      event,
      args,
      preventDefault: () => {
        /* Will be set by hook system */
      },
      stopPropagation: () => {
        /* Will be set by hook system */
      },
    };

    let shouldContinue = true;
    let shouldStopPropagation = false;

    hookData.preventDefault = () => {
      shouldContinue = false;
    };
    hookData.stopPropagation = () => {
      shouldStopPropagation = true;
    };

    try {
      if (phase === 'before') {
        await this.executeHook('beforeGameEvent', hookData);
        await this.executeHook('beforeEvent', hookData);
      } else {
        await this.executeHook('afterGameEvent', hookData);
        await this.executeHook('afterEvent', hookData);
      }
    } catch (error) {
      this.logger.error('Error executing game event hooks:', error);
    }

    return shouldContinue && !shouldStopPropagation;
  }
}
