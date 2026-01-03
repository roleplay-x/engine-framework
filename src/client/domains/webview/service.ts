import { RPClientService } from '../../core/client-service';
import { OnServer } from '../../core/events/decorators';
import { RPServerToClientEvents } from '../../../shared/types';
import { ClientTypes } from '../../core/types';
import { EventService } from '../event/service';
import { BaseScreen, CharacterSelectionScreen, CharacterAppearanceScreen, SpawnLocationSelectionScreen, AnimationMenuScreen } from './screens';

enum ScreenLifecycle {
  CREATED = 'created',
  READY = 'ready',
  INITIALIZING = 'initializing',
  INITIALIZED = 'initialized',
  SHOWN = 'shown',
  HIDDEN = 'hidden',
  CLOSING = 'closing',
  CLOSED = 'closed',
}

interface ScreenState {
  id: string;
  lifecycle: ScreenLifecycle;
  data?: any;
  timestamp: number;
}

interface ScreenCommand {
  type: 'show' | 'hide' | 'close' | 'update';
  data: any;
}

type ScreenEventHandler = (data: any) => void | Promise<void>;

interface ScreenHandlers {
  onReady?: ScreenEventHandler;
  onReadyToInitialize?: ScreenEventHandler;
  onInitialized?: ScreenEventHandler;
  onShown?: ScreenEventHandler;
  onHidden?: ScreenEventHandler;
  onClosed?: ScreenEventHandler;
  onError?: ScreenEventHandler;
  [key: string]: ScreenEventHandler | undefined;
}

export class WebViewService extends RPClientService<ClientTypes> {
  private shellId = 'ui-shell';
  private shellUrl: string | null = null;
  private shellReady = false;
  private contextSent = false;
  private activeScreens: Map<string, ScreenState> = new Map();
  private screenQueue: ScreenCommand[] = [];
  
  /**
   * Screen handlers - Add your screen instances here
   */
  private screenHandlers: Map<string, BaseScreen> = new Map();

  public async init(): Promise<void> {
    this.logger.info('Initializing webview service...');
    this.registerScreenHandlers();
    this.setupShellProtocol();
    await super.init();
  }

  /**
   * Register all screen handlers from context
   * Screens are already initialized as services by the client
   */
  private registerScreenHandlers(): void {
    // Get character selection screen from context
    const characterSelectionScreen = this.context.getService(CharacterSelectionScreen);
    this.screenHandlers.set(characterSelectionScreen.getScreenName(), characterSelectionScreen);
    this.logger.info(`Registered screen handler: ${characterSelectionScreen.getScreenName()}`);

    // Get character appearance screen from context
    const characterAppearanceScreen = this.context.getService(CharacterAppearanceScreen);
    this.screenHandlers.set(characterAppearanceScreen.getScreenName(), characterAppearanceScreen);
    this.logger.info(`Registered screen handler: ${characterAppearanceScreen.getScreenName()}`);

    // Get spawn location selection screen from context
    const spawnLocationSelectionScreen = this.context.getService(SpawnLocationSelectionScreen);
    this.screenHandlers.set(spawnLocationSelectionScreen.getScreenName(), spawnLocationSelectionScreen);
    this.logger.info(`Registered screen handler: ${spawnLocationSelectionScreen.getScreenName()}`);

    // Get animation menu screen from context
    const animationMenuScreen = this.context.getService(AnimationMenuScreen);
    this.screenHandlers.set(animationMenuScreen.getScreenName(), animationMenuScreen);
    this.logger.info(`Registered screen handler: ${animationMenuScreen.getScreenName()}`);

    // Add more screen handlers here
    // const inventoryScreen = this.context.getService(InventoryScreen);
    // this.screenHandlers.set(inventoryScreen.getScreenName(), inventoryScreen);

    this.logger.info(`Registered ${this.screenHandlers.size} screen handlers:`, Array.from(this.screenHandlers.keys()));
  }


  @OnServer('webviewConfigureShell')
  public async onConfigureShell(data: RPServerToClientEvents['webviewConfigureShell']): Promise<void> {
    this.logger.info('Configuring shell:', data);
    this.shellUrl = data.shellUrl;

    if (!this.shellReady) {
      await this.initializeShell();
    }
  }

  @OnServer('webviewShowScreen')
  public async onShowScreen(data: RPServerToClientEvents['webviewShowScreen']): Promise<void> {
    if (!this.shellReady) {
      this.screenQueue.push({ type: 'show', data });
      return;
    }

    await this.showScreen(data.screen, data.data, data.transition);
  }

  @OnServer('webviewHideScreen')
  public onHideScreen(data: RPServerToClientEvents['webviewHideScreen']): void {
    this.hideScreen(data.screen);
  }

  @OnServer('webviewCloseScreen')
  public onCloseScreen(data: RPServerToClientEvents['webviewCloseScreen']): void {
    this.closeScreen(data.screen);
  }

  @OnServer('webviewUpdateScreen')
  public onUpdateScreen(data: RPServerToClientEvents['webviewUpdateScreen']): void {
    this.updateScreen(data.screen, data.data);
  }

  @OnServer('webviewSendMessage')
  public onSendMessage(data: RPServerToClientEvents['webviewSendMessage']): void {
    this.logger.info(`[WebViewService] Received webviewSendMessage from server`, {
      screen: data.screen,
      event: data.event,
      hasData: !!data.data,
      dataKeys: data.data ? Object.keys(data.data) : [],
    });
    
    // Send to shell
    this.sendToScreen(data.screen, data.event, data.data);
    
    // Also trigger screen handler directly for immediate processing
    // This ensures the event is handled even if shell hasn't processed it yet
    this.handleScreenEvent(`${data.screen}:${data.event}`, data.data).catch((error) => {
      this.logger.error(`[WebViewService] Error handling screen event ${data.screen}:${data.event}:`, error);
    });
  }

  @OnServer('webviewSetContext')
  public onSetContext(data: RPServerToClientEvents['webviewSetContext']): void {
    this.sendToShell('webviewSetContext', data);
    this.contextSent = true;
  }

  public showScreen(screen: string, data?: any, transition?: string): void {
    this.logger.info(`Showing screen: ${screen}`, { data, transition });

    // Verify screen handler is registered
    const handler = this.screenHandlers.get(screen);
    if (!handler) {
      this.logger.warn(`Screen handler not found for: ${screen}. Available screens:`, Array.from(this.screenHandlers.keys()));
    } else {
      this.logger.info(`Screen handler found for: ${screen}`);
    }

    // Map transition to mode for UI shell
    // UI shell expects 'mode' parameter: 'HIDDEN' or 'SCREEN'
    // transition can be 'hidden' or 'screen' (or other values)
    let mode: string = 'SCREEN';
    if (transition === 'hidden') {
      mode = 'HIDDEN';
    } else if (transition === 'screen' || !transition) {
      mode = 'SCREEN';
    }

    this.sendToShell('webviewShowScreen', {
      screen,
      data,
      mode, // UI shell expects 'mode' not 'transition'
    });

    this.activeScreens.set(screen, {
      id: screen,
      lifecycle: ScreenLifecycle.CREATED,
      data,
      timestamp: Date.now(),
    });

    // If screen is shown (not hidden), trigger onShown handler immediately
    // This ensures focus is set even if UI shell doesn't send shown event
    if (mode === 'SCREEN' && handler) {
      // Call onShown handler to set focus
      if (handler.onShown) {
        try {
          handler.onShown(data);
        } catch (error) {
          this.logger.error(`Error calling onShown for ${screen}:`, error);
        }
      }
    }
  }

  public hideScreen(screen: string): void {
    this.logger.info(`Hiding screen: ${screen}`);
    this.sendToShell('webviewHideScreen', { screen });

    const state = this.activeScreens.get(screen);
    if (state) {
      state.lifecycle = ScreenLifecycle.HIDDEN;
    }
  }

  public closeScreen(screen: string): void {
    this.logger.info(`Closing screen: ${screen}`);
    this.sendToShell('webviewCloseScreen', { screen });

    this.context.getService(EventService).emit('webviewScreenClosed', { screen });
    
    this.activeScreens.delete(screen);

    if (this.activeScreens.size === 0) {
      this.platformAdapter.webview.setWebViewFocus(false, false);
      this.logger.info('All screens closed, mouse/cursor disabled');
    }
  }

  public updateScreen(screen: string, data: any): void {
    this.sendToShell('webviewUpdateScreen', { screen, data });

    const state = this.activeScreens.get(screen);
    if (state) {
      state.data = { ...state.data, ...data };
    }
  }

  public sendToScreen(screen: string, event: string, data: any): void {
    this.sendToShell('webviewSendMessage', { screen, event, data });
  }

  /**
   * Notify a screen with an event
   * Sends a message to the shell using client:notifyScreen format
   * This will be handled by the bridge and converted to webviewScreenAction
   * 
   * @param screen - The screen identifier
   * @param type - The event type
   * @param data - The event data
   */
  public notifyScreen(screen: string, type: string, data: any): void {
    this.logger.debug(`Notifying screen ${screen} with event ${type}`, data);
    
    // Send directly to shell using client:notifyScreen format
    // The bridge will handle this and convert it to webviewScreenAction
    this.platformAdapter.webview.sendMessageToWebView('client:notifyScreen', {
      screen,
      type,
      data,
    });
  }

  /**
   * Handle a screen-specific event
   * Routes events in the format SCREEN_NAME:eventName to the appropriate handler
   */
  private async handleScreenEvent(eventKey: string, data: any): Promise<void> {
    this.logger.info(`[handleScreenEvent] Processing: ${eventKey}`);
    
    // Parse event key: SCREEN_NAME:eventName or SCREEN_NAME:type:eventName
    const parts = eventKey.split(':');
    
    if (parts.length < 2) {
      this.logger.warn(`[handleScreenEvent] Invalid event format: ${eventKey}`);
      return;
    }

    const screenId = parts[0];
    let eventType = parts[parts.length - 1]; // Get last part as event type
    
    // Convert event type from SCREAMING_SNAKE_CASE or SNAKE_CASE to camelCase
    // Handle both formats: CHARACTER_RENDER_REQUESTED -> characterRenderRequested
    if (eventType.includes('_')) {
      const parts = eventType.toLowerCase().split('_');
      eventType = parts[0] + parts.slice(1).map(part => part.charAt(0).toUpperCase() + part.slice(1)).join('');
    }
    
    this.logger.info(`[handleScreenEvent] Screen: ${screenId}, Event: ${eventType}`, data);

    // Update screen lifecycle state for known lifecycle events
    this.updateScreenLifecycle(screenId, eventType);

    // Get screen handler instance
    const screenHandler = this.screenHandlers.get(screenId);
    if (!screenHandler) {
      this.logger.warn(`[handleScreenEvent] No handler registered for screen: ${screenId}`);
      this.logger.info(`[handleScreenEvent] Available screens:`, Array.from(this.screenHandlers.keys()));
      return;
    }

    this.logger.info(`[handleScreenEvent] Found screen handler: ${screenHandler.getScreenName()}`);

    // Convert event type to handler method name (e.g., 'initialized' -> 'onInitialized')
    const handlerName = `on${eventType.charAt(0).toUpperCase()}${eventType.slice(1)}`;
    const handler = (screenHandler as any)[handlerName];

    this.logger.info(`[handleScreenEvent] Looking for handler: ${handlerName}`);

    if (handler && typeof handler === 'function') {
      this.logger.info(`[handleScreenEvent] Calling ${handlerName}`);
      try {
        await handler.call(screenHandler, data);
      } catch (error) {
        this.logger.error(`[handleScreenEvent] Error in ${screenId}.${handlerName}:`, error);
      }
    } else {
      this.logger.debug(`[handleScreenEvent] No method ${handlerName}, trying handleEvent`);
      // Try the generic handleEvent method if specific handler not found
      if (screenHandler.handleEvent) {
        try {
          await screenHandler.handleEvent(eventType, data);
        } catch (error) {
          this.logger.error(`[handleScreenEvent] Error in ${screenId}.handleEvent:`, error);
        }
      } else {
        this.logger.debug(`[handleScreenEvent] No handler found for: ${handlerName}`);
      }
    }
  }

  /**
   * Update screen lifecycle state based on event type
   */
  private updateScreenLifecycle(screenId: string, eventType: string): void {
    const state = this.activeScreens.get(screenId);
    if (!state) return;

    const lifecycleMap: Record<string, ScreenLifecycle> = {
      ready: ScreenLifecycle.READY,
      readyToInitialize: ScreenLifecycle.READY,
      initializing: ScreenLifecycle.INITIALIZING,
      initialized: ScreenLifecycle.INITIALIZED,
      shown: ScreenLifecycle.SHOWN,
      hidden: ScreenLifecycle.HIDDEN,
      closing: ScreenLifecycle.CLOSING,
      closed: ScreenLifecycle.CLOSED,
    };

    const lifecycle = lifecycleMap[eventType];
    if (lifecycle) {
      state.lifecycle = lifecycle;
      this.logger.debug(`Screen ${screenId} lifecycle updated: ${lifecycle}`);
    }
  }

  private async initializeShell(): Promise<void> {
    if (!this.shellUrl) {
      this.logger.error('Shell URL is not configured');
      return;
    }

    this.logger.info('Initializing shell with URL:', this.shellUrl);

    this.platformAdapter.webview.setWebViewFocus(true, true);

    const shellUrl = this.shellUrl;
    setTimeout(() => {
      this.platformAdapter.webview.createWebView(this.shellId, shellUrl, {
        transparent: true,
        zIndex: 1000,
      });
    }, 100);

    await this.waitForShellReady();
    await this.sendInitialContext();
    this.processScreenQueue();
  }

  private async waitForShellReady(): Promise<void> {
    return new Promise((resolve) => {
      const checkReady = () => {
        if (this.shellReady) {
          resolve();
        } else {
          setTimeout(checkReady, 100);
        }
      };
      checkReady();
    });
  }

  private async sendInitialContext(): Promise<void> {
    try {
      const contextData = {
        player: {},
        config: {},
        localization: {},
      };

      this.sendToShell('webviewSetContext', contextData);
      this.contextSent = true;

      this.logger.info('Initial context sent to shell');
    } catch (error) {
      this.logger.error('Failed to send initial context:', error);
    }
  }

  private processScreenQueue(): void {
    if (this.screenQueue.length === 0) {
      return;
    }

    this.logger.info(`Processing ${this.screenQueue.length} queued screen commands`);

    while (this.screenQueue.length > 0) {
      const command = this.screenQueue.shift();
      if (!command) continue;

      switch (command.type) {
        case 'show':
          this.showScreen(command.data.screen, command.data.data, command.data.transition);
          break;
        case 'hide':
          this.hideScreen(command.data.screen);
          break;
        case 'close':
          this.closeScreen(command.data.screen);
          break;
        case 'update':
          this.updateScreen(command.data.screen, command.data.data);
          break;
      }
    }
  }

  private setupShellProtocol(): void {
    this.setupDynamicScreenEventHandler();

    this.platformAdapter.webview.registerWebViewCallback('webviewShellReady', async () => {
      this.logger.info('Shell is ready');
      this.shellReady = true;
      this.platformAdapter.network.emitToServer('webviewShellReady', {});
      
      if (!this.contextSent) {
        await this.sendInitialContext();
      }
      
      this.processScreenQueue();
    });

    // Generic screen lifecycle events (backwards compatible)
    this.platformAdapter.webview.registerWebViewCallback('webviewScreenReady', async (data: any) => {
      const { screen } = data;
      this.logger.info(`Screen ready: ${screen}`);

      const state = this.activeScreens.get(screen);
      if (state) {
        state.lifecycle = ScreenLifecycle.READY;
      }

      // Trigger screen-specific handler
      await this.handleScreenEvent(`${screen}:ready`, data);

      this.context.getService(EventService).emit('webviewScreenReady', { screen });
      this.context.getService(EventService).emitToServer('webviewScreenReady', { screen });
    });

    this.platformAdapter.webview.registerWebViewCallback('webviewScreenInitialized', async (data: any) => {
      const { screen } = data;
      this.logger.info(`Screen initialized: ${screen}`);

      const state = this.activeScreens.get(screen);
      if (state) {
        state.lifecycle = ScreenLifecycle.INITIALIZED;
      }

      // Trigger screen-specific handler
      await this.handleScreenEvent(`${screen}:initialized`, data);

      this.platformAdapter.network.emitToServer('webviewScreenInitialized', { screen });
    });

    this.platformAdapter.webview.registerWebViewCallback('webviewScreenAction', async (data: any) => {
      const { screen, action, payload } = data;
      this.logger.info(`Screen action: ${screen} -> ${action}`, payload);

      // Update lifecycle for shown/hidden actions
      if (action === 'shown') {
        const state = this.activeScreens.get(screen);
        if (state) {
          state.lifecycle = ScreenLifecycle.SHOWN;
        }
      } else if (action === 'hidden') {
        const state = this.activeScreens.get(screen);
        if (state) {
          state.lifecycle = ScreenLifecycle.HIDDEN;
        }
      }

      // Trigger screen-specific handler
      await this.handleScreenEvent(`${screen}:${action}`, payload);

      this.platformAdapter.network.emitToServer('webviewScreenAction', {
        screen,
        action,
        payload,
      });
    });

    this.platformAdapter.webview.registerWebViewCallback('webviewScreenError', async (data: any) => {
      const { screen, error } = data;
      this.logger.error(`Screen error [${screen}]:`, error);

      // Trigger screen-specific handler
      await this.handleScreenEvent(`${screen}:error`, { error });

      this.platformAdapter.network.emitToServer('webviewScreenError', {
        screen,
        error,
      });
    });

    this.platformAdapter.webview.registerWebViewCallback('webviewScreenClosed', async (data: any) => {
      const { screen } = data;
      this.logger.info(`Screen closed: ${screen}`);

      // Trigger screen-specific handler
      await this.handleScreenEvent(`${screen}:closed`, data);

      this.activeScreens.delete(screen);
      this.context.getService(EventService).emit('webviewScreenClosed', { screen });
      this.context.getService(EventService).emitToServer('webviewScreenClosed', { screen });
    });
  }

  /**
   * Setup dynamic screen event handler that captures all screen-based events
   * Events format: SCREEN_NAME:eventType or SCREEN_NAME:category:eventType
   * Examples: CHARACTER_SELECTION:initialized, CHARACTER_SELECTION:screen:readyToInitialize
   */
  private setupDynamicScreenEventHandler(): void {
    this.logger.info('[setupDynamicScreenEventHandler] Registering __screenEvent handler');
    
    this.platformAdapter.webview.registerWebViewCallback('__screenEvent', async (data: any) => {
      this.logger.info('[__screenEvent] Received screen event', data);
      
      const { event, payload } = data;
      
      if (event && event.includes(':')) {
        this.logger.info(`[__screenEvent] Processing event: ${event}`);
        await this.handleScreenEvent(event, payload || {});
      } else {
        this.logger.warn(`[__screenEvent] Invalid event format:`, data);
      }
    });
    
    this.logger.info('[setupDynamicScreenEventHandler] __screenEvent handler registered');
  }

  private sendToShell(event: string, data: any): void {
    this.platformAdapter.webview.sendMessageToWebView(event, data);
  }

  public getActiveScreens(): string[] {
    return Array.from(this.activeScreens.keys());
  }

  public getScreenState(screen: string): ScreenState | undefined {
    return this.activeScreens.get(screen);
  }

  public isScreenActive(screen: string): boolean {
    const state = this.activeScreens.get(screen);
    return (
      state?.lifecycle === ScreenLifecycle.SHOWN || state?.lifecycle === ScreenLifecycle.INITIALIZED
    );
  }

  public isShellReady(): boolean {
    return this.shellReady;
  }

  public async dispose(): Promise<void> {
    if (this.shellUrl) {
      this.platformAdapter.webview.destroyWebView(this.shellId);
    }

    this.activeScreens.clear();
    this.screenQueue = [];
    this.screenHandlers.clear();
    this.shellReady = false;
    this.contextSent = false;

    await super.dispose();
  }

  /**
   * Get screen handler instance for external use
   */
  public getScreenHandler<T extends BaseScreen>(screenName: string): T | undefined {
    return this.screenHandlers.get(screenName) as T;
  }
}

// Export types and screens
export type { ScreenHandlers, ScreenEventHandler };
export { ScreenLifecycle };
export { BaseScreen, CharacterSelectionScreen } from './screens';
