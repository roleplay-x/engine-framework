import { RPClientService } from '../../core/client-service';
import { OnClient, OnServer } from '../../core/events/decorators';
import { ClientTypes } from '../../core/types';
import { Vector3 } from '../../../shared';
import {
  RPAllClientEvents,
  RPServerToClientEvents,
  SpawnData,
  CameraData,
} from '../../core/events/types';

/**
 * Interface for spawn request options
 */
export interface SpawnRequestOptions {
  spawnPointId?: string;
  position?: Vector3;
  heading?: number;
  model?: string | number;
}

/**
 * Service for managing player spawning in the roleplay client.
 *
 * This service provides functionality for:
 * - Handling spawn events from server
 * - Requesting spawns from server
 * - Managing spawn state and callbacks
 * - Coordinating with platform adapter for actual spawning
 *
 * @example
 * ```typescript
 * const spawnService = context.getService(SpawnService);
 *
 * // Request spawn at specific position
 * spawnService.requestSpawn({
 *   position: new Vector3(0, 0, 0),
 *   heading: 0,
 *   model: 'mp_m_freemode_01'
 * });
 *
 * // Request spawn at spawn point
 * spawnService.requestSpawn({ spawnPointId: 'spawn_1' });
 * ```
 */
export class SpawnService extends RPClientService<ClientTypes> {
  private isSpawning = false;
  private spawnCallbacks = new Map<string, () => void>();
  private currentSpawnData: SpawnData | null = null;

  /**
   * Initializes the spawn service.
   */
  public async init(): Promise<void> {
    this.logger.info('Initializing spawn service...');
    await super.init();
  }

  /**
   * Requests a spawn from the server.
   *
   * @param options - Spawn request options
   * @returns Promise that resolves when spawn request is sent
   */
  public async requestSpawn(options: SpawnRequestOptions = {}): Promise<void> {
    if (this.isSpawning) {
      this.logger.warn('Spawn request ignored - already spawning');
      return;
    }

    this.logger.info('Requesting spawn from server', { options });

    const payload = {
      spawnPointId: options.spawnPointId,
    };

    this.eventService.emitToServer('spawn:request', payload);
  }

  /**
   * Handles spawn execution from server.
   *
   * @param data - Spawn data from server
   */
  @OnClient('spawn:execute')
  public async onSpawnExecute(data: RPServerToClientEvents['spawn:execute']): Promise<void> {
    this.logger.info('Received spawn execution from server', { data });

    this.isSpawning = true;
    this.currentSpawnData = data;

    await this.executeSpawn(data);
  }

  /**
   * Handles spawn failure from server.
   *
   * @param data - Spawn failure data
   */
  @OnClient('spawn:failed')
  public onSpawnFailed(data: RPServerToClientEvents['spawn:failed']): void {
    this.logger.error('Spawn failed:', data.error);

    this.isSpawning = false;
    this.currentSpawnData = null;

    this.eventService.emitToServer('spawn:failed', data);
  }

  /**
   * Handles player initialization from server.
   *
   * @param data - Player initialization data
   */
  @OnClient('player:initialize')
  public async onPlayerInitialize(
    data: RPServerToClientEvents['player:initialize'],
  ): Promise<void> {
    this.logger.info('Received player initialization from server', { data });

    await this.executeSpawn(data);
  }

  /**
   * Handles player ready event from server.
   */
  @OnClient('player:ready')
  public onPlayerReady(data: RPServerToClientEvents['player:ready']): void {
    this.logger.info('Player ready event received');

    this.eventService.emitToServer('player:ready');
  }

  /**
   * Handles player spawned confirmation.
   */
  @OnClient('player:spawned')
  public onPlayerSpawned(data: RPServerToClientEvents['player:spawned']): void {
    this.logger.info('Player spawned successfully');

    this.isSpawning = false;
    this.currentSpawnData = null;

    this.eventService.emitToServer('player:spawned');
  }

  /**
   * Handles first initialization completed event.
   */
  @OnClient('player:firstInitCompleted')
  public onFirstInitCompleted(data: RPServerToClientEvents['player:firstInitCompleted']): void {
    this.logger.info('First initialization completed');

    this.eventService.emitToServer('player:firstInitCompleted');
  }

  /**
   * Executes the actual spawn using platform adapter.
   *
   * @param data - Spawn data
   * @private
   */
  private async executeSpawn(data: SpawnData): Promise<void> {
    try {
      this.logger.info('Executing spawn', { data });

      if (data.model) {
        await this.platformAdapter.player.setPlayerModel(data.model);
      }

      this.platformAdapter.player.setEntityPosition(
        this.platformAdapter.player.getPlayerPed(),
        data.position,
        false,
      );

      this.platformAdapter.player.setEntityHeading(
        this.platformAdapter.player.getPlayerPed(),
        data.heading,
      );

      if (!data.skipFade) {
        await this.platformAdapter.core.fadeScreen(false, 1000);
        await this.platformAdapter.core.fadeScreen(true, 1000);
      }

      this.platformAdapter.player.setPlayerControl(true);
      this.platformAdapter.player.setPlayerInvincible(false);

      this.platformAdapter.player.setPlayerHealth(200);

      this.logger.info('Spawn execution completed successfully');

      this.eventService.emit('player:spawned', data);
    } catch (error) {
      this.logger.error('Spawn execution failed:', error);
      this.eventService.emitToServer('spawn:failed', {
        error: error instanceof Error ? error.message : 'Unknown spawn error',
      });
    }
  }

  /**
   * Gets current spawn state.
   *
   * @returns Whether currently spawning
   */
  public isCurrentlySpawning(): boolean {
    return this.isSpawning;
  }

  /**
   * Gets current spawn data.
   *
   * @returns Current spawn data or null
   */
  public getCurrentSpawnData(): SpawnData | null {
    return this.currentSpawnData;
  }

  /**
   * Sets a callback for spawn completion.
   *
   * @param callbackId - Unique callback identifier
   * @param callback - Callback function
   */
  public setSpawnCallback(callbackId: string, callback: () => void): void {
    this.spawnCallbacks.set(callbackId, callback);
  }

  /**
   * Removes a spawn callback.
   *
   * @param callbackId - Callback identifier to remove
   */
  public removeSpawnCallback(callbackId: string): void {
    this.spawnCallbacks.delete(callbackId);
  }

  /**
   * Clears all spawn callbacks.
   */
  public clearSpawnCallbacks(): void {
    this.spawnCallbacks.clear();
  }

  /**
   * Forces a respawn at current position.
   */
  public forceRespawn(): void {
    this.logger.info('Force respawn requested');

    const currentPosition = this.platformAdapter.player.getEntityCoords(
      this.platformAdapter.player.getPlayerPed(),
    );

    this.requestSpawn({
      position: currentPosition,
      heading: 0,
    });
  }

  /**
   * Disposes the spawn service.
   */
  public async dispose(): Promise<void> {
    this.logger.info('Disposing spawn service...');

    this.clearSpawnCallbacks();
    this.isSpawning = false;
    this.currentSpawnData = null;

    await super.dispose();
  }
}
