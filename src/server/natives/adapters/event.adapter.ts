import { PlayerId } from '../../../domains/session/models/session';

export interface IEventAdapter {
  initializeEvents(): void;
  onPlayerJoin(callback: (playerId: PlayerId, ipAddress: string, name: string) => void): void;
  onPlayerLeave(callback: (playerId: PlayerId, reason: string) => void): void;
  onPlayerDeath(callback: (playerId: PlayerId, killerId?: number, weapon?: string) => void): void;
  onPlayerSpawn(
    callback: (playerId: PlayerId, position: { x: number; y: number; z: number }) => void,
  ): void;
  onPlayerReady(callback: (playerId: PlayerId) => void): void;
}
