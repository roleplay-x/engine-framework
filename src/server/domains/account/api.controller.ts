import {
  AccountAuthRequest,
  DiscordOAuthRedirectType,
  ExternalLoginAuthRequest,
  GrantAccessResult,
  RedirectUri,
  RegisterAccountRequest,
} from '@roleplayx/engine-sdk';
import { ExternalLoginPreAuthRequest } from '@roleplayx/engine-sdk/account/models/external-login-pre-auth-request';
import { ExternalLoginPreAuthResult } from '@roleplayx/engine-sdk/account/models/external-login-pre-auth-result';
import { DiscordUserAccountInfo } from '@roleplayx/engine-sdk/discord/models/discord-user-account-info';

import {
  ApiController,
  AuthorizedRequest,
  Body,
  Controller,
  EndpointScope,
  Get,
  Post,
  Request,
  SessionToken,
} from '../../api';
import { ConflictError } from '../../core/errors';
import { SessionService } from '../session/service';

import { AccountService } from './service';
import { RPAccount } from './models/account';
import { ImplicitDiscordAuthApiRequest } from './models/request/implicit-discord-auth.api-request';
import { DiscordOAuthTokenApiRequest } from './models/request/discord-oauth-token.api-request';

/**
 * Account API Controller
 */
@Controller('/accounts')
export class AccountController extends ApiController {
  private get accountService(): AccountService {
    return this.context.getService(AccountService);
  }

  private get sessionService(): SessionService {
    return this.context.getService(SessionService);
  }

  /**
   * Register a new account
   *
   * Creates a new player account with the provided credentials.
   * The session must not already be authorized (linked to an account).
   *
   * @param request - The registration request details
   * @param authRequest - The authorized request containing session info
   * @returns The created account details
   * @throws ConflictError when session is already authorized
   */
  @Post('/', {
    statusCode: 201,
  })
  @SessionToken(EndpointScope.SERVER)
  public async register(
    @Body() request: RegisterAccountRequest,
    @Request() authRequest: AuthorizedRequest,
  ): Promise<RPAccount> {
    const sessionId = authRequest.sessionId!;
    const session = this.sessionService.getSession(sessionId);

    if (session?.account) {
      throw new ConflictError('SESSION_HAS_AUTHORIZED', {});
    }

    return this.accountService.registerAccount(request);
  }

  /**
   * Authenticate with password
   *
   * Authenticates a player using their password. This endpoint is used to log in a player to the game server.
   * The session must not already be authorized (linked to an account).
   *
   * @param request - The authentication request containing username and password
   * @param authRequest - The authorized request containing session info
   * @returns Grant access result with authentication token
   * @throws ConflictError when session is already authorized
   */
  @Post('/auth', {
    statusCode: 200,
  })
  @SessionToken(EndpointScope.SERVER)
  public async authWithPassword(
    @Body() request: AccountAuthRequest,
    @Request() authRequest: AuthorizedRequest,
  ): Promise<GrantAccessResult> {
    const sessionId = authRequest.sessionId!;
    const session = this.sessionService.getSession(sessionId);

    if (session?.account) {
      throw new ConflictError('SESSION_HAS_AUTHORIZED', {});
    }

    return this.accountService.authWithPassword(request);
  }

  /**
   * External login pre-authentication
   *
   * Pre-authenticates a player for external login. This endpoint is used to initiate the external login flow.
   * The session must not already be authorized (linked to an account).
   *
   * @param request - The external login pre-auth request with provider details
   * @param authRequest - The authorized request containing session info
   * @returns Pre-authentication result with redirect URL or token
   * @throws ConflictError when session is already authorized
   */
  @Post('/external-login/pre-auth', {
    statusCode: 200,
  })
  @SessionToken(EndpointScope.SERVER)
  public async preAuthExternalLogin(
    @Body() request: ExternalLoginPreAuthRequest,
    @Request() authRequest: AuthorizedRequest,
  ): Promise<ExternalLoginPreAuthResult> {
    const sessionId = authRequest.sessionId!;
    const session = this.sessionService.getSession(sessionId);

    if (session?.account) {
      throw new ConflictError('SESSION_HAS_AUTHORIZED', {});
    }

    return this.accountService.preAuthExternalLogin(request);
  }

  /**
   * External login authentication
   *
   * Authenticates a player using external login credentials. This endpoint is used to complete the external login flow.
   * The session must not already be authorized (linked to an account).
   *
   * @param request - The external login auth request with provider token
   * @param authRequest - The authorized request containing session info
   * @returns Grant access result with authentication token
   * @throws ConflictError when session is already authorized
   */
  @Post('/external-login/auth', {
    statusCode: 200,
  })
  @SessionToken(EndpointScope.SERVER)
  public async authExternalLogin(
    @Body() request: ExternalLoginAuthRequest,
    @Request() authRequest: AuthorizedRequest,
  ): Promise<GrantAccessResult> {
    const sessionId = authRequest.sessionId!;
    const session = this.sessionService.getSession(sessionId);

    if (session?.account) {
      throw new ConflictError('SESSION_HAS_AUTHORIZED', {});
    }

    return this.accountService.authExternalLogin(request);
  }

  /**
   * Get Discord user by session
   *
   * Retrieves a Discord user with the guild membership information by their unique identifier.
   * The session must not already be authorized (linked to an account).
   *
   * @param authRequest - The authorized request containing session info
   * @returns Discord user account information
   * @throws ConflictError when session is already authorized
   */
  @Get('/discord', {
    statusCode: 200,
  })
  @SessionToken(EndpointScope.SERVER)
  public async getDiscordUser(
    @Request() authRequest: AuthorizedRequest,
  ): Promise<DiscordUserAccountInfo> {
    const sessionId = authRequest.sessionId!;
    return this.accountService.getDiscordUser(sessionId);
  }

  /**
   * Authorize with implicit Discord flow
   *
   * This endpoint allows players to authenticate with Discord using the implicit flow. It returns a grant access result containing the player's account information and access token.
   * The session must not already be authorized (linked to an account).
   *
   * @param request - The implicit Discord authentication request
   * @param authRequest - The authorized request containing session info
   * @returns Grant access result with authentication token
   * @throws ConflictError when session is already authorized
   */
  @Post('/discord/auth', {
    statusCode: 200,
  })
  @SessionToken(EndpointScope.SERVER)
  public async authDiscordImplicitFlow(
    @Body() request: ImplicitDiscordAuthApiRequest,
    @Request() authRequest: AuthorizedRequest,
  ): Promise<GrantAccessResult> {
    const sessionId = authRequest.sessionId!;
    const session = this.sessionService.getSession(sessionId);

    if (session?.account) {
      throw new ConflictError('SESSION_HAS_AUTHORIZED', {});
    }

    return this.accountService.authDiscordImplicitFlow({
      sessionId,
      ...request,
    });
  }

  /**
   * Get Discord OAuth authorization URL
   *
   * This endpoint retrieves the OAuth authorization URL for Discord. It is used to initiate the OAuth flow for players to grant access to their Discord account.
   * The session must not already be authorized (linked to an account).
   *
   * @param authRequest - The authorized request containing session info
   * @returns Discord OAuth authorization URL
   * @throws ConflictError when session is already authorized
   */
  @Get('/discord/oauth/authorize', {
    statusCode: 200,
  })
  @SessionToken(EndpointScope.SERVER)
  public async getDiscordOAuthAuthorizeUrl(
    @Request() authRequest: AuthorizedRequest,
  ): Promise<RedirectUri> {
    const sessionId = authRequest.sessionId!;
    const session = this.sessionService.getSession(sessionId);

    if (session?.account) {
      throw new ConflictError('SESSION_HAS_AUTHORIZED', {});
    }

    return this.accountService.getDiscordOAuthAuthorizeUrl();
  }

  /**
   * Authorize with Discord OAuth token
   *
   * This endpoint allows players to authenticate with Discord using OAuth tokens. It returns a grant access result containing the player's account information and access token.
   * The session must not already be authorized (linked to an account).
   *
   * @param request - The Discord OAuth token request
   * @param authRequest - The authorized request containing session info
   * @returns Grant access result with authentication token
   * @throws ConflictError when session is already authorized
   */
  @Post('/discord/oauth/token', {
    statusCode: 200,
  })
  @SessionToken(EndpointScope.SERVER)
  public async authDiscordOAuthFlow(
    @Body() request: DiscordOAuthTokenApiRequest,
    @Request() authRequest: AuthorizedRequest,
  ): Promise<GrantAccessResult> {
    const sessionId = authRequest.sessionId!;
    const session = this.sessionService.getSession(sessionId);

    if (session?.account) {
      throw new ConflictError('SESSION_HAS_AUTHORIZED', {});
    }

    return this.accountService.authDiscordOAuthFlow({
      ...request,
      redirectType: DiscordOAuthRedirectType.Game,
    });
  }
}
