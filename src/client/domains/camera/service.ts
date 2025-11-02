import { RPClientService } from '../../core/client-service';
import { OnServer } from '../../core/events/decorators';
import { RPServerToClientEvents } from '../../../shared/types';
import { ClientTypes } from '../../core/types';
import { ClientPlatformAdapter } from '../../natives/adapters/platform.adapter';
import { Vector3 } from '../../../shared';
import { SpawnService } from '../spawn/service';
import { EventService } from '../event/service';

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
  private cameraScreenMapping: Map<string, { cameraId: number; screenType: string }> = new Map();
  
  // PedEdit camera specific properties
  private pedEditControlsInterval: number | null = null;
  private pedEditZPos: number = 0;
  private pedEditFov: number = 90;
  private pedEditStartPosition: Vector3 | null = null;
  private pedEditStartCamPosition: Vector3 | null = null;
  private pedEditTimeBetweenAnimChecks: number = Date.now() + 100;
  private pedEditControlStatus: boolean = false;
  private pedEditCameraData: RPServerToClientEvents['cameraPedEditSet'] | null = null;

  /**
   * Initializes the camera service.
   */
  public async init(): Promise<void> {
    this.logger.info('Initializing camera service...');
    this.setupEventListeners();
    await super.init();
  }

  /**
   * Sets up event listeners for screen lifecycle events.
   */
  private setupEventListeners(): void {
    const eventService = this.context.getService(EventService);

    // Listen for screen closed events to automatically release associated cameras
    eventService.on('webviewScreenClosed', (data: { screen: string }) => {
      this.handleScreenClosed(data.screen);
    });
  }

  private handleScreenClosed(screenType: string): void {
    const camerasToRelease: string[] = [];
    this.cameraScreenMapping.forEach((value, cameraKey) => {
      if (value.screenType === screenType) {
        camerasToRelease.push(cameraKey);
      }
    });

    camerasToRelease.forEach((cameraKey) => {
      const mapping = this.cameraScreenMapping.get(cameraKey);
      if (mapping) {
        this.releaseCameraById(mapping.cameraId);
        this.cameraScreenMapping.delete(cameraKey);
      }
    });
  }

  @OnServer('cameraSet')
  public onCameraSet(data: RPServerToClientEvents['cameraSet']): void {
    this.logger.info('[Camera] Setting camera for screen:', data.screenType);
    this.platformAdapter.core.shutdownLoadingScreen();

    this.cameraId = this.platformAdapter.camera.createCamera(data.type);
    this.activeCamera = data.id;

    if (data.screenType) {
      this.cameraScreenMapping.set(data.id, {
        cameraId: this.cameraId,
        screenType: data.screenType,
      });
    }

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

  @OnServer('cameraPedEditSet')
  public onCameraPedEditSet(data: RPServerToClientEvents['cameraPedEditSet']): void {
    this.logger.info('[PedEdit Camera] Activating for screen:', data.screenType);
    this.pedEditCameraData = data;
    this.setupPedEditCamera(data);
  }

  public pausePedEditControls(pause: boolean): void {
    this.pedEditControlStatus = pause;
  }

  public getPedEditCameraData(): RPServerToClientEvents['cameraPedEditSet'] | null {
    return this.pedEditCameraData;
  }

  public refreshPedEditCamera(): void {
    if (!this.pedEditCameraData) return;
    
    if (this.pedEditControlsInterval !== null) {
      this.platformAdapter.core.clearTick(this.pedEditControlsInterval);
      this.pedEditControlsInterval = null;
    }

    if (this.cameraId !== null) {
      this.platformAdapter.camera.destroyCamera(this.cameraId, true);
      this.cameraId = null;
    }

    this.setupPedEditCamera(this.pedEditCameraData);
  }

  private setupPedEditCamera(data: RPServerToClientEvents['cameraPedEditSet']): void {
    this.platformAdapter.core.shutdownLoadingScreen();

    const playerPed = this.platformAdapter.player.getPlayerPed();
    const teleportPosition = new Vector3(data.position.x, data.position.y, data.position.z);
    
    this.platformAdapter.player.setEntityPosition(playerPed, teleportPosition);
    this.platformAdapter.player.setEntityHeading(playerPed, data.rotation.z);
    this.pedEditStartPosition = teleportPosition;
    
    const headingRadians = (data.rotation.z * Math.PI) / 180;
    const forwardX = -Math.sin(headingRadians);
    const forwardY = Math.cos(headingRadians);
    
    const forwardCameraPosition = new Vector3(
      teleportPosition.x + forwardX * 1.2,
      teleportPosition.y + forwardY * 1.2,
      teleportPosition.z + this.pedEditZPos
    );

    this.pedEditFov = data.fov || 90;
    this.pedEditStartCamPosition = forwardCameraPosition;

    this.cameraId = this.platformAdapter.camera.createCameraWithParams(
      'DEFAULT_SCRIPTED_CAMERA',
      forwardCameraPosition,
      new Vector3(0, 0, 0),
      this.pedEditFov,
      true,
      0
    );
    
    this.activeCamera = data.id;

    if (data.screenType) {
      this.cameraScreenMapping.set(data.id, {
        cameraId: this.cameraId,
        screenType: data.screenType,
      });
    }

    this.platformAdapter.camera.pointCameraAtCoord(this.cameraId, this.pedEditStartPosition);
    this.platformAdapter.camera.setCameraActive(this.cameraId, true);
    this.platformAdapter.camera.renderScriptCameras(true, false, 0, true, false);

    if (data.hideHud) {
      this.platformAdapter.core.displayHud(false);
      this.platformAdapter.core.displayRadar(false);
    }

    this.pedEditControlsInterval = this.platformAdapter.core.setTick(() => {
      this.handlePedEditControls();
    });
    
    this.logger.info('[PedEdit Camera] Activated');
  }

  @OnServer('cameraRelease')
  public onCameraRelease(data: RPServerToClientEvents['cameraRelease']): void {
    this.logger.info('Releasing camera');

    if (this.cameraId !== null) {
      this.releaseCameraById(this.cameraId);
      
      // Remove from mapping if exists
      if (this.activeCamera) {
        this.cameraScreenMapping.delete(this.activeCamera);
      }
      
      this.cameraId = null;
      this.activeCamera = null;
    }
  }

  /**
   * Releases a camera by its ID.
   *
   * @param cameraId - The camera ID to release
   */
  private releaseCameraById(cameraId: number): void {
    // Clean up PedEdit controls if active
    if (this.pedEditControlsInterval !== null) {
      this.platformAdapter.core.clearTick(this.pedEditControlsInterval);
      this.pedEditControlsInterval = null;
    }

    this.platformAdapter.camera.setCameraActive(cameraId, false);
    this.platformAdapter.camera.destroyCamera(cameraId, true);
    this.platformAdapter.camera.renderScriptCameras(false, true, 1000, true, true);
    this.platformAdapter.core.displayHud(true);
    this.platformAdapter.core.displayRadar(true);

    // Reset PedEdit camera properties
    this.pedEditZPos = 0;
    this.pedEditFov = 90;
    this.pedEditStartPosition = null;
    this.pedEditStartCamPosition = null;
    this.pedEditControlStatus = false;
    this.pedEditCameraData = null;
  }

  /**
   * Handles PedEdit camera controls (called every tick).
   */
  private handlePedEditControls(): void {
    if (!this.cameraId || !this.pedEditStartPosition || !this.pedEditStartCamPosition) {
      return;
    }

    if (this.pedEditControlStatus) {
      this.platformAdapter.core.hideHudAndRadarThisFrame();
      return;
    }

    const playerPed = this.platformAdapter.player.getPlayerPed();
    this.platformAdapter.player.setEntityPosition(playerPed, this.pedEditStartPosition);

    const currentCamPos = new Vector3(
      this.pedEditStartCamPosition.x,
      this.pedEditStartCamPosition.y,
      this.pedEditStartCamPosition.z + this.pedEditZPos
    );
    this.platformAdapter.camera.setCameraCoord(this.cameraId, currentCamPos);
    
    const lookAtPos = new Vector3(
      this.pedEditStartPosition.x,
      this.pedEditStartPosition.y,
      this.pedEditStartPosition.z + this.pedEditZPos
    );
    this.platformAdapter.camera.pointCameraAtCoord(this.cameraId, lookAtPos);

    this.platformAdapter.core.hideHudAndRadarThisFrame();
    
    this.platformAdapter.core.disableControlAction(0, 1, true);
    this.platformAdapter.core.disableControlAction(0, 2, true);
    this.platformAdapter.core.disableControlAction(0, 24, true);
    this.platformAdapter.core.disableControlAction(0, 25, true);
    this.platformAdapter.core.disableControlAction(0, 30, true);
    this.platformAdapter.core.disableControlAction(0, 31, true);
    this.platformAdapter.core.disableControlAction(0, 36, true);
    this.platformAdapter.core.disableControlAction(0, 21, true);
    this.platformAdapter.core.disableControlAction(0, 22, true);
    this.platformAdapter.core.disableControlAction(0, 44, true);
    this.platformAdapter.core.disableControlAction(0, 140, true);
    this.platformAdapter.core.disableControlAction(0, 141, true);
    this.platformAdapter.core.disableControlAction(0, 142, true);
    this.platformAdapter.core.disableControlAction(0, 143, true);
    this.platformAdapter.core.disableControlAction(0, 37, true);
    this.platformAdapter.core.disableControlAction(0, 23, true);

    // Scroll Up - Zoom in
    if (this.platformAdapter.core.isDisabledControlPressed(0, 15)) {
      this.pedEditFov -= 2;
      if (this.pedEditFov < 10) {
        this.pedEditFov = 10;
      }
      this.platformAdapter.camera.setCameraFov(this.cameraId, this.pedEditFov);
    }

    // Scroll Down - Zoom out
    if (this.platformAdapter.core.isDisabledControlPressed(0, 16)) {
      this.pedEditFov += 2;
      if (this.pedEditFov > 130) {
        this.pedEditFov = 130;
      }
      this.platformAdapter.camera.setCameraFov(this.cameraId, this.pedEditFov);
    }

    if (this.platformAdapter.core.isDisabledControlPressed(0, 32)) {
      this.pedEditZPos += 0.01;
      if (this.pedEditZPos > 1.2) {
        this.pedEditZPos = 1.2;
      }
    }

    if (this.platformAdapter.core.isDisabledControlPressed(0, 33)) {
      this.pedEditZPos -= 0.01;
      if (this.pedEditZPos < -1.2) {
        this.pedEditZPos = -1.2;
      }
    }

    // D - Rotate player right
    if (this.platformAdapter.core.isDisabledControlPressed(0, 35)) {
      const currentHeading = this.platformAdapter.player.getEntityHeading(playerPed);
      const newHeading = currentHeading + 2;
      this.platformAdapter.player.setEntityHeading(playerPed, newHeading);
    }

    // A - Rotate player left
    if (this.platformAdapter.core.isDisabledControlPressed(0, 34)) {
      const currentHeading = this.platformAdapter.player.getEntityHeading(playerPed);
      const newHeading = currentHeading - 2;
      this.platformAdapter.player.setEntityHeading(playerPed, newHeading);
    }

    if (Date.now() > this.pedEditTimeBetweenAnimChecks) {
      this.pedEditTimeBetweenAnimChecks = Date.now() + 1500;
      if (!this.platformAdapter.player.isEntityPlayingAnim(playerPed, 'nm@hands', 'hands_up', 3)) {
        this.platformAdapter.player.taskPlayAnim(
          playerPed,
          'nm@hands',
          'hands_up',
          8.0,
          -8.0,
          -1,
          2,
          0,
          false,
          false,
          false
        );
      }
    }
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
    // Clean up PedEdit controls if active
    if (this.pedEditControlsInterval !== null) {
      this.platformAdapter.core.clearTick(this.pedEditControlsInterval);
      this.pedEditControlsInterval = null;
    }

    // Release all cameras in the mapping
    this.cameraScreenMapping.forEach((value) => {
      this.releaseCameraById(value.cameraId);
    });
    this.cameraScreenMapping.clear();

    if (this.cameraId !== null) {
      this.platformAdapter.camera.setCameraActive(this.cameraId, false);
      this.platformAdapter.camera.destroyCamera(this.cameraId, true);
      this.cameraId = null;
    }

    this.activeCamera = null;
    
    // Reset PedEdit properties
    this.pedEditZPos = 0;
    this.pedEditFov = 90;
    this.pedEditStartPosition = null;
    this.pedEditStartCamPosition = null;
    this.pedEditControlStatus = false;
    this.pedEditCameraData = null;
    
    await super.dispose();
  }
}


