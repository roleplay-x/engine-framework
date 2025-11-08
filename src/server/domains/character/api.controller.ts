import { UpdateCharacterAppearanceRequest } from '@roleplayx/engine-sdk';

import {
  ApiController,
  AuthorizedRequest,
  Body,
  Controller,
  EndpointScope,
  Put,
  Request,
  SessionToken,
} from '../../api';
import { ConflictError } from '../../core/errors';

import { CharacterService } from './service';

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
}
