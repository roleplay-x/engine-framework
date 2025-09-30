import { RPClientService } from '../../core/client-service';
import { OnServer } from '../../core/events/decorators';
import { RPServerToClientEvents } from '../../../shared/types';
import { ClientTypes } from '../../core/types';
import { ClientPlatformAdapter } from '../../natives/adapters/platform.adapter';
import { Vector3 } from '../../../shared';
import { SpawnService } from '../spawn/service';

/**
 * Camera service for managing client-side camera operations.
 *
 * This service handles camera-related events from the server and manages
 * the client-side camera state through the platform adapter.
 *
 * @example
 * ```typescript
 * // Camera is automatically managed through server events
 * // Server sends 'camera:set' event to activate camera
 * // Server sends 'camera:release' event to deactivate camera
 * ```
 */
export class CameraService extends RPClientService<ClientTypes> {
  private activeCamera: string | null = null;
  private cameraId: number | null = null;

  /**
   * Initializes the camera service.
   */
  public async init(): Promise<void> {
    this.logger.info('Initializing camera service...');
    await super.init();
  }

  /**
   * Handles camera set events from the server.
   *
   * @param data - Camera data from server
   */
  @OnServer('cameraSet')
  public onCameraSet(data: RPServerToClientEvents['cameraSet']): void {
    this.logger.info('Setting camera:', data);
    this.platformAdapter.core.shutdownLoadingScreen();

    this.cameraId = this.platformAdapter.camera.createCamera(data.type);
    this.activeCamera = data.id;

    this.platformAdapter.camera.setCameraCoord(
      this.cameraId,
      new Vector3(data.position.x, data.position.y, data.position.z),
    );
    this.platformAdapter.camera.setCameraRotation(
      this.cameraId,
      new Vector3(data.rotation.x, data.rotation.y, data.rotation.z),
    );
    this.platformAdapter.camera.setCameraFov(this.cameraId, data.fov);
    this.platformAdapter.camera.setCameraActive(this.cameraId, true);

    if (data.hideHud) {
      this.platformAdapter.core.displayHud(false);
      this.platformAdapter.core.displayRadar(false);
    }
  }

  /**
   * Handles camera release events from the server.
   */
  @OnServer('cameraRelease')
  public onCameraRelease(data: RPServerToClientEvents['cameraRelease']): void {
    this.logger.info('Releasing camera');

    if (this.cameraId !== null) {
      this.platformAdapter.camera.setCameraActive(this.cameraId, false);
      this.platformAdapter.camera.destroyCamera(this.cameraId, true);
      this.cameraId = null;
    }

    this.activeCamera = null;
    this.platformAdapter.camera.renderScriptCameras(false, true, 1000, true, true);
    this.platformAdapter.core.displayHud(true);
    this.platformAdapter.core.displayRadar(true);
  }

  /**
   * Gets the currently active camera ID.
   *
   * @returns The active camera ID or null if no camera is active
   */
  public getActiveCamera(): string | null {
    return this.activeCamera;
  }

  /**
   * Checks if a camera is currently active.
   *
   * @returns True if a camera is active, false otherwise
   */
  public isCameraActive(): boolean {
    return this.activeCamera !== null;
  }

  /**
   * Disposes of the camera service and cleans up resources.
   */
  public async dispose(): Promise<void> {
    if (this.cameraId !== null) {
      this.platformAdapter.camera.setCameraActive(this.cameraId, false);
      this.platformAdapter.camera.destroyCamera(this.cameraId, true);
      this.cameraId = null;
    }

    this.activeCamera = null;
    await super.dispose();
  }
}
