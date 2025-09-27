import { ICoreAdapter } from './core.adapter';
import { IPlayerAdapter } from './player.adapter';
import { INetworkAdapter } from './network.adapter';
import { ICameraAdapter } from './camera.adapter';

export interface IClientLogger {
  debug(message: string, ...args: any[]): void;
  info(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  error(message: string, ...args: any[]): void;
}

export abstract class ClientPlatformAdapter {
  abstract readonly core: ICoreAdapter;
  abstract readonly player: IPlayerAdapter;
  abstract readonly network: INetworkAdapter;
  abstract readonly camera: ICameraAdapter;
}
