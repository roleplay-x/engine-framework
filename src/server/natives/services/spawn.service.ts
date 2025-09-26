import { RPServerService } from '../../core/server-service';
import { SpawnPoint } from '../entitites';
import { PlayerSpawnOptions, SpawnConfig, SpawnPointData } from '../types';
import { ServerTypes } from '../../core/types';

export abstract class RPSpawnService<
  T extends ServerTypes = ServerTypes,
> extends RPServerService<T> {
  abstract setSpawnPoint(spawnData: SpawnPointData): void;

  abstract clearSpawnPoint(): void;

  abstract getSpawnPoint(): SpawnPoint | undefined;

  abstract loadSpawnsFromConfig(config: SpawnConfig): void;

  abstract spawnPlayer(playerId: string, options?: PlayerSpawnOptions): void;
}
