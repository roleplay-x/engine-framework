import { BaseScreen } from './base.screen';
import { SpawnService } from '../../spawn/service';
import { CameraService } from '../../camera/service';
import { BaseBlueprintConfigValue, BlueprintConfigOptionValue } from '@roleplayx/engine-sdk';
import { Vector3 } from '../../../../shared';

/**
 * Character Appearance Screen Handler
 * Handles all events related to the character appearance customization screen
 */
export class CharacterAppearanceScreen extends BaseScreen {
  private currentCharacterId: string | null = null;
  private isCharacterSpawned: boolean = false;

  getScreenName(): string {
    return 'CHARACTER_APPEARANCE';
  }

  async onReadyToInitialize(data: any): Promise<void> {
    this.logger.info('[CharacterAppearanceScreen] Ready to initialize', data);
  }

  /**
   * Handle screen initialization
   * This is called when the screen is first shown
   */
  async onInitialized(data: any): Promise<void> {
    this.logger.info('[CharacterAppearanceScreen] Initialized', data);

    // Extract character ID if provided
    this.currentCharacterId = data.characterId || data.payload?.characterId || null;
    this.isCharacterSpawned = false;
  }

  /**
   * Handle character appearance preview event
   * This event is sent when the screen first opens or when a value changes
   */
  async onCharacterAppearancePreview(data: any): Promise<void> {
    this.logger.info('[CharacterAppearanceScreen] Appearance preview', data);

    const values = data.values || data.payload?.values || [];

    if (!Array.isArray(values) || values.length === 0) {
      this.logger.warn('[CharacterAppearanceScreen] No appearance values provided');
      return;
    }

    // First preview should spawn the character
    if (!this.isCharacterSpawned) {
      await this.handleInitialPreview(values);
      this.isCharacterSpawned = true;
    } else {
      await this.handleIncrementalPreview(values);
    }
  }

  /**
   * Handle initial appearance preview (apply appearance and position ped)
   * 
   * Note: PED model is automatically set via appearance handler when PED config is applied.
   * Backend sends PED config based on character gender.
   */
  private async handleInitialPreview(values: BaseBlueprintConfigValue[]): Promise<void> {
    this.logger.info('[CharacterAppearanceScreen] Initial preview - applying full appearance');

    const cameraService = this.context.getService(CameraService);

    const cameraData = cameraService.getPedEditCameraData();
    if (!cameraData) {
      this.logger.warn('[CharacterAppearanceScreen] No camera data available');
      return;
    }

    this.eventService.emit('character:applyAppearance', { values, incremental: false });

    await this.waitForNextFrame();
    await this.waitForNextFrame();

    const playerPed = this.platformAdapter.player.getPlayerPed();
    const position = new Vector3(cameraData.position.x, cameraData.position.y, cameraData.position.z);
    const heading = cameraData.rotation.z;
    
    this.platformAdapter.player.setEntityPosition(playerPed, position, false);
    this.platformAdapter.player.setEntityHeading(playerPed, heading);
    this.platformAdapter.player.setEntityVisible(playerPed, true);

    cameraService.refreshPedEditCamera();
    
    this.logger.info('[CharacterAppearanceScreen] Initial preview completed');
  }

  /**
   * Handle incremental appearance preview (only changed values)
   */
  private async handleIncrementalPreview(values: BaseBlueprintConfigValue[]): Promise<void> {
    this.logger.debug('[CharacterAppearanceScreen] Incremental preview', { valueCount: values.length });

    this.eventService.emit('character:applyAppearance', { values, incremental: true });
  }

  /**
   * Handle section selected event
   * This can be used to adjust camera focus based on the selected section
   */
  async onSectionSelected(data: any): Promise<void> {
    const sectionKey = data.key || data.payload?.key;
    this.logger.debug('[CharacterAppearanceScreen] Section selected', { sectionKey });
  }

  /**
   * Handle character render request
   */
  async onCharacterRenderRequest(data: any): Promise<void> {
    this.logger.info('[CharacterAppearanceScreen] Render request received', data);

    const values = data.values || data.payload?.values || [];

    if (!Array.isArray(values)) {
      this.logger.error('[CharacterAppearanceScreen] Invalid values in render request');
      return;
    }

    try {
      this.eventService.emit('character:applyAppearance', { values, incremental: false });
      await this.waitForNextFrame();

      const base64Image = await this.captureCharacterImage();

      this.notifyScreen({
        type: 'characterRendered',
        data: { base64Image },
      });

      this.logger.info('[CharacterAppearanceScreen] Character rendered successfully');
    } catch (error) {
      this.logger.error('[CharacterAppearanceScreen] Failed to render character', error);
      
      this.notifyScreen({
        type: 'characterRenderFailed',
        data: { error: error instanceof Error ? error.message : 'Unknown error' },
      });
    }
  }

  /**
   * Capture character image as base64
   */
  private async captureCharacterImage(): Promise<string> {
    // TODO: Implement actual screenshot capture
    this.logger.warn('[CharacterAppearanceScreen] Screenshot capture not yet implemented');
    return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
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
   * Notify the screen with an event
   */
  private notifyScreen(payload: { type: string; data: any }): void {
    this.logger.debug('[CharacterAppearanceScreen] Notifying screen', payload);
    
    this.eventService.emit('webview:notifyScreen', {
      screen: 'CHARACTER_APPEARANCE',
      type: payload.type,
      data: payload.data,
    });
  }

  /**
   * Handle screen closed event
   */
  async onClosed(data: any): Promise<void> {
    this.logger.info('[CharacterAppearanceScreen] Screen closed');
    this.currentCharacterId = null;
    this.isCharacterSpawned = false;

    // Emit cleanup event for appearance service
    this.eventService.emit('character:clearAppearanceState', {});
  }

  /**
   * Handle any custom event for this screen
   */
  async handleEvent(eventType: string, data: any): Promise<void> {
    const handlerName = `on${eventType.charAt(0).toUpperCase()}${eventType.slice(1)}`;
    const handler = (this as any)[handlerName];

    if (handler && typeof handler === 'function') {
      await handler.call(this, data);
    } else {
      this.logger.warn(`[CharacterAppearanceScreen] No handler for event: ${eventType}`);
    }
  }
}

