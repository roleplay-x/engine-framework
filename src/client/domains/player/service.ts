import { RPClientService } from '../../core/client-service';
import { OnClient, OnServer, OnGameEvent } from '../../core/events/decorators';
import { ClientTypes } from '../../core/types';

/**
 * Service for managing player-related functionality in the roleplay client.
 *
 * This service provides functionality for:
 * - Player spawn/despawn handling
 * - Player health management
 * - Player position tracking
 * - Player death handling
 *
 * @example
 * ```typescript
 * const playerService = context.getService(PlayerService);
 * const player = playerService.getCurrentPlayer();
 * ```
 */
export class PlayerService extends RPClientService<ClientTypes> {
  private currentPlayer: any = null;
  private playerHealth: number = 100;

  /**
   * Initializes the player service.
   */
  public async init(): Promise<void> {
    this.logger.info('Initializing player service...');
    await super.init();
  }

  /**
   * Gets the current player instance.
   *
   * @returns Current player instance
   */
  public getCurrentPlayer(): any {
    return this.currentPlayer;
  }

  /**
   * Gets the current player's health.
   *
   * @returns Player health value
   */
  public getPlayerHealth(): number {
    return this.playerHealth;
  }

  /**
   * Sets the current player's health.
   *
   * @param health - Health value to set
   */
  public setPlayerHealth(health: number): void {
    this.playerHealth = Math.max(0, Math.min(100, health));
    this.platformAdapter.player.setPlayerHealth(this.playerHealth);
  }

  /**
   * Gets the player ID.
   *
   * @returns Player ID
   */
  public getPlayerId(): string {
    return this.platformAdapter.player.getPlayerId();
  }

  /**
   * Gets the player ped.
   *
   * @returns Player ped ID
   */
  public getPlayerPed(): number {
    return this.platformAdapter.player.getPlayerPed();
  }

  /**
   * Sets the player model.
   *
   * @param model - Model to set
   */
  public async setPlayerModel(model: string | number): Promise<void> {
    await this.platformAdapter.player.setPlayerModel(model);
  }

  /**
   * Sets player control.
   *
   * @param enable - Whether to enable control
   * @param flags - Control flags
   */
  public setPlayerControl(enable: boolean, flags?: number): void {
    this.platformAdapter.player.setPlayerControl(enable, flags);
  }

  /**
   * Sets player invincible.
   *
   * @param invincible - Whether to make invincible
   */
  public setPlayerInvincible(invincible: boolean): void {
    this.platformAdapter.player.setPlayerInvincible(invincible);
  }

  /**
   * Clears player tasks.
   */
  public clearPlayerTasks(): void {
    this.platformAdapter.player.clearPlayerTasks();
  }

  /**
   * Clears player weapons.
   */
  public clearPlayerWeapons(): void {
    this.platformAdapter.player.clearPlayerWeapons();
  }

  /**
   * Clears player wanted level.
   */
  public clearPlayerWantedLevel(): void {
    this.platformAdapter.player.clearPlayerWantedLevel();
  }

  /**
   * Checks if player is dead.
   *
   * @returns Whether player is dead
   */
  public isPlayerDead(): boolean {
    return this.platformAdapter.player.isPlayerDead();
  }

  /**
   * Sets entity position.
   *
   * @param entity - Entity ID
   * @param position - Position to set
   * @param offset - Whether to use offset
   */
  public setEntityPosition(entity: number, position: any, offset?: boolean): void {
    this.platformAdapter.player.setEntityPosition(entity, position, offset);
  }

  /**
   * Sets entity heading.
   *
   * @param entity - Entity ID
   * @param heading - Heading to set
   */
  public setEntityHeading(entity: number, heading: number): void {
    this.platformAdapter.player.setEntityHeading(entity, heading);
  }

  /**
   * Sets entity visibility.
   *
   * @param entity - Entity ID
   * @param visible - Whether to make visible
   */
  public setEntityVisible(entity: number, visible: boolean): void {
    this.platformAdapter.player.setEntityVisible(entity, visible);
  }

  /**
   * Sets entity collision.
   *
   * @param entity - Entity ID
   * @param collision - Whether to enable collision
   * @param keepPhysics - Whether to keep physics
   */
  public setEntityCollision(entity: number, collision: boolean, keepPhysics?: boolean): void {
    this.platformAdapter.player.setEntityCollision(entity, collision, keepPhysics);
  }

  /**
   * Freezes entity position.
   *
   * @param entity - Entity ID
   * @param freeze - Whether to freeze
   */
  public freezeEntityPosition(entity: number, freeze: boolean): void {
    this.platformAdapter.player.freezeEntityPosition(entity, freeze);
  }

  /**
   * Gets entity coordinates.
   *
   * @param entity - Entity ID
   * @returns Entity coordinates
   */
  public getEntityCoords(entity: number): any {
    return this.platformAdapter.player.getEntityCoords(entity);
  }

  /**
   * Checks if entity is visible.
   *
   * @param entity - Entity ID
   * @returns Whether entity is visible
   */
  public isEntityVisible(entity: number): boolean {
    return this.platformAdapter.player.isEntityVisible(entity);
  }

  /**
   * Checks if entity is dead.
   *
   * @param entity - Entity ID
   * @returns Whether entity is dead
   */
  public isEntityDead(entity: number): boolean {
    return this.platformAdapter.player.isEntityDead(entity);
  }

  /**
   * Checks if entity position is frozen.
   *
   * @param entity - Entity ID
   * @returns Whether position is frozen
   */
  public isEntityPositionFrozen(entity: number): boolean {
    return this.platformAdapter.player.isEntityPositionFrozen(entity);
  }

  /**
   * Gets player from server ID.
   *
   * @param serverId - Server ID
   * @returns Player ID
   */
  public getPlayerFromServerId(serverId: string): number {
    return this.platformAdapter.player.getPlayerFromServerId(serverId);
  }

  /**
   * Resurrects local player.
   *
   * @param position - Position to resurrect at
   * @param heading - Heading to set
   */
  public resurrectLocalPlayer(position: any, heading: number): void {
    this.platformAdapter.player.resurrectLocalPlayer(position, heading);
  }

  /**
   * Handles player spawned event.
   *
   * @param data - Player spawn data
   */
  @OnClient('playerSpawned')
  private onPlayerSpawned(data: any): void {
    this.logger.info('Player spawned:', data);
    this.currentPlayer = data;
    this.playerHealth = 100;
  }

  /**
   * Handles player died event.
   *
   * @param data - Player death data
   */
  @OnClient('playerDied')
  private onPlayerDied(data: any): void {
    this.logger.info('Player died:', data);
    this.playerHealth = 0;
  }

  /**
   * Handles server player joined event.
   *
   * @param data - Player join data
   */
  @OnServer('playerJoined')
  private onPlayerJoined(data: any): void {
    this.logger.info('Player joined server:', data);
  }

  /**
   * Handles server player left event.
   *
   * @param data - Player leave data
   */
  @OnServer('playerLeft')
  private onPlayerLeft(data: any): void {
    this.logger.info('Player left server:', data);
  }

  /**
   * Handles game entity damage event.
   *
   * @param victim - Victim entity ID
   * @param attacker - Attacker entity ID
   * @param weaponHash - Weapon hash
   * @param damage - Damage amount
   */
  @OnGameEvent('entityDamage')
  private onEntityDamage(victim: number, attacker: number, weaponHash: number, damage: number): void {
    this.logger.info(`Entity ${victim} took ${damage} damage from ${attacker} with weapon ${weaponHash}`);
    
    if (this.currentPlayer && this.currentPlayer.id === victim) {
      this.playerHealth = Math.max(0, this.playerHealth - damage);
      this.logger.info(`Player health reduced to: ${this.playerHealth}`);
    }
  }

  /**
   * Handles game vehicle entered event.
   *
   * @param playerId - Player ID
   * @param vehicleId - Vehicle ID
   * @param seat - Seat number
   */
  @OnGameEvent('vehicleEntered')
  private onVehicleEntered(playerId: number, vehicleId: number, seat: number): void {
    this.logger.info(`Player ${playerId} entered vehicle ${vehicleId} in seat ${seat}`);
  }

  /**
   * Handles game vehicle exited event.
   *
   * @param playerId - Player ID
   * @param vehicleId - Vehicle ID
   * @param seat - Seat number
   */
  @OnGameEvent('vehicleExited')
  private onVehicleExited(playerId: number, vehicleId: number, seat: number): void {
    this.logger.info(`Player ${playerId} exited vehicle ${vehicleId} from seat ${seat}`);
  }
}
