import { RPServerService } from '../../core/server-service';
import { ServerPlayer } from '../entitites';
import {
  RPNativeSessionStarted,
  RPPlayerConnecting,
  RPPlayerDeath,
  RPPlayerDisconnected,
  RPPlayerJoined,
  RPPlayerLeft,
  RPPlayerReady,
  RPPlayerSpawn,
  RPSpawnFailed,
  RPSpawnRequest,
} from '../events';
import {
  ClientPlayerDiedPayload,
  ClientSpawnFailedPayload,
  ClientSpawnRequestPayload,
} from '../../../shared';
import { ServerTypes } from '../../core/types';

import { RPSpawnService } from './spawn.service';
import { PlayerId } from '../../domains/session/models/session';

export abstract class RPPlayerService<
  T extends ServerTypes = ServerTypes,
> extends RPServerService<T> {
  // OnClient methods (client events)
  abstract handleClientReady(playerId: PlayerId): Promise<void>;

  abstract handleClientDied(playerId: PlayerId, payload: ClientPlayerDiedPayload): void;

  abstract handleSpawnRequest(playerId: PlayerId, payload: ClientSpawnRequestPayload): void;

  abstract handleSpawnFailed(playerId: PlayerId, payload: ClientSpawnFailedPayload): void;

  // OnServer methods (server events with payloads)
  abstract onPlayerConnecting(payload: RPPlayerConnecting): Promise<void>;

  abstract onSessionStarted(payload: RPNativeSessionStarted): Promise<void>;

  abstract onPlayerDisconnected(payload: RPPlayerDisconnected): Promise<void>;

  abstract onPlayerReady(payload: RPPlayerReady): Promise<void>;

  abstract onPlayerJoined(payload: RPPlayerJoined): Promise<void>;

  abstract onPlayerLeft(payload: RPPlayerLeft): Promise<void>;

  abstract onPlayerDeath(payload: RPPlayerDeath): Promise<void>;

  abstract onPlayerSpawn(payload: RPPlayerSpawn): Promise<void>;

  abstract onSpawnFailed(payload: RPSpawnFailed): Promise<void>;

  abstract onPlayerSpawnRequested(payload: RPSpawnRequest): Promise<void>;

  // Utility methods
  abstract getPlayer(id: PlayerId): ServerPlayer;

  abstract getSpawnManager(): RPSpawnService;
}
