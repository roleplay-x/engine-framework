import { SpawnLocation } from '@roleplayx/engine-sdk';

export type SpawnLocationId = string;

export interface RPSpawnLocation extends SpawnLocation {
  id: SpawnLocationId;
}
