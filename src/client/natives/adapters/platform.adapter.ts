import { ICoreAdapter, IClientLogger } from './core.adapter';
import { IPlayerAdapter } from './player.adapter';
import { INetworkAdapter } from './network.adapter';
import { ICameraAdapter } from './camera.adapter';

export abstract class ClientPlatformAdapter {
  abstract readonly core: ICoreAdapter;
  abstract readonly player: IPlayerAdapter;
  abstract readonly network: INetworkAdapter;
  abstract readonly camera: ICameraAdapter;
}
