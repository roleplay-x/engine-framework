import {
  Character,
  CharacterApi,
  generateCategoryReferenceId,
  ReferenceCategory,
} from '@roleplayx/engine-sdk';
import { ScreenType } from '@roleplayx/engine-ui-sdk';

import { OnServer } from '../../core/events/decorators';
import { RPSessionFinished } from '../session/events/session-finished';
import { RPServerService } from '../../core/server-service';
import { RPSessionCharacterLinked } from '../session/events/session-character-linked';
import { AccountId } from '../account/models/account';
import { RPSessionAuthorized } from '../session/events/session-authorized';
import { WebViewService } from '../webview/service';
import { SessionService } from '../session/service';
import { ServerPlayer } from '../../natives/entitites';
import { IServiceContext } from '../../core/types';
import { ReferenceService } from '../reference/service';

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
   * @param characterId - The unique identifier of the character to update
   * @param data - Appearance data as key-value pairs (e.g., { hairColor: 'brown', eyeColor: 'blue' })
   * @param base64Image - Optional base64-encoded image of the character's appearance
   * @returns Promise that resolves when the update is complete
   * @throws {EngineError} When the API request fails
   *
   * @example
   * ```typescript
   * await characterService.updateCharacterAppearance('char_123', {
   *   hairColor: 'brown',
   *   eyeColor: 'blue',
   *   height: '180'
   * }, 'data:image/png;base64,...');
   * ```
   */
  public async updateCharacterAppearance(
    characterId: CharacterId,
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

    await this.refreshCharacter(updatedCharacter);

    // TODO: if character.spawned === false, redirect to spawn screen
    // else, just close appearance screen & hide loading (and update players appearance)
    // NOTE: we need to call markCharacterAsSpawned() after/before/during the first spawn - or update it with an event
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

    // TODO: check character appearance
    // if character.appearance.isUpdateRequired == true: redirect it to the appearance editor
    // else: redirect it to the spawn location selector
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
}
