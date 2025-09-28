import {
  CameraApi,
  CreateCameraRequest,
  CreateSoundRequest,
  SoundApi,
  ConfigKey,
} from '@roleplayx/engine-sdk';

import { RPServerService } from '../../core/server-service';
import { OnServer } from '../../core/events/decorators';
import { SocketCameraCreated } from '../../socket/events/socket-camera-created';
import { SocketCameraUpdated } from '../../socket/events/socket-camera-updated';
import { SocketCameraEnabled } from '../../socket/events/socket-camera-enabled';
import { SocketCameraDisabled } from '../../socket/events/socket-camera-disabled';
import { SocketSoundCreated } from '../../socket/events/socket-sound-created';
import { SocketSoundUpdated } from '../../socket/events/socket-sound-updated';
import { SocketSoundEnabled } from '../../socket/events/socket-sound-enabled';
import { SocketSoundDisabled } from '../../socket/events/socket-sound-disabled';

import { RPSound, SoundId } from './models/sound';
import { CameraId, RPCamera } from './models/camera';
import { ConfigurationService } from '../configuration/service';
import { PlayerId } from '../session/models/session';
import { PlatformAdapter } from '../../natives/adapters/platform.adapter';

/**
 * Service for managing world elements like cameras and sounds in the roleplay server.
 *
 * This service provides functionality for:
 * - Camera management (create, retrieve, enable/disable)
 * - Sound management (create, retrieve, enable/disable)
 * - World element caching and synchronization
 * - Real-time updates through socket events
 *
 * The service maintains local caches of cameras and sounds that are automatically
 * synchronized with the roleplay engine. It handles the complete lifecycle of
 * world elements from creation through updates and state changes.
 *
 * @example
 * ```typescript
 * // Create a new camera
 * const camera = await worldService.createCamera({
 *   name: 'Security Camera 1',
 *   position: { x: 100, y: 200, z: 30 },
 *   rotation: { x: 0, y: 0, z: 180 }
 * });
 *
 * // Create a new sound
 * const sound = await worldService.createSound({
 *   name: 'Ambient Music',
 *   url: 'https://example.com/ambient.mp3',
 *   volume: 0.5
 * });
 *
 * // Get existing elements
 * const existingCamera = worldService.getCamera('cam_12345');
 * const existingSound = worldService.getSound('sound_67890');
 * ```
 */
export class WorldService extends RPServerService {
  /** Cache of active cameras indexed by camera ID */
  private cameras: Map<CameraId, RPCamera> = new Map([]);
  /** Cache of active sounds indexed by sound ID */
  private sounds: Map<SoundId, RPSound> = new Map([]);
  /** Platform adapter for network communication */
  private get platformAdapter(): PlatformAdapter {
    return this.context.platformAdapter;
  }

  /**
   * Initializes the world service by loading all cameras and sounds.
   *
   * This method is called during server startup to populate the local caches
   * with all existing world elements from the roleplay engine.
   *
   * @override
   * @returns Promise that resolves when initialization is complete
   */
  public override async init(): Promise<void> {
    this.logger.info('Initializing cameras...');
    await this.refreshCameras();
    this.logger.info('Initializing sounds...');
    await this.refreshSounds();
    return super.init();
  }

  /**
   * Retrieves a camera by its unique identifier.
   *
   * Returns the cached camera data if available. This method provides quick access
   * to camera information without making API calls.
   *
   * @param id - The unique identifier of the camera
   * @returns The camera data if found, undefined otherwise
   *
   * @example
   * ```typescript
   * const camera = worldService.getCamera('cam_12345');
   * if (camera) {
   *   console.log(`Camera: ${camera.name} at position ${camera.position}`);
   * }
   * ```
   */
  public getCamera(id: CameraId): RPCamera | undefined {
    return this.cameras.get(id);
  }

  /**
   * Retrieves a sound by its unique identifier.
   *
   * Returns the cached sound data if available. This method provides quick access
   * to sound information without making API calls.
   *
   * @param id - The unique identifier of the sound
   * @returns The sound data if found, undefined otherwise
   *
   * @example
   * ```typescript
   * const sound = worldService.getSound('sound_67890');
   * if (sound) {
   *   console.log(`Sound: ${sound.name} with volume ${sound.volume}`);
   * }
   * ```
   */
  public getSound(id: SoundId): RPSound | undefined {
    return this.sounds.get(id);
  }

  /**
   * Creates a new camera in the world.
   *
   * This method creates a camera through the roleplay engine API and automatically
   * adds it to the local cache. The camera becomes immediately available for use.
   *
   * @param request - The camera creation request with position, rotation, and settings
   * @returns Promise resolving to the created camera
   * @throws {EngineError} When camera creation fails
   *
   * @example
   * ```typescript
   * const camera = await worldService.createCamera({
   *   name: 'Security Camera 1',
   *   position: { x: 100, y: 200, z: 30 },
   *   rotation: { x: 0, y: 0, z: 180 },
   *   fov: 75
   * });
   * ```
   */
  public createCamera(request: CreateCameraRequest): Promise<RPCamera> {
    return this.getEngineApi(CameraApi)
      .createCamera(request)
      .then((camera) => {
        this.cameras.set(camera.id, camera);
        return camera;
      });
  }

  /**
   * Creates a new sound in the world.
   *
   * This method creates a sound through the roleplay engine API and automatically
   * adds it to the local cache. The sound becomes immediately available for playback.
   *
   * @param request - The sound creation request with URL, volume, and settings
   * @returns Promise resolving to the created sound
   * @throws {EngineError} When sound creation fails
   *
   * @example
   * ```typescript
   * const sound = await worldService.createSound({
   *   name: 'Ambient Music',
   *   url: 'https://example.com/ambient.mp3',
   *   volume: 0.5,
   *   loop: true,
   *   range: 100
   * });
   * ```
   */
  public createSound(request: CreateSoundRequest): Promise<RPSound> {
    return this.getEngineApi(SoundApi)
      .createSound(request)
      .then((sound) => {
        this.sounds.set(sound.id, sound);
        return sound;
      });
  }

  @OnServer('socketCameraCreated')
  public async onSocketCameraCreated(payload: SocketCameraCreated) {
    if (this.cameras.has(payload.id)) {
      return;
    }

    await this.refreshCameras();
    this.eventEmitter.emit('cameraCreated', { cameraId: payload.id });
  }

  @OnServer('socketCameraUpdated')
  public async onSocketCameraUpdated(payload: SocketCameraUpdated) {
    await this.refreshCameras();
    this.eventEmitter.emit('cameraUpdated', { cameraId: payload.id });
  }

  @OnServer('socketCameraEnabled')
  public async onSocketCameraEnabled(payload: SocketCameraEnabled) {
    await this.refreshCameras();
    this.eventEmitter.emit('cameraUpdated', { cameraId: payload.id });
  }

  @OnServer('socketCameraDisabled')
  public async onSocketCameraDisabled(payload: SocketCameraDisabled) {
    await this.refreshCameras();
    this.eventEmitter.emit('cameraUpdated', { cameraId: payload.id });
  }

  @OnServer('socketSoundCreated')
  public async onSocketSoundCreated(payload: SocketSoundCreated) {
    if (this.sounds.has(payload.id)) {
      return;
    }

    await this.refreshSounds();
    this.eventEmitter.emit('soundCreated', { soundId: payload.id });
  }

  @OnServer('socketSoundUpdated')
  public async onSocketSoundUpdated(payload: SocketSoundUpdated) {
    await this.refreshSounds();
    this.eventEmitter.emit('soundUpdated', { soundId: payload.id });
  }

  @OnServer('socketSoundEnabled')
  public async onSocketSoundEnabled(payload: SocketSoundEnabled) {
    await this.refreshSounds();
    this.eventEmitter.emit('soundUpdated', { soundId: payload.id });
  }

  @OnServer('socketSoundDisabled')
  public async onSocketSoundDisabled(payload: SocketSoundDisabled) {
    await this.refreshSounds();
    this.eventEmitter.emit('soundUpdated', { soundId: payload.id });
  }

  private async refreshCameras() {
    this.cameras = new Map(
      (await this.getEngineApi(CameraApi).getCameras({ noCache: true })).map((camera) => [
        camera.id,
        camera,
      ]),
    );
  }

  private async refreshSounds() {
    this.sounds = new Map(
      (await this.getEngineApi(SoundApi).getSounds({ noCache: true })).map((sound) => [
        sound.id,
        sound,
      ]),
    );
  }

  /**
   * Sets the login camera for a player.
   *
   * This method retrieves the login screen camera configuration and activates
   * it for the specified player. The camera is used during the login/spawn
   * process to provide a cinematic experience.
   *
   * @param playerId - The player ID to set the camera for
   * @returns Promise resolving to true if camera was set successfully, false otherwise
   *
   * @example
   * ```typescript
   * const success = await worldService.setLoginCamera('player_123');
   * if (success) {
   *   console.log('Login camera activated for player');
   * }
   * ```
   */
  public async setLoginCamera(playerId: PlayerId): Promise<boolean> {
    try {
      const configService = this.getService(ConfigurationService);
      const cameraConfig = configService.getConfig(ConfigKey.LoginScreenCamera);

      if (!cameraConfig || !cameraConfig.value) {
        this.logger.error('Login screen camera not configured');
        return false;
      }

      return this.setCameraForPlayer(playerId, cameraConfig.value.key);
    } catch (error) {
      this.logger.error('Failed to set login camera:', error);
      return false;
    }
  }

  /**
   * Sets a camera for a specific player.
   *
   * This method activates a camera for the player through the platform adapter.
   * It's used internally by setLoginCamera and can be used for other camera
   * management purposes.
   *
   * @param playerId - The player ID to set the camera for
   * @param cameraKey - The camera key/ID to activate
   * @returns Promise resolving to true if camera was set successfully, false otherwise
   */
  public async setCameraForPlayer(playerId: PlayerId, cameraKey: string): Promise<boolean> {
    try {
      const camera = this.getCamera(cameraKey);

      if (!camera) {
        this.logger.error(`Camera not found: ${cameraKey}`);
        return false;
      }

      this.platformAdapter.network.emitToPlayer(playerId, 'camera:set', {
        id: camera.id,
        type: camera.type,
        position: camera.static?.position || { x: 0, y: 0, z: 0 },
        rotation: camera.static?.rotation || { x: 0, y: 0, z: 0 },
        fov: camera.static?.fov || 75,
        freezePlayer: camera.freezePlayer,
        hideHud: camera.hideHud,
        enabled: camera.enabled,
      });

      this.logger.info(`Camera activated for player ${playerId}: ${camera.id}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to set camera for player ${playerId}:`, error);
      return false;
    }
  }

  /**
   * Releases the camera for a specific player.
   *
   * This method deactivates any active camera for the player and returns
   * control to the default game camera.
   *
   * @param playerId - The player ID to release the camera for
   * @returns Promise resolving to true if camera was released successfully, false otherwise
   */
  public async releaseCameraForPlayer(playerId: PlayerId): Promise<boolean> {
    try {
      this.platformAdapter.network.emitToPlayer(playerId, 'camera:release');

      this.logger.info(`Camera released for player ${playerId}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to release camera for player ${playerId}:`, error);
      return false;
    }
  }
}
