import { Vector3 } from '../../../shared';

export interface IPlayerAdapter {
  // Player related
  getPlayerId(): string;
  getPlayerPed(): number;
  getRemotePlayerPed(serverId: string): number;
  setPlayerModel(model: string | number): Promise<void>;
  setPlayerControl(enable: boolean, flags?: number): void;
  setPlayerInvincible(invincible: boolean): void;
  clearPlayerTasks(): void;
  clearPlayerWeapons(): void;
  clearPlayerWantedLevel(): void;
  doesEntityExist(entity: number): boolean;

  // Health related
  getPlayerHealth(): number;
  setPlayerHealth(health: number): void;
  isPlayerDead(): boolean;

  // Entity related
  setEntityPosition(entity: number, position: Vector3, offset?: boolean): void;
  setEntityHeading(entity: number, heading: number): void;
  setEntityVisible(entity: number, visible: boolean): void;
  setEntityCollision(entity: number, collision: boolean, keepPhysics?: boolean): void;
  freezeEntityPosition(entity: number, freeze: boolean): void;
  getEntityCoords(entity: number): Vector3;
  getEntityHeading(entity: number): number;
  getEntityForwardVector(entity: number): Vector3;
  getEntityModel(entity: number): number;
  isEntityVisible(entity: number): boolean;
  isEntityDead(entity: number): boolean;
  isEntityPositionFrozen(entity: number): boolean;
  isEntityPlayingAnim(entity: number, animDict: string, animName: string, taskFlag: number): boolean;
  getPlayerFromServerId(serverId: string): number;

  // Animation
  taskPlayAnim(
    entity: number,
    animDict: string,
    animName: string,
    blendInSpeed: number,
    blendOutSpeed: number,
    duration: number,
    flag: number,
    playbackRate: number,
    lockX: boolean,
    lockY: boolean,
    lockZ: boolean
  ): void;

  // Network
  resurrectLocalPlayer(position: Vector3, heading: number): void;
}
