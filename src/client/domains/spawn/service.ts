import { RPClientService } from '../../core/client-service';
import { OnServer } from '../../core/events/decorators';
import { ClientTypes } from '../../core/types';
import { Vector3 } from '../../../shared';
import {
  SpawnData,
  RPServerToClientEvents,
} from '../../../shared/types';
import { ScreenType } from '@roleplayx/engine-ui-sdk';
import { TemplateCategoryId } from '@roleplayx/engine-sdk';
import { EventService } from '../event/service';
import { WebViewService } from '../webview/service';

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
  private selectedSpawnLocationId: string | null = null;
  private selectedSpawnLocationCameraId: string | undefined = undefined;

  /**
   * Initializes the spawn service.
   */
  public async init(): Promise<void> {
    this.logger.info('Initializing spawn service...');
    this.setupEventListeners();
    await super.init();
  }

  private setupEventListeners(): void {
  }

  /**
   * Handles spawn location preview event.
   * Updates camera based on the selected spawn location's cameraId.
   * If cameraId is undefined, shows screen camera (e.g., for "Character Last Position").
   *
   * This method is called from the spawn location selection screen when a location is selected.
   *
   * @param payload - Spawn location preview payload containing optional cameraId and spawnLocationId
   */
  public handleSpawnLocationPreview(payload: { cameraId?: string; spawnLocationId?: string }): void {
    this.logger.info('[SpawnService] Handling spawn location preview', payload);

    const cameraId = payload.cameraId;
    const spawnLocationId = payload.spawnLocationId;

    if (spawnLocationId) {
      this.selectedSpawnLocationId = spawnLocationId;
    }
    this.selectedSpawnLocationCameraId = cameraId;

    if (cameraId === undefined || cameraId === null) {
      this.logger.info('[SpawnService] Showing screen camera (cameraId undefined)');
      this.eventService.emitToServer('spawn:requestCamera', {
        screenType: ScreenType.SpawnLocationSelection,
      });
    } else {
      this.logger.info('[SpawnService] Setting camera from WorldService', { cameraId });
      this.eventService.emitToServer('spawn:requestCamera', {
        cameraId: cameraId as string,
        screenType: ScreenType.SpawnLocationSelection,
      });
    }
  }

  @OnServer('spawnExecute')
  public async onSpawnExecute(data: RPServerToClientEvents['spawnExecute']): Promise<void> {
    this.logger.info('[SpawnService] Received spawn execute event from server', data);
    
    if (this.isSpawning) {
      this.logger.warn('[SpawnService] Spawn already in progress, ignoring new spawn request');
      return;
    }

    this.isSpawning = true;
    
    const position = new Vector3(data.position.x, data.position.y, data.position.z);
    const spawnData: SpawnData = {
      position,
      heading: data.heading,
      model: data.model,
      skipFade: data.skipFade,
    };
    
    this.currentSpawnData = spawnData;
    
    try {
      await this.executeSpawn(spawnData);
      
      this.spawnCallbacks.forEach((callback) => {
        try {
          callback();
        } catch (error) {
          this.logger.error('[SpawnService] Error in spawn callback:', error);
        }
      });
    } finally {
      this.isSpawning = false;
      this.currentSpawnData = null;
    }
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

    this.eventService.emitToServer('spawnRequest', payload);
  }

  /**
   * Executes the actual spawn using platform adapter.
   *
   * @param data - Spawn data
   * @private
   */
  public async executeSpawn(data: SpawnData): Promise<void> {
    try {
      this.logger.info('Executing spawn', { data });
      this.platformAdapter.core.shutdownLoadingScreen();

      if (data.model) {
        await this.platformAdapter.player.setPlayerModel(data.model);
      }

      const playerPed = this.platformAdapter.player.getPlayerPed();
      
      const position = new Vector3(data.position.x, data.position.y, data.position.z);
      
      this.platformAdapter.player.setEntityPosition(playerPed, position, false);
      this.platformAdapter.player.setEntityHeading(playerPed, data.heading);
      this.platformAdapter.player.setEntityVisible(playerPed, true);

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
      this.eventService.emitToServer('spawnFailed', {
        error: error instanceof Error ? error.message : 'Unknown spawn error',
      });
    }
  }

  /**
   * Spawns player with new model at specified position (for character preview)
   */
  public async spawnForPreview(model: string, position: Vector3, heading: number): Promise<void> {
    await this.executeSpawn({
      position,
      heading,
      model,
      skipFade: true,
    });
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
   * Gets the selected spawn location ID.
   *
   * @returns The selected spawn location ID or null
   */
  public getSelectedSpawnLocationId(): string | null {
    return this.selectedSpawnLocationId;
  }

  /**
   * Gets the selected spawn location camera ID.
   *
   * @returns The selected spawn location camera ID or undefined
   */
  public getSelectedSpawnLocationCameraId(): string | undefined {
    return this.selectedSpawnLocationCameraId;
  }

  /**
   * Clears the selected spawn location information.
   */
  public clearSelectedSpawnLocation(): void {
    this.selectedSpawnLocationId = null;
    this.selectedSpawnLocationCameraId = undefined;
  }

  /**
   * Disposes the spawn service.
   */
  public async dispose(): Promise<void> {
    this.logger.info('Disposing spawn service...');

    this.clearSpawnCallbacks();
    this.clearSelectedSpawnLocation();
    this.isSpawning = false;
    this.currentSpawnData = null;

    await super.dispose();
  }
}
