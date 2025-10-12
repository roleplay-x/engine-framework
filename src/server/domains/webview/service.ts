import { RPServerService } from '../../core/server-service';
import { OnClient, OnHook, OnServer } from '../../core/events/decorators';
import { SessionService } from '../session/service';
import { PlayerId, RPSession, SessionId } from '../session/models/session';
import { RPClientToServerEvents } from '../../../shared/types';
import { RPServer } from '../../server';
import { ServerPlayer } from '../../natives/entitites';

export class WebViewService extends RPServerService {
  public async init(): Promise<void> {
    this.logger.info('Initializing webview service...');
    await super.init();
  }

  @OnServer('sessionStarted')
  private async onSessionStarted(data: {
    sessionId: string;
    sessionToken: string;
  }): Promise<void> {
    this.logger.info('Session started, configuring shell and showing LOGIN screen:', data);

    const player = this.getService(SessionService).getPlayerBySession(data.sessionId);
    if (!player) {
      this.logger.error(`Player not found for session: ${data.sessionId}`);
      return;
    }

    const session = this.getService(SessionService).getSessionByPlayer(player.id);
    if (!session) {
      this.logger.error(`Session not found for player: ${player.id}`);
      return;
    }

    const shellUrl = this.buildShellUrl(session);
    player.emit('webviewConfigureShell', {
      shellUrl,
    });

    this.logger.info(`Shell configured for player ${player.id} with URL: ${shellUrl}`);

    this.showScreen(player.id, 'LOGIN', {
      sessionId: data.sessionId,
      sessionToken: data.sessionToken,
    });

    this.logger.info(`LOGIN screen shown for player ${player.id}`);
  }

  private buildShellUrl(session: RPSession): string {
    const shellUrl = RPServer.get().getShellUrl();
    const apiUrl = RPServer.get().getContext().getEngineClient().getApiUrl();
    const serverId = RPServer.get().getContext().getEngineClient().getServerId();
    return shellUrl+`?engineApiUrl=${apiUrl}&serverId=${serverId}&sessionId=${session.id}&sessionToken=${session.token}&gamemodeApiUrl=http://localhost:3000`;
  }

  @OnClient('webviewShellReady')
  private onShellReady(playerId: PlayerId): void {
    this.logger.info(`Shell ready for player: ${playerId}`);
  }

  @OnClient('webviewScreenReady')
  private onScreenReady(playerId: PlayerId, data: RPClientToServerEvents['webviewScreenReady']): void {
    this.logger.info(`Screen ready for player ${playerId}:`, data.screen);
  }

  @OnClient('webviewScreenInitialized')
  private onScreenInitialized(
    playerId: PlayerId,
    data: RPClientToServerEvents['webviewScreenInitialized'],
  ): void {
    this.logger.info(`Screen initialized for player ${playerId}:`, data.screen);
  }

  @OnClient('webviewScreenAction')
  private onScreenAction(
    playerId: PlayerId,
    data: RPClientToServerEvents['webviewScreenAction'],
  ): void {
    const { screen, action, payload } = data;
    this.logger.info(`Screen action from player ${playerId} [${screen}]:`, action, payload);

    this.handleScreenAction(playerId, screen, action, payload);
  }

  @OnClient('webviewScreenError')
  private onScreenError(playerId: PlayerId, data: RPClientToServerEvents['webviewScreenError']): void {
    this.logger.error(`Screen error from player ${playerId} [${data.screen}]:`, data.error);
  }

  @OnClient('webviewScreenClosed')
  private onScreenClosed(
    playerId: PlayerId,
    data: RPClientToServerEvents['webviewScreenClosed'],
  ): void {
    this.logger.info(`Screen closed by player ${playerId}:`, data.screen);
  }

  private handleScreenAction(playerId: PlayerId, screen: string, action: string, payload: any): void {
    switch (screen) {
      case 'LOGIN':
        this.handleLoginAction(playerId, action, payload);
        break;
      case 'CHARACTER_CREATOR':
        this.handleCharacterCreatorAction(playerId, action, payload);
        break;
      case 'CHARACTER_SELECT':
        this.handleCharacterSelectAction(playerId, action, payload);
        break;
      default:
        this.logger.warn(`Unhandled screen action: ${screen} -> ${action}`);
    }
  }

  private handleLoginAction(playerId: PlayerId, action: string, payload: any): void {
    this.logger.info(`Login action [${action}]:`, payload);
  }

  private handleCharacterCreatorAction(playerId: PlayerId, action: string, payload: any): void {
    this.logger.info(`Character creator action [${action}]:`, payload);
  }

  private handleCharacterSelectAction(playerId: PlayerId, action: string, payload: any): void {
    this.logger.info(`Character select action [${action}]:`, payload);
  }

  public showScreen(
    playerId: PlayerId,
    screen: string,
    data?: Record<string, any>,
    transition?: 'fade' | 'slide' | 'none',
  ): void {
    const sessionService = this.getService(SessionService);
    const player = sessionService.getPlayerByPlayerId(playerId);
    if (!player) {
      this.logger.error(`Player not found: ${playerId}`);
      return;
    }

    player.emit('webviewShowScreen', {
      screen,
      data,
      transition,
    });
  }

  public hideScreen(playerId: PlayerId, screen: string): void {
    const sessionService = this.getService(SessionService);
    const player = sessionService.getPlayerByPlayerId(playerId);

    if (!player) {
      this.logger.error(`Player not found: ${playerId}`);
      return;
    }

    player.emit('webviewHideScreen', { screen });
  }

  public closeScreen(playerId: PlayerId, screen: string): void {
    const sessionService = this.getService(SessionService);
    const player = sessionService.getPlayerByPlayerId(playerId);

    if (!player) {
      this.logger.error(`Player not found: ${playerId}`);
      return;
    }

    player.emit('webviewCloseScreen', { screen });
  }

  public updateScreen(playerId: PlayerId, screen: string, data: Record<string, any>): void {
    const sessionService = this.getService(SessionService);
    const player = sessionService.getPlayerByPlayerId(playerId);

    if (!player) {
      this.logger.error(`Player not found: ${playerId}`);
      return;
    }

    player.emit('webviewUpdateScreen', {
      screen,
      data,
    });
  }

  public sendMessage(playerId: PlayerId, screen: string, event: string, data: any): void {
    const sessionService = this.getService(SessionService);
    const player = sessionService.getPlayerByPlayerId(playerId);

    if (!player) {
      this.logger.error(`Player not found: ${playerId}`);
      return;
    }

    player.emit('webviewSendMessage', {
      screen,
      event,
      data,
    });
  }
}
