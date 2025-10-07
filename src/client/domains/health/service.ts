import { RPClientService } from '../../core/client-service';
import { OnClient, OnServer, OnGameEvent } from '../../core/events/decorators';
import { ClientTypes } from '../../core/types';
import { RPServerToClientEvents } from '../../../shared/types';

/**
 * Service for managing player health in the roleplay client.
 *
 * This service provides functionality for:
 * - Health monitoring and damage tracking
 * - Server-client health synchronization
 * - Damage event processing and validation
 * - Health state management
 *
 * The service automatically tracks player health changes and communicates
 * damage events to the server while maintaining local health state.
 *
 * @example
 * ```typescript
 * // Health service is automatically initialized with the client
 * const healthService = client.getContext().getService(HealthService);
 *
 * // Health changes are automatically tracked and sent to server
 * // Server can set health via 'health:set' event
 * // Server can validate health via 'health:validate' event
 * ```
 */
export class HealthService extends RPClientService<ClientTypes> {
  private lastHealth = 200;
  private isInitialized = false;

  /**
   * Initializes the health service.
   *
   * Sets up initial health tracking and registers event handlers.
   */
  public async init(): Promise<void> {
    await super.init();

    this.logger.info('HealthService initialized');

    this.lastHealth = this.platformAdapter.player.getPlayerHealth();
    this.isInitialized = true;

    this.logger.debug(`Initial health set to: ${this.lastHealth}`);
  }

  /**
   * Disposes the health service.
   *
   * Cleans up resources and resets state.
   */
  public async dispose(): Promise<void> {
    this.logger.info('HealthService disposed');
    this.isInitialized = false;
    await super.dispose();
  }

  /**
   * Handles entity damage events from the game.
   *
   * Processes damage events specifically for the local player,
   * calculates damage amount, and sends damage information to the server.
   *
   * @param victim - The entity that was damaged
   * @param attacker - The entity that caused the damage
   * @param weaponHash - Hash of the weapon used
   * @param damage - Amount of damage dealt
   */
  @OnGameEvent('entityDamage')
  public onEntityDamage(
    victim: number,
    attacker: number,
    weaponHash: number,
    damage: number,
  ): void {
    if (!this.isInitialized) {
      return;
    }

    try {
      const playerPed = this.platformAdapter.player.getPlayerPed();

      if (victim === playerPed) {
        const currentHealth = this.platformAdapter.player.getPlayerHealth();
        const damageAmount = this.lastHealth - currentHealth;

        this.lastHealth = currentHealth;

        this.logger.debug('Damage event processed', {
          victim,
          attacker,
          weaponHash,
          damage,
          damageAmount,
          currentHealth,
          isFatal: currentHealth <= 0,
        });

        this.eventService.emitToServer('playerDamage', {
          attackerId: attacker,
          damageAmount,
          weaponHash,
          isFatal: currentHealth <= 0,
          timestamp: Date.now(),
        });
      }
    } catch (error) {
      this.logger.warn('Failed to process damage event:', error);
    }
  }

  /**
   * Handles health set events from the server.
   *
   * Sets the player's health to the specified value and updates
   * the local health tracking.
   *
   * @param health - The health value to set
   */
  @OnServer('health:set')
  public onHealthSet(health: RPServerToClientEvents['health:set']): void {
    if (!this.isInitialized) {
      return;
    }

    this.logger.debug(`Setting player health to: ${health}`);

    this.platformAdapter.player.setPlayerHealth(health);
    this.lastHealth = health;
  }

  /**
   * Handles health validation events from the server.
   *
   * Validates the current health against the expected value and
   * corrects it if there's a mismatch.
   *
   * @param expectedHealth - The expected health value
   */
  @OnServer('health:validate')
  public onHealthValidate(expectedHealth: RPServerToClientEvents['health:validate']): void {
    if (!this.isInitialized) {
      return;
    }

    const currentHealth = this.platformAdapter.player.getPlayerHealth();

    if (currentHealth !== expectedHealth) {
      this.logger.warn(
        `Health mismatch detected. Current: ${currentHealth}, Expected: ${expectedHealth}`,
      );

      this.platformAdapter.player.setPlayerHealth(expectedHealth);
      this.lastHealth = expectedHealth;

      this.logger.info(`Health corrected to: ${expectedHealth}`);
    } else {
      this.logger.debug(`Health validation passed: ${currentHealth}`);
    }
  }

  /**
   * Gets the current player health.
   *
   * @returns The current health value
   */
  public getCurrentHealth(): number {
    return this.platformAdapter.player.getPlayerHealth();
  }

  /**
   * Gets the last tracked health value.
   *
   * @returns The last known health value
   */
  public getLastHealth(): number {
    return this.lastHealth;
  }

  /**
   * Checks if the player is dead.
   *
   * @returns True if the player is dead (health <= 0)
   */
  public isPlayerDead(): boolean {
    return this.platformAdapter.player.isPlayerDead();
  }

  /**
   * Manually sets the player's health.
   *
   * This method should be used carefully as it bypasses server validation.
   * Consider using server events for health changes in multiplayer scenarios.
   *
   * @param health - The health value to set
   */
  public setPlayerHealth(health: number): void {
    this.logger.debug(`Manually setting player health to: ${health}`);

    this.platformAdapter.player.setPlayerHealth(health);
    this.lastHealth = health;
  }

  /**
   * Requests health validation from the server.
   *
   * Sends a request to the server to validate the current health state.
   */
  public requestHealthValidation(): void {
    const currentHealth = this.getCurrentHealth();

    this.logger.debug(`Requesting health validation for: ${currentHealth}`);

    this.eventService.emitToServer('player:health:validate', {
      currentHealth,
      timestamp: Date.now(),
    });
  }
}
