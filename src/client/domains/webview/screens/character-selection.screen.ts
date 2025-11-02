import { BaseScreen } from './base.screen';
import { CameraService } from '../../camera/service';
import { SpawnService } from '../../spawn/service';
import { Vector3 } from '../../../../shared';

/**
 * Character Selection Screen Handler
 * Handles all events related to the character selection screen
 */
export class CharacterSelectionScreen extends BaseScreen {
  private cursorVisible: boolean = true;
  private lastF2Press: number = 0;
  private keyDownHandler: ((data: any) => void) | null = null;

  getScreenName(): string {
    return 'CHARACTER_SELECTION';
  }

  async onReadyToInitialize(data: any): Promise<void> {
    // No-op
  }

  async onInitialized(data: any): Promise<void> {
    const playerPed = this.platformAdapter.player.getPlayerPed();
    this.platformAdapter.player.setEntityVisible(playerPed, false);
    this.platformAdapter.webview.setWebViewFocus(true, this.cursorVisible);
    this.setupKeyboardListener();
  }

  async onClosed(data: any): Promise<void> {
    const playerPed = this.platformAdapter.player.getPlayerPed();
    this.platformAdapter.player.setEntityVisible(playerPed, true);
    this.platformAdapter.webview.setWebViewFocus(false, false);
    this.cleanupKeyboardListener();
    this.cursorVisible = false;
  }

  private setupKeyboardListener(): void {
    this.keyDownHandler = (data: any) => {
      if (data.key === 'F2' || data.code === 'F2') {
        const now = Date.now();
        if (now - this.lastF2Press > 200) {
          this.lastF2Press = now;
          this.toggleCursor();
        }
      }
    };

    this.platformAdapter.webview.registerWebViewCallback('webviewKeyDown', this.keyDownHandler);
  }

  private cleanupKeyboardListener(): void {
    this.keyDownHandler = null;
  }

  private toggleCursor(): void {
    this.cursorVisible = !this.cursorVisible;
    this.platformAdapter.webview.setWebViewFocus(true, this.cursorVisible);
    this.logger.info('[CharacterSelectionScreen] Cursor:', this.cursorVisible ? 'visible' : 'hidden');
  }

  /**
   * Handle character preview event
   * Requests server to spawn the selected character for preview
   */
  async onCharacterPreview(data: any): Promise<void> {
    const characterId = data.characterId || data.payload?.characterId;
    const cameraService = this.context.getService(CameraService);
    const spawnService = this.context.getService(SpawnService);
    
    const cameraData = cameraService.getPedEditCameraData();
    if (!cameraData) {
      this.logger.warn('[CharacterSelectionScreen] No camera data available for spawn');
      return;
    }
    
    const model = 'mp_m_freemode_01'; // TODO: Get from character data
    const position = new Vector3(cameraData.position.x, cameraData.position.y, cameraData.position.z);
    const heading = cameraData.rotation.z;
    
    await spawnService.spawnForPreview(model, position, heading);
    cameraService.refreshPedEditCamera();
    
    this.platformAdapter.network.emitToServer('characterPreview', { characterId });
  }

  /**
   * Handle any custom event for this screen
   */
  async handleEvent(eventType: string, data: any): Promise<void> {
    // Route to appropriate handler based on event type
    const handlerName = `on${eventType.charAt(0).toUpperCase()}${eventType.slice(1)}`;
    const handler = (this as any)[handlerName];

    if (handler && typeof handler === 'function') {
      await handler.call(this, data);
    } else {
      this.logger.debug(`No handler for event: ${eventType}`, data);
    }
  }
}

