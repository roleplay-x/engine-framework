import { GameEventName, GameEventArgs } from '../events/game-events';

export interface INetworkAdapter {
  // Network event methods
  onServerEvent(event: string, handler: (...args: any[]) => void): void;
  emitToServer(event: string, ...args: any[]): void;
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
    handler: (...args: GameEventArgs<T>) => void
  ): void;
  
  offGameEvent<T extends GameEventName>(
    event: T, 
    handler: (...args: GameEventArgs<T>) => void
  ): void;
  
  // Platform-specific event mapping
  mapPlatformEvent(platformEvent: string, gameEvent: GameEventName): void;
  unmapPlatformEvent(platformEvent: string): void;
  getMappedGameEvent(platformEvent: string): GameEventName | null;
}
