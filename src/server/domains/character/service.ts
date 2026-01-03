import {
  Character,
  CharacterApi,
  generateCategoryReferenceId,
  ReferenceCategory,
} from '@roleplayx/engine-sdk';
import { ScreenType } from '@roleplayx/engine-ui-sdk';

import { OnClient, OnServer } from '../../core/events/decorators';
import { RPSessionFinished } from '../session/events/session-finished';
import { RPServerService } from '../../core/server-service';
import { RPSessionCharacterLinked } from '../session/events/session-character-linked';
import { AccountId } from '../account/models/account';
import { RPSessionAuthorized } from '../session/events/session-authorized';
import { WebViewService } from '../webview/service';
import { SessionService } from '../session/service';
import { PlayerId, SessionId } from '../session/models/session';
import { ServerPlayer } from '../../natives/entitites';
import { IServiceContext } from '../../core/types';
import { ReferenceService } from '../reference/service';
import { WorldService } from '../world/service';
import { SpawnLocationId } from '../world/models/spawn-location';
import { NotFoundError } from '../../core/errors';
import { RPClientToServerEvents, RPServerToClientEvents } from '../../../shared/types';
import { Vector3 } from '../../../shared';

import { CharacterId, RPCharacter } from './models/character';
import { CharacterFactory } from './factory';

/**
 * Service for managing player characters in the roleplay server.
 *
 * This service provides functionality for:
 * - Character retrieval and caching
 * - Character-to-account relationship management
 * - Character data loading with appearance and motives
 * - Character lifecycle management during session events
 *
 * The service maintains a local cache of active characters that gets populated
 * when players authenticate and select characters. The cache is cleaned up when sessions end.
 *
 * @example
 * ```typescript
 * // Get a character by ID
 * const character = await characterService.getCharacter(characterId);
 * console.log(`Character: ${character.firstName} ${character.lastName}`);
 *
 * // Get all characters for an account
 * const characters = await characterService.getCharactersByAccountId(accountId);
 * console.log(`Account has ${characters.length} characters`);
 *
 * // Get a character with account validation
 * const character = await characterService.getCharacter(characterId, accountId);
 * if (!character) {
 *   console.log('Character not found or does not belong to account');
 * }
 * ```
 */
export class CharacterService extends RPServerService {
  /** Cache of active characters indexed by character ID */
  private readonly characters: Map<CharacterId, RPCharacter> = new Map();
  /** Mapping of account IDs to their character IDs for quick lookup */
  private readonly accountToCharacterIds: Map<AccountId, CharacterId[]> = new Map();

  private readonly characterFactory: CharacterFactory;

  constructor(context: IServiceContext) {
    super(context);
    this.characterFactory = context.getService(CharacterFactory);
  }

  /**
   * Retrieves a character by its unique identifier with optional account validation.
   *
   * First checks the local cache for performance, then falls back to the API
   * if the character is not cached. When an accountId is provided, it validates
   * that the character belongs to that account. Character data includes appearance
   * and motives information.
   *
   * If the character is found via API and belongs to a cached account, it will be
   * added to the cache for subsequent lookups.
   *
   * @param characterId - The unique identifier of the character
   * @param accountId - Optional account ID to validate character ownership
   * @returns Promise resolving to the character details, or undefined if not found or unauthorized
   * @throws {EngineError} When the API request fails
   *
   * @example
   * ```typescript
   * // Get any character by ID
   * const character = await characterService.getCharacter('char_12345');
   * if (character) {
   *   console.log(`Character: ${character.firstName} ${character.lastName}`);
   * }
   *
   * // Get character with account validation
   * const character = await characterService.getCharacter('char_12345', 'acc_98765');
   * if (!character) {
   *   console.log('Character not found or does not belong to account');
   * }
   * ```
   */
  public async getCharacter(
    characterId: CharacterId,
    accountId?: AccountId,
  ): Promise<RPCharacter | undefined> {
    const cachedCharacter = this.characters.get(characterId);
    if (cachedCharacter) {
      if (accountId && cachedCharacter.accountId !== accountId) {
        return;
      }

      return cachedCharacter;
    }

    const character = await this.getEngineApi(CharacterApi)
      .getCharacterById(characterId, {
        includeAppearance: true,
        includeMotives: true,
        accountId,
      })
      .then((character) => this.characterFactory.create({ character }));

    if (this.accountToCharacterIds.has(character.accountId)) {
      this.characters.set(character.id, character);
      this.accountToCharacterIds.get(character.accountId)?.push(character.id);
    }

    return character;
  }

  /**
   * Retrieves all active characters belonging to a specific account.
   *
   * First checks the local cache for characters associated with the account.
   * If no cache exists, fetches from the API with appearance and motives included.
   * Only active (non-deleted) characters are returned.
   *
   * This method is primarily used during session authorization to load all characters.
   *
   * @param accountId - The unique identifier of the account
   * @returns Promise resolving to a read-only array of characters owned by the account
   * @throws {EngineError} When the API request fails
   *
   * @example
   * ```typescript
   * // Get all characters for an account
   * const characters = await characterService.getCharactersByAccountId('acc_12345');
   * console.log(`Account has ${characters.length} characters`);
   *
   * // Display character selection
   * characters.forEach(character => {
   *   console.log(`${character.firstName} ${character.lastName} - Level ${character.level}`);
   * });
   * ```
   */
  public async getCharactersByAccountId(accountId: AccountId): Promise<ReadonlyArray<RPCharacter>> {
    const characterIds = this.accountToCharacterIds.get(accountId);
    if (characterIds) {
      return characterIds.map((characterId) => this.characters.get(characterId)).filter((c) => !!c);
    }

    const accountSegmentDefinitionIds = await this.getService(
      ReferenceService,
    ).fetchReferenceSegmentDefinitionIds(
      generateCategoryReferenceId(ReferenceCategory.Account, accountId),
    );

    const characters = await this.getEngineApi(CharacterApi).getCharacters({
      accountId,
      includeMotives: true,
      includeAppearance: true,
      onlyActive: true,
      pageSize: 20,
      pageIndex: 1,
    });

    return await Promise.all(
      characters.items.map((character) =>
        this.characterFactory.create({
          character,
          accountSegmentDefinitionIds,
        }),
      ),
    );
  }

  /**
   * Updates a character's appearance data and refreshes the cached character.
   *
   * Sends the appearance data to the Engine API, then refreshes the local cache
   * with the updated character data. The character must already exist in the cache.
   *
   * After updating appearance:
   * - If character has never spawned: redirect to spawn location selector
   * - If character was already spawned: close appearance screen and update appearance in-game
   *
   * @param characterId - The unique identifier of the character to update
   * @param sessionId - The session ID of the player
   * @param data - Appearance data as key-value pairs (e.g., { hairColor: 'brown', eyeColor: 'blue' })
   * @param base64Image - Optional base64-encoded image of the character's appearance
   * @returns Promise that resolves when the update is complete
   * @throws {EngineError} When the API request fails
   *
   * @example
   * ```typescript
   * await characterService.updateCharacterAppearance('char_123', 'session_456', {
   *   hairColor: 'brown',
   *   eyeColor: 'blue',
   *   height: '180'
   * }, 'data:image/png;base64,...');
   * ```
   */
  public async updateCharacterAppearance(
    characterId: CharacterId,
    sessionId: SessionId,
    data?: Record<string, string>,
    base64Image?: string,
  ) {
    const updatedCharacter = await this.getEngineApi(CharacterApi).updateCharacterAppearance(
      characterId,
      {
        data,
        base64Image,
      },
    );

    const character = await this.refreshCharacter(updatedCharacter);

    const sessionService = this.getService(SessionService);
    const player = sessionService.getPlayerBySession(sessionId);
    if (!player) {
      this.logger.error(`Player not found for session: ${sessionId}`);
      return;
    }

    const webViewService = this.getService(WebViewService);

    // Check if character was already spawned
    if (!character.spawned) {
      this.logger.info(
        `Character ${characterId} appearance updated, redirecting to spawn location selector`,
      );

      // Close appearance screen
      webViewService.closeScreen(player.id, ScreenType.CharacterAppearance);

      // Show spawn location selector screen
      // Camera will be automatically set by WebViewService.showScreen via WorldService
      await webViewService.showScreen(player.id, ScreenType.SpawnLocationSelection, {
        characterId: character.id,
      });
      
      this.logger.info(`Character ${characterId} ready for spawn location selection`);
    } else {
      this.logger.info(
        `Character ${characterId} appearance updated, closing appearance screen and updating in-game`,
      );

      // Close appearance screen
      webViewService.closeScreen(player.id, ScreenType.CharacterAppearance);

      // TODO: Trigger client-side appearance update
      // player.emit('characterAppearanceUpdated', { values: character.appearance.values });
    }
  }

  /**
   * Spawns a character at the specified spawn location.
   *
   * Validates that the character exists in cache, has not been spawned yet, and that
   * the selected spawn location is valid for the character. Once validated, marks the
   * character as spawned in the local cache.
   *
   * This method is typically called after the player has completed character creation
   * (appearance setup) and selected a spawn location.
   *
   * @param characterId - The unique identifier of the character to spawn
   * @param spawnLocationId - The unique identifier of the selected spawn location
   * @returns Promise that resolves when the character is marked as spawned
   * @throws {NotFoundError} When the spawn location is not found or invalid for the character
   *
   * @example
   * ```typescript
   * // Spawn character at a specific location
   * await characterService.spawnCharacter('char_123', 'spawn_loc_456');
   * console.log('Character spawned successfully');
   * ```
   */
  public async spawnCharacter(characterId: CharacterId, spawnLocationId: SpawnLocationId, playerId?: PlayerId) {
    const character = this.characters.get(characterId);
    if (!character) {
      this.logger.error(`Character ${characterId} not found when spawning the character.`);
      return;
    }

    if (character.spawned) {
      this.logger.warn(`Character ${characterId} already spawned.`);
      return;
    }

    const spawnLocations =
      await this.getEngineApi(CharacterApi).getCharacterSpawnLocations(characterId);

    const spawnLocation = spawnLocations.find((p) => p.id === spawnLocationId);
    if (!spawnLocation) {
      throw new NotFoundError('SPAWN_LOCATION_NOT_FOUND', { id: spawnLocationId });
    }

    this.markCharacterAsSpawned(characterId);

    if (playerId) {
      const sessionService = this.getService(SessionService);
      const player = sessionService.getPlayerByPlayerId(playerId);
      
      if (player) {
        const spawnData: RPServerToClientEvents['spawnExecute'] = {
          position: {
            x: spawnLocation.position.x,
            y: spawnLocation.position.y,
            z: spawnLocation.position.z,
          },
          heading: spawnLocation.position.w || 0,
          skipFade: false,
        };

        this.logger.info(`Sending spawn execute event to player ${playerId}`, {
          characterId,
          spawnLocationId,
          position: spawnData.position,
          heading: spawnData.heading,
        });

        player.emit('spawnExecute', spawnData);
      } else {
        this.logger.warn(`Player ${playerId} not found when sending spawn execute event`);
      }
    }
  }

  /**
   * Marks a character as spawned in the game world.
   *
   * Updates the character's spawned flag to true in the local cache. This should be
   * called after the character has been successfully spawned in the game world for
   * the first time. Does nothing if the character is not in the cache.
   *
   * @param characterId - The unique identifier of the character to mark as spawned
   *
   * @example
   * ```typescript
   * // After spawning the character in the game world
   * characterService.markCharacterAsSpawned('char_123');
   * ```
   */
  public markCharacterAsSpawned(characterId: CharacterId) {
    const character = this.characters.get(characterId);
    if (!character) {
      return;
    }

    this.characters.set(characterId, {
      ...character,
      spawned: true,
    });
  }

  private async refreshCharacter(updatedCharacter: Character): Promise<RPCharacter> {
    const accountSegmentDefinitionIds = this.getService(ReferenceService)
      .getReferenceSegments(
        generateCategoryReferenceId(ReferenceCategory.Account, updatedCharacter.accountId),
      )
      .map((p) => p.id);

    const character = await this.characterFactory.create({
      character: updatedCharacter,
      existingCharacter: this.characters.get(updatedCharacter.id),
      accountSegmentDefinitionIds,
    });
    this.characters.set(updatedCharacter.id, character);
    return character;
  }

  /**
   * Event handler triggered when a session is authorized.
   *
   * Loads all characters for the authorized account into cache and prepares
   * the character-to-account mapping for quick lookup.
   *
   * @param payload - Session authorized event payload containing account info
   */
  @OnServer('sessionAuthorized')
  private async onSessionAuthorized({ account, sessionId }: RPSessionAuthorized) {
    const characters = await this.getCharactersByAccountId(account.id);
    for (const character of characters) {
      this.characters.set(character.id, character);
    }

    this.accountToCharacterIds.set(
      account.id,
      characters.map((p) => p.id),
    );

    const player = this.getService(SessionService).getPlayerBySession(sessionId);
    if (!player) {
      this.logger.error(`Player not found for session: ${sessionId}`);
      return;
    }

    this.getService(WebViewService).closeScreen(player.id, ScreenType.Auth);
    await this.showCharacterSelection(player);
  }

  private showCharacterSelection(player: ServerPlayer) {
    return this.getService(WebViewService).showScreen(player.id, ScreenType.CharacterSelection);
  }

  /**
   * Event handler triggered when a character is linked to a session.
   *
   * Retrieves the full character data and prepares for gameplay by checking
   * character setup status (appearance, spawn location).
   *
   * @param payload - Session character linked event payload containing character info
   */
  @OnServer('sessionCharacterLinked')
  private async onSessionCharacterLinked(payload: RPSessionCharacterLinked) {
    const character = await this.getCharacter(payload.character.id);
    if (!character) {
      this.logger.error(`Character ${payload.character.id} not found for sessionCharacterLinked`);
      return;
    }

    const sessionService = this.getService(SessionService);
    const player = sessionService.getPlayerBySession(payload.sessionId);
    if (!player) {
      this.logger.error(`Player not found for session: ${payload.sessionId}`);
      return;
    }

    const webViewService = this.getService(WebViewService);

    // Check if character appearance needs to be updated
    if (character.appearance.isUpdateRequired) {
      this.logger.info(
        `Character ${character.id} appearance requires update, redirecting to appearance screen`,
      );

      // Close character selection screen
      webViewService.closeScreen(player.id, ScreenType.CharacterSelection);

      // Show character appearance screen
      await webViewService.showScreen(player.id, ScreenType.CharacterAppearance, {
        characterId: character.id,
        values: character.appearance.values,
        isInitial: true,
      });
      return;
    }

    // Character appearance is complete, redirect to spawn location selector
    this.logger.info(
      `Character ${character.id} appearance is complete, redirecting to spawn location selector`,
    );

    // Close character selection screen
    webViewService.closeScreen(player.id, ScreenType.CharacterSelection);

    // Show spawn location selection screen
    await webViewService.showScreen(player.id, ScreenType.SpawnLocationSelection, {
      characterId: character.id,
    });
  }

  /**
   * Event handler triggered when a session is finished.
   *
   * Cleans up the character cache by removing all characters associated with
   * the account that finished their session.
   *
   * @param payload - Session finished event payload containing account ID
   */
  @OnServer('sessionFinished')
  private async onSessionFinished({ accountId }: RPSessionFinished) {
    if (!accountId) {
      return;
    }

    const characterIds = this.accountToCharacterIds.get(accountId);
    if (!characterIds?.length) {
      return;
    }

    for (const characterId of characterIds) {
      this.characters.delete(characterId);
    }

    this.accountToCharacterIds.delete(accountId);
  }

  /**
   * Handle screenshot request from client
   * Triggers client-side screenshot capture and receives the result
   */
  @OnClient('characterRequestScreenshot')
  private async onCharacterRequestScreenshot(
    playerId: PlayerId,
    data: { callbackId: string },
  ): Promise<void> {
    this.logger.info(`Screenshot request from player ${playerId}`, { callbackId: data.callbackId });

    try {
      const sessionService = this.getService(SessionService);
      const player = sessionService.getPlayerByPlayerId(playerId);
      
      if (!player) {
        this.logger.error(`Player not found: ${playerId}`);
        return;
      }

      // Trigger client-side screenshot capture
      // Client will capture screenshot and send it back via 'characterScreenshotCapture' event
      player.emit('server:requestScreenshot', {
        callbackId: data.callbackId,
      });
      
      this.logger.debug(`Screenshot request sent to client ${playerId}`, { callbackId: data.callbackId });
    } catch (error) {
      this.logger.error(`Failed to handle screenshot request for player ${playerId}:`, error);
      
      const sessionService = this.getService(SessionService);
      const player = sessionService.getPlayerByPlayerId(playerId);
      
      if (player) {
        player.emit('characterScreenshotResponse', {
          callbackId: data.callbackId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  }

  /**
   * Handle screenshot capture result from client
   * Receives base64 screenshot from client and forwards it back to requesting client
   */
  @OnClient('characterScreenshotCapture')
  private async onCharacterScreenshotCapture(
    playerId: PlayerId,
    data: { callbackId: string; base64Image?: string; error?: string },
  ): Promise<void> {
    this.logger.info(`Screenshot capture result from player ${playerId}`, { 
      callbackId: data.callbackId,
      hasImage: !!data.base64Image,
      hasError: !!data.error,
    });

    try {
      const sessionService = this.getService(SessionService);
      const player = sessionService.getPlayerByPlayerId(playerId);
      
      if (!player) {
        this.logger.error(`Player not found: ${playerId}`);
        return;
      }

      // Forward screenshot result back to requesting client (same client in this case)
      player.emit('characterScreenshotResponse', {
        callbackId: data.callbackId,
        base64Image: data.base64Image,
        error: data.error,
      });
    } catch (error) {
      this.logger.error(`Failed to handle screenshot capture result for player ${playerId}:`, error);
    }
  }

  /**
   * Handle spawn camera request from client
   * Sets a specific camera or screen camera based on the request
   */
  @OnClient('spawn:requestCamera')
  private async onSpawnRequestCamera(
    playerId: PlayerId,
    data: RPClientToServerEvents['spawn:requestCamera'],
  ): Promise<void> {
    this.logger.info(`Camera request from player ${playerId}`, { cameraId: data.cameraId, screenType: data.screenType });

    try {
      const sessionService = this.getService(SessionService);
      const player = sessionService.getPlayerByPlayerId(playerId);

      if (!player) {
        this.logger.error(`Player not found: ${playerId}`);
        return;
      }

      const worldService = this.getService(WorldService);

      if (data.cameraId) {
        const camera = worldService.getCamera(data.cameraId);
        if (!camera) {
          this.logger.warn(`Camera not found: ${data.cameraId}`);
          return;
        }

        const success = await worldService.setCameraForPlayer(
          player.id,
          data.cameraId,
          data.screenType || ScreenType.SpawnLocationSelection,
        );
        if (!success) {
          this.logger.warn(`Failed to set camera ${data.cameraId} for player ${playerId}`);
        }
      } else if (data.screenType) {
        const success = await worldService.setCameraForScreenType(player.id, data.screenType);
        if (!success) {
          this.logger.warn(`Failed to set screen camera for ${data.screenType} and player ${playerId}`);
        }
      }
    } catch (error) {
      this.logger.error(`Failed to handle camera request for player ${playerId}:`, error);
    }
  }

  /**
   * Handle character preview request from client
   * Sends character appearance data to client for preview
   */
  @OnClient('characterPreview')
  private async onCharacterPreview(
    playerId: PlayerId,
    data: RPClientToServerEvents['characterPreview'],
  ): Promise<void> {
    this.logger.info(`[CharacterService] Character preview event received from player ${playerId}`, { 
      data,
      characterId: data?.characterId 
    });
    
    const characterId = data.characterId;
    if (!characterId) {
      this.logger.warn(`[CharacterService] Character preview request without characterId from player ${playerId}`);
      return;
    }

    this.logger.info(`[CharacterService] Processing character preview request from player ${playerId}`, { characterId });

    try {
      const sessionService = this.getService(SessionService);
      const player = sessionService.getPlayerByPlayerId(playerId);
      const session = sessionService.getSessionByPlayer(playerId);

      if (!player || !session) {
        this.logger.error(`Player or session not found: ${playerId}`);
        return;
      }

      // Get character data
      if (!session.account) {
        this.logger.warn(`Session ${session.id} has no account for character preview`);
        return;
      }

      this.logger.debug(`[CharacterService] Getting character ${characterId} for account ${session.account.id}`);
      const character = await this.getCharacter(characterId, session.account.id);
      if (!character) {
        this.logger.warn(`[CharacterService] Character ${characterId} not found for preview`);
        return;
      }

      this.logger.debug(`[CharacterService] Character found`, {
        characterId,
        hasAppearance: !!character.appearance,
        hasAppearanceValues: !!character.appearance?.values,
        appearanceValuesCount: character.appearance?.values?.length || 0,
      });

      // Send appearance values to CHARACTER_SELECTION screen if available
      if (character.appearance?.values && character.appearance.values.length > 0) {
        const webViewService = this.getService(WebViewService);
        this.logger.info(`[CharacterService] Sending appearance data to CHARACTER_SELECTION screen`, {
          characterId,
          valuesCount: character.appearance.values.length,
          playerId: player.id,
        });
        
        webViewService.sendMessage(
          player.id,
          ScreenType.CharacterSelection,
          'characterAppearancePreview',
          {
            values: character.appearance.values,
          },
        );
        
        this.logger.debug(`[CharacterService] Appearance data sent to CHARACTER_SELECTION screen`, {
          characterId,
          valuesCount: character.appearance.values.length,
        });
      } else {
        this.logger.warn(`[CharacterService] Character ${characterId} has no appearance data for preview`, {
          hasAppearance: !!character.appearance,
          appearanceKeys: character.appearance ? Object.keys(character.appearance) : [],
        });
      }
    } catch (error) {
      this.logger.error(`Failed to handle character preview for player ${playerId}:`, error);
    }
  }

}
