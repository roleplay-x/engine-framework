/**
 * Client event types for type safety
 */

import { PlayerId } from '../server/domains/session/models/session';

export interface RPClientEvents {
  'playerReady': void;
}

export interface RPServerToClientEvents {
  'playerSpawned': {
    data: { position: { x: number; y: number; z: number }; heading: number };
  };
  'playerDied': { position: { x: number; y: number; z: number } };
  playerJoined: { ipAddress: string; sessionId: string };
  playerLeft: { reason: string };
  'health:set': number;
  'health:validate': number;
  'spawnExecute': SpawnData;
  'spawn:failed': { error: string };
  'player:initialize': SpawnData;
  'cameraSet': CameraData;
  'cameraRelease': void;
}

export interface RPClientToServerEvents {
  'playerReady': {};
  'playerSpawned': { data: { position: { x: number; y: number; z: number }; heading: number } };
  'playerDied': { position: { x: number; y: number; z: number } };
  'playerDamage': {
    attackerId: PlayerId;
    damageAmount: number;
    weaponHash: number;
    isFatal: boolean;
    timestamp: number;
  };
  'spawnRequest': { spawnPointId?: string };
  'spawnFailed': { error: string };
}

export interface CameraData {
  id: string;
  type: 'static' | 'follow' | 'orbit' | 'cinematic';
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  fov: number;
  freezePlayer?: boolean;
  hideHud?: boolean;
  enabled?: boolean;
}

export interface SpawnData {
  position: import('.').Vector3;
  heading: number;
  model?: string | number;
  skipFade?: boolean;
}