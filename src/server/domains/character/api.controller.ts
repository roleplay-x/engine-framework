import { UpdateCharacterAppearanceRequest } from '@roleplayx/engine-sdk';

import {
  ApiController,
  AuthorizedRequest,
  Body,
  Controller,
  EndpointScope,
  Post,
  Put,
  Request,
  SessionToken,
} from '../../api';
import { ConflictError } from '../../core/errors';

import { CharacterService } from './service';
import { SpawnMyCharacterApiRequest } from './models/request/spawn-my-character.api-request';

/**
 * Character API Controller
 *
 * Provides REST API endpoints for managing character-related operations.
 * All endpoints require session authentication and character authorization.
 *
 * @example
 * ```typescript
 * // Update character appearance
 * PUT /characters/appearance
 * Authorization: Basic <session-token>
 * {
 *   "data": {
 *     "hairColor": "brown",
 *     "eyeColor": "blue"
 *   },
 *   "base64Image": "data:image/png;base64,..."
 * }
 * ```
 */
@Controller('/characters')
export class CharacterController extends ApiController {
  private get characterService(): CharacterService {
    return this.context.getService(CharacterService);
  }

  /**
   * Update character appearance
   *
   * Updates the appearance data for the currently linked character. The session must be
   * linked to a character (EndpointScope.CHARACTER). Appearance data is provided as
   * key-value pairs and will be validated against blueprint configurations.
   *
   * @param request - The appearance update request containing data and optional image
   * @param authRequest - The authorized request with session and character info
   * @throws {ConflictError} When session is not linked to a character
   * @throws {EngineError} When the API request fails
   *
   * @example
   * ```typescript
   * // Request body
   * {
   *   "data": {
   *     "hairColor": "brown",
   *     "eyeColor": "blue",
   *     "height": "180"
   *   },
   *   "base64Image": "iVBORw0KGgo..."
   * }
   * ```
   */
  @Put('/appearance', {
    statusCode: 204,
  })
  @SessionToken(EndpointScope.CHARACTER)
  public async updateCharacterAppearance(
    @Body() request: UpdateCharacterAppearanceRequest,
    @Request() authRequest: AuthorizedRequest,
  ): Promise<void> {
    if (!authRequest.characterId || !authRequest.sessionId) {
      throw new ConflictError('SESSION_IS_NOT_LINKED_TO_A_CHARACTER', {});
    }

    await this.characterService.updateCharacterAppearance(
      authRequest.characterId,
      authRequest.sessionId,
      request.data,
      request.base64Image,
    );
  }

  /**
   * Spawn character at selected location
   *
   * Spawns the currently linked character at the selected spawn location. The session must be
   * linked to a character (EndpointScope.CHARACTER) and the character must not have been spawned yet.
   * The spawn location must be valid for the character.
   *
   * @param request - The spawn request containing the selected spawn location ID
   * @param authRequest - The authorized request with session and character info
   * @throws {ConflictError} When session is not linked to a character
   * @throws {NotFoundError} When the spawn location is not found or invalid for the character
   *
   * @example
   * ```typescript
   * // Request body
   * {
   *   "spawnLocationId": "spawn_loc_123"
   * }
   * ```
   */
  @Post('/spawn', {
    statusCode: 204,
  })
  @SessionToken(EndpointScope.CHARACTER)
  public async spawnMyCharacter(
    @Body() request: SpawnMyCharacterApiRequest,
    @Request() authRequest: AuthorizedRequest,
  ): Promise<void> {
    if (!authRequest.characterId || !authRequest.sessionId) {
      throw new ConflictError('SESSION_IS_NOT_LINKED_TO_A_CHARACTER', {});
    }

    await this.characterService.spawnCharacter(authRequest.characterId, request.spawnLocationId);
  }
}
