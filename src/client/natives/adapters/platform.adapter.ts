import { ICoreAdapter, IClientLogger } from './core.adapter';
import { IPlayerAdapter } from './player.adapter';
import { INetworkAdapter } from './network.adapter';
import { ICameraAdapter } from './camera.adapter';
import { IWebViewAdapter } from './webview.adapter';
import { IUIAdapter } from './ui.adapter';

export abstract class ClientPlatformAdapter {
  abstract readonly core: ICoreAdapter;
  abstract readonly player: IPlayerAdapter;
  abstract readonly network: INetworkAdapter;
  abstract readonly camera: ICameraAdapter;
  abstract readonly webview: IWebViewAdapter;
  abstract readonly ui: IUIAdapter;
}
