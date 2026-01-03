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

  /**
   * Loads an animation dictionary.
   * @param animDict - Animation dictionary name
   * @returns Promise that resolves when the dictionary is loaded
   */
  loadAnimDict(animDict: string): Promise<boolean>;

  /**
   * Gets the duration of an animation.
   * @param animDict - Animation dictionary name
   * @param animName - Animation name
   * @returns Duration in seconds
   */
  getAnimDuration(animDict: string, animName: string): number;

  /**
   * Gets the current time of an animation being played.
   * @param entity - Entity handle
   * @param animDict - Animation dictionary name
   * @param animName - Animation name
   * @returns Current time (0.0 to 1.0)
   */
  getEntityAnimCurrentTime(entity: number, animDict: string, animName: string): number;

  /**
   * Sets the current time of an animation being played.
   * @param entity - Entity handle
   * @param animDict - Animation dictionary name
   * @param animName - Animation name
   * @param time - Time value (0.0 to 1.0)
   */
  setEntityAnimCurrentTime(entity: number, animDict: string, animName: string, time: number): void;

  /**
   * Sets the speed of an animation being played.
   * @param entity - Entity handle
   * @param animDict - Animation dictionary name
   * @param animName - Animation name
   * @param speed - Speed multiplier (0.0 = paused, 1.0 = normal)
   */
  setEntityAnimSpeed(entity: number, animDict: string, animName: string, speed: number): void;

  /**
   * Creates a prop object.
   * @param model - Model name or hash
   * @param position - Position to create the prop
   * @returns Promise that resolves with the prop entity handle
   */
  createProp(model: string | number, position: Vector3): Promise<number>;

  /**
   * Attaches an entity to another entity.
   * @param entity1 - Entity to attach
   * @param entity2 - Entity to attach to
   * @param boneIndex - Bone index on entity2
   * @param offset - Position offset
   * @param rotation - Rotation offset
   */
  attachEntityToEntity(
    entity1: number,
    entity2: number,
    boneIndex: number,
    offset: Vector3,
    rotation: Vector3
  ): void;

  /**
   * Deletes an entity.
   * @param entity - Entity handle
   */
  deleteEntity(entity: number): void;

  /**
   * Sets facial idle animation override.
   * @param ped - Ped handle
   * @param animName - Animation name
   * @param animDict - Animation dictionary name
   */
  setFacialIdleAnimOverride(ped: number, animName: string, animDict: string): void;

  /**
   * Sets ped movement clipset.
   * @param ped - Ped handle
   * @param clipSet - Clipset name
   * @param transitionSpeed - Transition speed
   */
  setPedMovementClipset(ped: number, clipSet: string, transitionSpeed: number): Promise<void>;

  /**
   * Gets ped bone index.
   * @param ped - Ped handle
   * @param boneId - Bone ID
   * @returns Bone index
   */
  getPedBoneIndex(ped: number, boneId: number): number;

  /**
   * Starts a scenario in place.
   * @param ped - Ped handle
   * @param scenarioName - Scenario name
   * @param unkDelay - Unknown delay parameter
   * @param playEnterAnim - Whether to play enter animation
   */
  taskStartScenarioInPlace(ped: number, scenarioName: string, unkDelay: number, playEnterAnim: boolean): void;

  // Network
  resurrectLocalPlayer(position: Vector3, heading: number): void;
}
