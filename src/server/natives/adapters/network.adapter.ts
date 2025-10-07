import { PlayerId } from '../../domains/session/models/session';
import { RPServerToClientEvents, RPClientToServerEvents } from '../../../shared/types';

export interface INetworkAdapter {
  // Type-safe server to client events
  emitToPlayer<K extends keyof RPServerToClientEvents>(
    playerId: PlayerId,
    event: K,
    data: RPServerToClientEvents[K]
  ): void;

  emitToAll<K extends keyof RPServerToClientEvents>(
    event: K,
    data: RPServerToClientEvents[K]
  ): void;

  // Type-safe client to server events
  onClientEvent<K extends keyof RPClientToServerEvents>(
    event: K,
    handler: (playerId: PlayerId, data: RPClientToServerEvents[K]) => void
  ): void;

  // Legacy methods (deprecated, use typed versions)
  emitToClient<K extends keyof RPServerToClientEvents>(
    playerId: PlayerId,
    event: K,
    data: RPServerToClientEvents[K]
  ): void;

  broadcastToClients<K extends keyof RPServerToClientEvents>(
    event: K,
    data: RPServerToClientEvents[K]
  ): void;
}
