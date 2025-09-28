/**
 * Client event types for type safety
 */

export interface RPClientEvents {
  'player:spawned': { position: { x: number; y: number; z: number }; heading: number };
  'player:died': { position: { x: number; y: number; z: number }; killerId?: string };
  'player:healthChanged': { health: number; maxHealth: number };
  'camera:set': CameraData;
  'camera:release': void;
  'camera:login:activate': void;
  'camera:login:release': void;
  'spawn:execute': SpawnData;
  'spawn:failed': { error: string };
  'player:initialize': SpawnData;
  'player:ready': void;
  'player:firstInitCompleted': void;
}

export interface RPServerToClientEvents {
  'player:ready': void;
  'player:spawned': {
    playerId: string;
    data: { position: { x: number; y: number; z: number }; heading: number };
  };
  'player:died': { playerId: string; position: { x: number; y: number; z: number } };
  playerJoined: { playerId: string; ipAddress: string; sessionId: string };
  playerLeft: { playerId: string; reason: string };
  'health:set': number;
  'health:validate': number;
  'spawn:execute': SpawnData;
  'spawn:failed': { error: string };
  'player:initialize': SpawnData;
  'camera:set': CameraData;
  'camera:release': void;
  'player:firstInitCompleted': void;
}

export interface RPClientToServerEvents {
  'player:ready': void;
  'player:spawned': void;
  'player:died': { position: { x: number; y: number; z: number } };
  'player:damage': {
    attackerId: string;
    damageAmount: number;
    weaponHash: number;
    isFatal: boolean;
    timestamp: number;
  };
  'spawn:request': { spawnPointId?: string };
  'spawn:failed': { error: string };
  'player:firstInitCompleted': void;
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
  position: import('../../../shared').Vector3;
  heading: number;
  model?: string | number;
  skipFade?: boolean;
}

export type RPAllClientEvents = RPClientEvents & RPServerToClientEvents;
