import { BaseScreen } from './base.screen';
import { ScreenType } from '@roleplayx/engine-ui-sdk';
import { RPClientToServerEvents } from '../../../../shared/types';
import { WebViewService } from '../service';
import { SpawnService } from '../../spawn/service';
import type {
  SpawnLocationSelectionScreenData,
  SpawnLocationPreviewPayload,
  SpawnRequestPayload,
  ScreenInitializedPayload,
  ScreenClosedPayload,
} from './spawn-location-selection/types';

/**
 * Spawn Location Selection Screen Handler
 * Handles all events related to the spawn location selection screen
 */
export class SpawnLocationSelectionScreen extends BaseScreen {
  private currentCharacterId: string | null = null;

  getScreenName(): string {
    return ScreenType.SpawnLocationSelection;
  }

  async onInitialized(data?: ScreenInitializedPayload | SpawnLocationSelectionScreenData): Promise<void> {
    this.logger.info('[SpawnLocationSelectionScreen] Initialized', data);

    const characterId = data?.characterId || (data as ScreenInitializedPayload)?.payload?.characterId;
    
    if (!characterId) {
      const webViewService = this.context.getService(WebViewService);
      const activeScreens = (webViewService as any).activeScreens;
      if (activeScreens) {
        const screenState = activeScreens.get(this.getScreenName());
        const screenData = screenState?.data as SpawnLocationSelectionScreenData | undefined;
        if (screenData?.characterId) {
          this.currentCharacterId = screenData.characterId;
          this.logger.info('[SpawnLocationSelectionScreen] Found characterId in screen state', { 
            characterId: this.currentCharacterId 
          });
        }
      }
    } else {
      this.currentCharacterId = characterId;
    }

    this.platformAdapter.webview.setWebViewFocus(true, true);
    this.logger.info('[SpawnLocationSelectionScreen] Screen camera should be active');
  }

  /**
   * Handle spawn location preview event
   * This event is sent when a location is selected
   * Event contains optional cameraId - if provided, set that camera, otherwise show screen camera
   * 
   * The spawn service will handle camera management and store the selected spawn location info
   */
  async onSpawnLocationPreview(data: SpawnLocationPreviewPayload): Promise<void> {
    this.logger.info('[SpawnLocationSelectionScreen] Spawn location preview', data);

    const cameraId = data.cameraId || data.payload?.cameraId;
    const spawnLocationId = (data as any).spawnLocationId || (data.payload as any)?.spawnLocationId;

    const spawnService = this.context.getService(SpawnService);
    spawnService['handleSpawnLocationPreview']({
      cameraId,
      spawnLocationId,
    });
  }

  /**
   * Handle spawn request event
   * This event is sent when Play button is clicked
   * Event contains spawnLocationId which should be used to spawn the player
   */
  async onSpawnRequest(data: SpawnRequestPayload): Promise<void> {
    this.logger.info('[SpawnLocationSelectionScreen] Spawn request', data);

    const spawnLocationId = data.spawnLocationId || data.payload?.spawnLocationId;

    if (!spawnLocationId) {
      this.logger.error('[SpawnLocationSelectionScreen] No spawnLocationId provided in spawn request');
      return;
    }

    if (!this.currentCharacterId) {
      this.logger.error('[SpawnLocationSelectionScreen] No characterId available for spawn request');
      return;
    }

    try {
      const apiUrl = this.getGamemodeApiUrl();
      const sessionToken = this.getSessionToken();

      if (!apiUrl || !sessionToken) {
        this.logger.error('[SpawnLocationSelectionScreen] Missing API URL or session token');
        return;
      }

      const response = await fetch(`${apiUrl}/characters/spawn`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${sessionToken}`,
        },
        body: JSON.stringify({
          spawnLocationId: spawnLocationId as string,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
        throw new Error(errorData.message || `HTTP ${response.status}`);
      }

      this.logger.info('[SpawnLocationSelectionScreen] Spawn request sent successfully', {
        characterId: this.currentCharacterId,
        spawnLocationId,
      });
    } catch (error) {
      this.logger.error('[SpawnLocationSelectionScreen] Failed to send spawn request:', error);
    }
  }

  private getGamemodeApiUrl(): string | null {
    try {
      if (typeof window !== 'undefined' && window.location) {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('gamemodeApiUrl') || localStorage.getItem('gamemodeApiUrl') || null;
      }
      return null;
    } catch {
      return null;
    }
  }

  private getSessionToken(): string | null {
    try {
      if (typeof window !== 'undefined' && window.location) {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('sessionToken') || localStorage.getItem('sessionToken') || null;
      }
      return null;
    } catch {
      return null;
    }
  }

  async onClosed(data?: ScreenClosedPayload): Promise<void> {
    this.logger.info('[SpawnLocationSelectionScreen] Screen closed');
    this.currentCharacterId = null;
  }

  /**
   * Handle any custom event for this screen
   */
  async handleEvent(eventType: string, data?: unknown): Promise<void> {
    const handlerName = `on${eventType
      .split(/(?=[A-Z])/)
      .map((part, index) => {
        if (index === 0) {
          return part.charAt(0).toUpperCase() + part.slice(1);
        }
        return part;
      })
      .join('')}`;

    const handler = (this as any)[handlerName];

    if (handler && typeof handler === 'function') {
      await handler.call(this, data);
    } else {
      this.logger.debug(`[SpawnLocationSelectionScreen] No handler for event: ${eventType}`, data);
    }
  }
}

