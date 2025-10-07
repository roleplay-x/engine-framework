import { GameEventName, GameEventArgs } from '../events/game-events';
import { RPServerToClientEvents, RPClientToServerEvents } from '../../../shared/types';

export interface INetworkAdapter {
  // Type-safe server event methods
  onServerEvent<K extends keyof RPServerToClientEvents>(
    event: K,
    handler: (data: RPServerToClientEvents[K]) => void
  ): void;

  emitToServer<K extends keyof RPClientToServerEvents>(
    event: K,
    data: RPClientToServerEvents[K]
  ): void;

  // Local event methods (less strict for flexibility)
  on(event: string, handler: (...args: any[]) => void): void;
  off(event: string, handler: (...args: any[]) => void): void;
  once(event: string, handler: (...args: any[]) => void): void;
  emit(event: string, ...args: any[]): void;

  // Event management
  removeAllListeners(event?: string): void;
  listenerCount(event: string): number;

  // Game event methods with platform mapping
  onGameEvent<T extends GameEventName>(
    event: T,
    handler: (...args: GameEventArgs<T>) => void,
  ): void;

  offGameEvent<T extends GameEventName>(
    event: T,
    handler: (...args: GameEventArgs<T>) => void,
  ): void;

  // Platform-specific event mapping
  mapPlatformEvent(platformEvent: string, gameEvent: GameEventName): void;
  unmapPlatformEvent(platformEvent: string): void;
  getMappedGameEvent(platformEvent: string): GameEventName | null;

  // Connection management
  isConnected(): boolean;
  getServerId(): string;
  getPlayerCount(): number;
}
