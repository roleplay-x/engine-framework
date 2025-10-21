import { AuthorizeSessionRequest, LinkCharacterToSessionRequest } from '@roleplayx/engine-sdk';
import { SessionInfo } from '@roleplayx/engine-sdk/session/models/session-info';

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

import { SessionService } from './service';

/**
 * Session API Controller
 */
@Controller('/sessions')
export class SessionController extends ApiController {
  private get sessionService(): SessionService {
    return this.context.getService(SessionService);
  }

  /**
   * Authorize session
   *
   * Authorizes a session with the given access token. It associates the session with the account that owns the access token.
   * The session must not already be authorized (linked to an account).
   *
   * @param request - The authorize session request containing access token
   * @param authRequest - The authorized request containing session info
   * @returns Session information with account and character details
   * @throws ConflictError when session is already authorized
   */
  @Put('/auth', {
    statusCode: 200,
  })
  @SessionToken(EndpointScope.SERVER)
  public async authorizeSession(
    @Body() request: AuthorizeSessionRequest,
    @Request() authRequest: AuthorizedRequest,
  ): Promise<SessionInfo> {
    const sessionId = authRequest.sessionId!;
    const session = this.sessionService.getSession(sessionId);

    if (session?.account) {
      throw new ConflictError('SESSION_HAS_AUTHORIZED', {});
    }

    return this.sessionService.authorizeSession(sessionId, request);
  }

  /**
   * Link character to session
   *
   * Links a character to an authorized session. The session must already be authorized (linked to an account)
   * but must not be linked to a character yet.
   *
   * @param request - The link character request containing character information
   * @param authRequest - The authorized request containing session info
   * @returns Session information with account and character details
   * @throws ConflictError when session is already linked to a character
   */
  @Put('/character', {
    statusCode: 200,
  })
  @SessionToken(EndpointScope.ACCOUNT)
  public async linkCharacterToSession(
    @Body() request: LinkCharacterToSessionRequest,
    @Request() authRequest: AuthorizedRequest,
  ): Promise<SessionInfo> {
    const sessionId = authRequest.sessionId!;
    const session = this.sessionService.getSession(sessionId);

    if (session?.character) {
      throw new ConflictError('SESSION_IS_ALREADY_LINKED_TO_CHARACTER', {});
    }

    return this.sessionService.linkCharacterToSession(sessionId, request);
  }
}
