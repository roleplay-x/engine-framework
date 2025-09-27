import { PlayerId } from '../../domains/session/models/session';

export interface INetworkAdapter {
  emitToPlayer(playerId: PlayerId, event: string, ...args: any[]): void;
  emitToAll(event: string, ...args: any[]): void;
  onClientEvent(event: string, handler: (playerId: PlayerId, ...args: any[]) => void): void;
  emitToClient(playerId: PlayerId, event: string, ...args: any[]): void;
  broadcastToClients(event: string, ...args: any[]): void;
}
