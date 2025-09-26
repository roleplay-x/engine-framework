import { Vector3 } from '../../../shared';

export interface SpawnPointData {
  x: number;
  y: number;
  z: number;
  heading?: number;
  model?: string | number;
  skipFade?: boolean;
}

export interface SpawnConfig {
  spawnPoints: SpawnPointData[];
  autoSpawnEnabled?: boolean;
  respawnDelay?: number;
  defaultModel?: string | number;
}

export interface PlayerSpawnOptions {
  spawnPointId?: string;
  position?: Vector3;
  heading?: number;
  model?: string | number;
  skipFade?: boolean;
  callback?: () => void;
}
