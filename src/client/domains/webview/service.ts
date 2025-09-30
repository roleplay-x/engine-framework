import { RPClientService } from '../../core/client-service';
import { OnServer } from '../../core/events/decorators';
import { RPServerToClientEvents } from '../../../shared/types';
import { ClientTypes } from '../../core/types';

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

export class WebViewService extends RPClientService<ClientTypes> {
  private shellId = 'ui-shell';
  private shellUrl: string | null = null;
  private shellReady = false;
  private contextSent = false;
  private activeScreens: Map<string, ScreenState> = new Map();
  private screenQueue: ScreenCommand[] = [];

  public async init(): Promise<void> {
    this.logger.info('Initializing webview service...');
    this.setupShellProtocol();
    await super.init();
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
  public onShowScreen(data: RPServerToClientEvents['webviewShowScreen']): void {
    if (!this.shellReady) {
      this.screenQueue.push({ type: 'show', data });
      return;
    }

    this.showScreen(data.screen, data.data, data.transition);
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
    this.sendToScreen(data.screen, data.event, data.data);
  }

  @OnServer('webviewSetContext')
  public onSetContext(data: RPServerToClientEvents['webviewSetContext']): void {
    this.sendToShell('webviewSetContext', data);
    this.contextSent = true;
  }

  public showScreen(screen: string, data?: any, transition?: string): void {
    this.logger.info(`Showing screen: ${screen}`, { data, transition });

    this.sendToShell('webviewShowScreen', {
      screen,
      data,
      transition,
    });

    this.activeScreens.set(screen, {
      id: screen,
      lifecycle: ScreenLifecycle.CREATED,
      data,
      timestamp: Date.now(),
    });
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
    this.activeScreens.delete(screen);
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
    this.platformAdapter.webview.registerWebViewCallback('webviewShellReady', () => {
      this.logger.info('Shell is ready');
      this.shellReady = true;
      this.platformAdapter.network.emitToServer('webviewShellReady', {});
    });

    this.platformAdapter.webview.registerWebViewCallback('webviewScreenReady', (data: any) => {
      const { screen } = data;
      this.logger.info(`Screen ready: ${screen}`);

      const state = this.activeScreens.get(screen);
      if (state) {
        state.lifecycle = ScreenLifecycle.READY;
      }

      this.platformAdapter.network.emitToServer('webviewScreenReady', { screen });
    });

    this.platformAdapter.webview.registerWebViewCallback('webviewScreenInitialized', (data: any) => {
      const { screen } = data;
      this.logger.info(`Screen initialized: ${screen}`);

      const state = this.activeScreens.get(screen);
      if (state) {
        state.lifecycle = ScreenLifecycle.INITIALIZED;
      }

      this.platformAdapter.network.emitToServer('webviewScreenInitialized', { screen });
    });

    this.platformAdapter.webview.registerWebViewCallback('webviewScreenAction', (data: any) => {
      const { screen, action, payload } = data;
      this.logger.info(`Screen action: ${screen} -> ${action}`, payload);

      this.platformAdapter.network.emitToServer('webviewScreenAction', {
        screen,
        action,
        payload,
      });
    });

    this.platformAdapter.webview.registerWebViewCallback('webviewScreenError', (data: any) => {
      const { screen, error } = data;
      this.logger.error(`Screen error [${screen}]:`, error);

      this.platformAdapter.network.emitToServer('webviewScreenError', {
        screen,
        error,
      });
    });

    this.platformAdapter.webview.registerWebViewCallback('webviewScreenClosed', (data: any) => {
      const { screen } = data;
      this.logger.info(`Screen closed: ${screen}`);

      this.activeScreens.delete(screen);
      this.platformAdapter.network.emitToServer('webviewScreenClosed', { screen });
    });
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
    this.shellReady = false;
    this.contextSent = false;

    await super.dispose();
  }
}
