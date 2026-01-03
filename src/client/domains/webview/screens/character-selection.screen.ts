import { BaseScreen } from './base.screen';
import { CameraService } from '../../camera/service';
import { SpawnService } from '../../spawn/service';
import { Vector3 } from '../../../../shared';
import { BaseBlueprintConfigValue } from '@roleplayx/engine-sdk';

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
    // Use console.log for immediate visibility
    console.log('[CharacterSelectionScreen] onCharacterPreview called', { 
      data,
      characterId: data?.characterId || data?.payload?.characterId,
    });
    
    this.logger.info('[CharacterSelectionScreen] onCharacterPreview called', { 
      data,
      characterId: data?.characterId || data?.payload?.characterId,
    });
    
    const characterId = data.characterId || data.payload?.characterId;
    const appearanceValues = data.values || data.payload?.values || data.appearanceValues || data.payload?.appearanceValues;
    
    console.log('[CharacterSelectionScreen] Extracted data', {
      characterId,
      hasAppearanceValues: Array.isArray(appearanceValues) && appearanceValues.length > 0,
      appearanceValuesCount: Array.isArray(appearanceValues) ? appearanceValues.length : 0,
    });
    
    this.logger.debug('[CharacterSelectionScreen] Extracted data', {
      characterId,
      hasAppearanceValues: Array.isArray(appearanceValues) && appearanceValues.length > 0,
      appearanceValuesCount: Array.isArray(appearanceValues) ? appearanceValues.length : 0,
    });
    
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
    
    // Wait for model to be fully loaded before applying appearance
    await this.waitForNextFrame();
    await this.waitForNextFrame();
    
    // Apply appearance if values are provided
    if (Array.isArray(appearanceValues) && appearanceValues.length > 0) {
      this.logger.info('[CharacterSelectionScreen] Applying appearance for preview', { 
        valuesCount: appearanceValues.length 
      });
      this.eventService.emit('character:applyAppearance', { 
        values: appearanceValues, 
        incremental: false 
      });
      
      // Wait for appearance to be applied
      await this.waitForNextFrame();
      await this.waitForNextFrame();
    } else {
      this.logger.warn('[CharacterSelectionScreen] No appearance values provided for preview');
    }
    
    cameraService.refreshPedEditCamera();
    
    // Log before sending to server - use console.log for immediate visibility
    const hasNetworkAdapter = !!this.platformAdapter?.network;
    const hasEmitToServer = !!this.platformAdapter?.network?.emitToServer;
    
    console.log('[CharacterSelectionScreen] Sending characterPreview to server', { 
      characterId,
      hasNetworkAdapter,
      hasEmitToServer,
      platformAdapter: !!this.platformAdapter,
      network: !!this.platformAdapter?.network,
    });
    
    this.logger.info('[CharacterSelectionScreen] Sending characterPreview to server', { 
      characterId,
      hasNetworkAdapter,
      hasEmitToServer,
    });
    
    try {
      if (!this.platformAdapter?.network?.emitToServer) {
        console.error('[CharacterSelectionScreen] Cannot send characterPreview: network adapter or emitToServer not available', {
          platformAdapter: !!this.platformAdapter,
          network: !!this.platformAdapter?.network,
          emitToServer: !!this.platformAdapter?.network?.emitToServer,
        });
        this.logger.error('[CharacterSelectionScreen] Cannot send characterPreview: network adapter or emitToServer not available');
        return;
      }
      
      console.log('[CharacterSelectionScreen] Calling emitToServer with', { 
        event: 'characterPreview', 
        data: { characterId } 
      });
      
      this.platformAdapter.network.emitToServer('characterPreview', { characterId });
      
      console.log('[CharacterSelectionScreen] characterPreview event sent to server successfully', { characterId });
      this.logger.info('[CharacterSelectionScreen] characterPreview event sent to server successfully', { characterId });
    } catch (error) {
      console.error('[CharacterSelectionScreen] Failed to send characterPreview to server', { error, characterId });
      this.logger.error('[CharacterSelectionScreen] Failed to send characterPreview to server', { error, characterId });
    }
  }

  /**
   * Wait for next frame
   */
  private waitForNextFrame(): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, 0);
    });
  }

  /**
   * Handle character appearance preview event from server
   * This is sent when server responds to characterPreview request with appearance data
   */
  async onCharacterAppearancePreview(data: any): Promise<void> {
    this.logger.info('[CharacterSelectionScreen] onCharacterAppearancePreview called', { 
      data,
      hasValues: !!data?.values,
      valuesLength: Array.isArray(data?.values) ? data.values.length : 0,
    });
    
    const appearanceValues = data.values || data.payload?.values || [];
    
    if (!Array.isArray(appearanceValues) || appearanceValues.length === 0) {
      this.logger.warn('[CharacterSelectionScreen] No appearance values in preview event', {
        data,
        appearanceValues,
      });
      return;
    }

    this.logger.info('[CharacterSelectionScreen] Received appearance preview from server', { 
      valuesCount: appearanceValues.length,
      firstFewValues: appearanceValues.slice(0, 3).map(v => ({ configKey: v.configKey, type: v.type })),
    });

    // Apply appearance
    this.logger.debug('[CharacterSelectionScreen] Emitting character:applyAppearance event');
    this.eventService.emit('character:applyAppearance', { 
      values: appearanceValues, 
      incremental: false 
    });
    
    // Wait for appearance to be applied
    await this.waitForNextFrame();
    await this.waitForNextFrame();
    
    this.logger.debug('[CharacterSelectionScreen] Appearance application completed');
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

