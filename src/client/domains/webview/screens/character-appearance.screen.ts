import { BaseScreen } from './base.screen';
import { SpawnService } from '../../spawn/service';
import { CameraService } from '../../camera/service';
import { WebViewService } from '../service';
import { BaseBlueprintConfigValue } from '@roleplayx/engine-sdk';
import { Vector3 } from '../../../../shared';
import type {
  CharacterAppearanceScreenData,
  CharacterAppearancePreviewPayload,
  CharacterRenderRequestedPayload,
  CharacterRenderedPayload,
  CharacterRenderFailedPayload,
  SectionSelectedPayload,
  ScreenInitializedPayload,
  ScreenClosedPayload,
  ScreenNotificationPayload,
} from './character-appearance/types';
import { ScreenType } from '@roleplayx/engine-ui-sdk';

/**
 * Character Appearance Screen Handler
 * Handles all events related to the character appearance customization screen
 */
export class CharacterAppearanceScreen extends BaseScreen {
  private currentCharacterId: string | null = null;
  private isCharacterSpawned: boolean = false;
  private currentAppearanceValues: BaseBlueprintConfigValue[] = [];

  getScreenName(): string {
    return ScreenType.CharacterAppearance;
  }

  async onReadyToInitialize(data?: unknown): Promise<void> {
    this.logger.info('[CharacterAppearanceScreen] Ready to initialize', data);
  }

  /**
   * Handle screen initialization
   * This is called when the screen is first shown
   */
  async onInitialized(data?: ScreenInitializedPayload | CharacterAppearanceScreenData): Promise<void> {
    this.logger.info('[CharacterAppearanceScreen] Initialized', data);

    // Extract character ID from multiple sources
    // 1. From event data (if provided)
    // 2. From WebViewService screen state (where server sent it)
    let characterId = data?.characterId || (data as ScreenInitializedPayload)?.payload?.characterId;
    
    if (!characterId) {
      // Try to get from WebViewService screen state
      const webViewService = this.context.getService(WebViewService);
      const activeScreens = (webViewService as any).activeScreens;
      if (activeScreens) {
        const screenState = activeScreens.get(this.getScreenName());
        characterId = screenState?.data?.characterId;
        if (characterId) {
          this.logger.info('[CharacterAppearanceScreen] Found characterId in screen state', { characterId });
        }
      }
    }
    
    this.currentCharacterId = characterId || null;
    this.isCharacterSpawned = false;

    // Log warning if characterId is still null
    if (!this.currentCharacterId) {
      this.logger.warn('[CharacterAppearanceScreen] CharacterId not found in initialization data or screen state');
    }

    // Ensure webview focus is set
    this.platformAdapter.webview.setWebViewFocus(true, true);

    // Get values from screen state (server sends it there)
    const webViewService = this.context.getService(WebViewService);
    const activeScreens = (webViewService as any).activeScreens;
    const screenState = activeScreens?.get(this.getScreenName());
    const screenData = screenState?.data as CharacterAppearanceScreenData | undefined;
    const values = 
      screenData?.values || 
      data?.values || 
      (data as ScreenInitializedPayload)?.payload?.values || 
      [];
    
    // If values are provided, trigger preview
    // This happens when server sends initial values (e.g., isUpdateRequired flow)
    if (Array.isArray(values) && values.length > 0) {
      this.logger.info('[CharacterAppearanceScreen] Initial values provided, triggering preview', { 
        valuesCount: values.length,
        characterId: this.currentCharacterId,
      });
      // Wait a bit for screen to be fully ready
      await this.waitForNextFrame();
      await this.waitForNextFrame();
      await this.onCharacterAppearancePreview({ values });
    }
  }

  /**
   * Handle character appearance preview event
   * This event is sent when the screen first opens or when a value changes
   * Event comes from shell as: CHARACTER_APPEARANCE:characterAppearancePreview
   */
  async onCharacterAppearancePreview(data: CharacterAppearancePreviewPayload): Promise<void> {
    this.logger.info('[CharacterAppearanceScreen] Appearance preview', data);

    const values = data.values || data.payload?.values || [];

    if (!Array.isArray(values) || values.length === 0) {
      this.logger.warn('[CharacterAppearanceScreen] No appearance values provided');
      return;
    }

    // Store current values
    this.currentAppearanceValues = values;

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
    this.applyPreviewOutfit(playerPed);

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
  async onSectionSelected(data: SectionSelectedPayload): Promise<void> {
    const sectionKey = data.key || data.payload?.key;
    this.logger.debug('[CharacterAppearanceScreen] Section selected', { sectionKey });
  }

  /**
   * Handle character render request
   * This event is sent from shell when Save button is clicked
   * We capture the character image and send it back to shell
   * Shell will then call the API to update character appearance
   */
  async onCharacterRenderRequested(data: CharacterRenderRequestedPayload): Promise<void> {
    this.logger.info('[CharacterAppearanceScreen] Render request received', data);

    const values = data.values || data.payload?.values || [];

    if (!Array.isArray(values)) {
      this.logger.error('[CharacterAppearanceScreen] Invalid values in render request');
      this.notifyScreen({
        type: 'characterRenderFailed',
        data: { error: 'Invalid values in render request' } satisfies CharacterRenderFailedPayload,
      });
      return;
    }

    // Try to get characterId from multiple sources
    const characterId = 
      data.characterId || 
      data.payload?.characterId || 
      this.currentCharacterId;

    if (!characterId) {
      this.logger.warn('[CharacterAppearanceScreen] No characterId found in render request, trying to get from screen state');
      
      // Try to get from WebViewService screen state
      const webViewService = this.context.getService(WebViewService);
      const activeScreens = (webViewService as any).activeScreens;
      if (activeScreens) {
        const screenState = activeScreens.get(this.getScreenName());
        const screenDataCharacterId = screenState?.data?.characterId;
        if (screenDataCharacterId) {
          this.logger.info('[CharacterAppearanceScreen] Found characterId in screen state', { characterId: screenDataCharacterId });
          // Update currentCharacterId for future use
          this.currentCharacterId = screenDataCharacterId;
        }
      }
    } else if (characterId !== this.currentCharacterId) {
      // Update currentCharacterId if it was found in event data
      this.currentCharacterId = characterId;
    }

    // Final check - if still no characterId, log error
    if (!this.currentCharacterId) {
      this.logger.error('[CharacterAppearanceScreen] CharacterId is still null after all attempts');
    }

    try {
      // Apply appearance to ensure character looks correct before capture
      this.eventService.emit('character:applyAppearance', { values, incremental: false });
      
      // Wait for appearance to be applied
      await this.waitForNextFrame();
      await this.waitForNextFrame();

      // Store current values for API call
      this.currentAppearanceValues = values;

      // Capture character image
      const base64Image = await this.captureCharacterImage();

      // Send rendered image back to shell with values
      // Shell will handle the API call to update character appearance
      this.notifyScreen({
        type: 'characterRendered',
        data: { 
          base64Image,
          values: this.currentAppearanceValues,
          characterId: this.currentCharacterId,
        } satisfies CharacterRenderedPayload,
      });

      this.logger.info('[CharacterAppearanceScreen] Character rendered successfully', {
        characterId: this.currentCharacterId,
        hasImage: !!base64Image,
        valuesCount: this.currentAppearanceValues.length,
      });
    } catch (error) {
      this.logger.error('[CharacterAppearanceScreen] Failed to render character', error);
      
      this.notifyScreen({
        type: 'characterRenderFailed',
        data: { error: error instanceof Error ? error.message : 'Unknown error' } satisfies CharacterRenderFailedPayload,
      });
    }
  }

  /**
   * Returns a placeholder image when screenshot capture fails
   */
  private getPlaceholderImage(): string {
    // Return clean base64 without data URI prefix
    return 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  }

  /**
   * Capture character image as base64
   * Uses platform adapter for screenshot capture (platform-agnostic)
   * Avoids server round-trip to prevent serialization issues with large base64 data
   */
  private async captureCharacterImage(): Promise<string> {
    this.logger.info('[CharacterAppearanceScreen] Capturing character screenshot');
    
    try {
      // Use platform adapter for screenshot capture
      // Each platform implements its own screenshot mechanism via IScreenshotAdapter
      const base64Image = await this.platformAdapter.screenshot.captureScreenshot({
        encoding: 'png',
        quality: 0.4,
      });

      this.logger.info('[CharacterAppearanceScreen] Screenshot captured successfully');
      return base64Image;
    } catch (error) {
      this.logger.error('[CharacterAppearanceScreen] Error during screenshot capture, using placeholder:', error);
      // Fallback to placeholder on any error
      return this.getPlaceholderImage();
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
   * Applies a neutral outfit suited for appearance editing (bare upper body).
   */
  private applyPreviewOutfit(ped: number): void {
    const pedAppearance = (this.platformAdapter as any)?.pedAppearance;
    if (!pedAppearance?.setPedComponentVariation || !pedAppearance?.getHashKey) {
      this.logger.warn('[CharacterAppearanceScreen] Ped appearance adapter not available for preview outfit');
      return;
    }

    try {
      // Ensure torso/undershirt/top components expose the chest for customization
      // Component IDs: 3 (Torso), 8 (Undershirt), 11 (Top)
      pedAppearance.setPedComponentVariation(ped, 3, 15, 0, 0);
      pedAppearance.setPedComponentVariation(ped, 8, 15, 0, 0);
      pedAppearance.setPedComponentVariation(ped, 11, 15, 0, 0);
    } catch (error) {
      this.logger.error('[CharacterAppearanceScreen] Failed to apply preview outfit', error);
    }
  }

  /**
   * Notify the screen with an event
   * Sends a message to the shell using client:notifyScreen format
   */
  private notifyScreen(payload: ScreenNotificationPayload): void {
    this.logger.debug('[CharacterAppearanceScreen] Notifying screen', payload);
    
    // Send to shell using the webview service's notifyScreen method
    const webViewService = this.context.getService(WebViewService);
    webViewService.notifyScreen('CHARACTER_APPEARANCE', payload.type, payload.data);
  }

  /**
   * Handle screen closed event
   */
  async onClosed(data?: ScreenClosedPayload): Promise<void> {
    this.logger.info('[CharacterAppearanceScreen] Screen closed');
    this.currentCharacterId = null;
    this.isCharacterSpawned = false;
    this.currentAppearanceValues = [];

    // Emit cleanup event for appearance service
    this.eventService.emit('character:clearAppearanceState', {});
  }

  /**
   * Handle any custom event for this screen
   */
  async handleEvent(eventType: string, data?: unknown): Promise<void> {
    const handlerName = `on${eventType.charAt(0).toUpperCase()}${eventType.slice(1)}`;
    const handler = (this as any)[handlerName];

    if (handler && typeof handler === 'function') {
      await handler.call(this, data);
    } else {
      this.logger.warn(`[CharacterAppearanceScreen] No handler for event: ${eventType}`);
    }
  }
}

