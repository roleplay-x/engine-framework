import { RPClientService } from '../../core/client-service';
import { ClientTypes } from '../../core/types';
import { OnServer } from '../../core/events/decorators';
import { RPServerToClientEvents } from '../../../shared/types';

export class UIService extends RPClientService<ClientTypes> {
  private serverName: string = 'Loading...';
  private tickHandle: number | null = null;

  public async init(): Promise<void> {
    this.logger.info('Initializing UI service...');
    await super.init();
  }

  @OnServer('serverConfig')
  private async onServerConfig(payload: RPServerToClientEvents['serverConfig']) {
    this.serverName = payload.serverName;
    this.logger.info(`Server name updated: ${this.serverName}`);
    
    if (!this.tickHandle) {
      this.startRenderLoop();
    }
  }

  private startRenderLoop(): void {
    const adapter = this.platformAdapter;
    
    this.tickHandle = adapter.core.setTick(() => {
      // Bottom bar with server name
      adapter.ui.drawRect(0.5, 0.975, 1.0, 0.05, {
        color: { r: 0, g: 0, b: 0, a: 180 },
      });

      adapter.ui.drawText2D(0.5, 0.965, this.serverName, {
        scale: 0.4,
        font: 4,
        color: { r: 255, g: 255, b: 255, a: 255 },
        centered: true,
        outline: true,
      });

      // Top left - BETA watermark with red background
      adapter.ui.drawRect(0.06, 0.03, 0.08, 0.035, {
        color: { r: 220, g: 20, b: 60, a: 200 },
      });

      adapter.ui.drawText2D(0.06, 0.02, 'BETA', {
        scale: 0.5,
        font: 4,
        color: { r: 255, g: 255, b: 255, a: 255 },
        centered: true,
        outline: true,
      });

      // Top right - Version info
      adapter.ui.drawText2D(0.95, 0.02, 'v0.1.0', {
        scale: 0.35,
        font: 4,
        color: { r: 150, g: 150, b: 150, a: 200 },
        alignment: 'right',
        outline: true,
      });

      // Top center - Framework label
      adapter.ui.drawText2D(0.5, 0.01, 'RoleplayX Engine Framework', {
        scale: 0.3,
        font: 4,
        color: { r: 100, g: 200, b: 255, a: 180 },
        centered: true,
        outline: true,
      });

      // Left side - Status indicator
      adapter.ui.drawRect(0.01, 0.5, 0.003, 0.15, {
        color: { r: 0, g: 255, b: 0, a: 150 },
      });

      adapter.ui.drawText2D(0.005, 0.56, 'ONLINE', {
        scale: 0.25,
        font: 4,
        color: { r: 0, g: 255, b: 0, a: 255 },
        outline: true,
      });
    });
  }

  public getServerName(): string {
    return this.serverName;
  }

  public async dispose(): Promise<void> {
    this.logger.info('Disposing UI service...');
    
    if (this.tickHandle !== null) {
      this.platformAdapter.core.clearTick(this.tickHandle);
      this.tickHandle = null;
    }

    await super.dispose();
  }
}

