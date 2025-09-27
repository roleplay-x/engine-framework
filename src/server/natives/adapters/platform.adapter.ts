import { RPServerEvents } from '../../core/events/events';
import { IPlayerAdapter } from './player.adapter';
import { IEventAdapter } from './event.adapter';
import { INetworkAdapter } from './network.adapter';
import { ICoreAdapter } from './core.adapter';
import { RPEventEmitter } from '../../../core/bus/event-emitter';

export abstract class PlatformAdapter {
  abstract readonly player: IPlayerAdapter;
  abstract readonly events: IEventAdapter;
  abstract readonly network: INetworkAdapter;
  abstract readonly core: ICoreAdapter;

  protected eventEmitter?: RPEventEmitter<RPServerEvents>;

  setEventEmitter(eventEmitter: RPEventEmitter<RPServerEvents>): void {
    this.eventEmitter = eventEmitter;
  }
}

export abstract class PlatformAdapterFactory {
  abstract create(): PlatformAdapter;
}
