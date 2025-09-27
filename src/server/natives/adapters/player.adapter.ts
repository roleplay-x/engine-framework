import { Vector3 } from '../../../../shared/math';
import { PlayerId } from '../../../domains/session/models/session';

export interface IPlayerAdapter {
  getPlayerId(): PlayerId;
  getCurrentPlayerId(): PlayerId;
  getPlayerName(playerId: PlayerId): string;
  getPlayerIP(playerId: PlayerId): string;
  kickPlayer(playerId: PlayerId, reason: string): void;
  getPlayerPosition(playerId: PlayerId): Vector3;
  setPlayerPosition(playerId: PlayerId, position: Vector3): void;
  getPlayerHealth(playerId: PlayerId): number;
}
