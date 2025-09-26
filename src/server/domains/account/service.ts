import {
  AccountApi,
  AccountAuthRequest,
  DiscordApi,
  DiscordOAuthRedirectType,
  ExternalLoginAuthRequest,
  GrantAccessResult,
  RedirectUri,
  RegisterAccountRequest,
} from '@roleplayx/engine-sdk';
import { DiscordOAuthTokenRequest } from '@roleplayx/engine-sdk/discord/models/discord-oauth-token-request';
import { ExternalLoginPreAuthRequest } from '@roleplayx/engine-sdk/account/models/external-login-pre-auth-request';
import { ExternalLoginPreAuthResult } from '@roleplayx/engine-sdk/account/models/external-login-pre-auth-result';
import { DiscordUserAccountInfo } from '@roleplayx/engine-sdk/discord/models/discord-user-account-info';

import { OnServer } from '../../core/events/decorators';
import { RPSessionFinished } from '../session/events/session-finished';
import { RPSessionAuthorized } from '../session/events/session-authorized';
import { SocketAccountUsernameChanged } from '../../socket/events/socket-account-username-changed';
import { RPServerService } from '../../core/server-service';
import { RPDiscordService } from '../../natives/services/discord.service';
import { NotFoundError } from '../../core/errors';
import { SessionId } from '../session/models/session';

import { AccountId, RPAccount } from './models/account';
import { RPImplicitDiscordAuthRequest } from './models/request/implicit-discord-auth.request';

/**
 * Service for managing player accounts in the roleplay server.
 *
 * This service provides functionality for:
 * - Account authentication (password, external logins, Discord OAuth)
 * - Account registration and management
 * - Account caching and session lifecycle management
 * - Integration with Discord authentication flows
 *
 * The service maintains a local cache of active accounts that gets populated
 * when players authenticate and cleaned up when sessions end.
 *
 * @example
 * ```typescript
 * // Get an account
 * const account = await accountService.getAccount(accountId);
 *
 * // Register a new account
 * const newAccount = await accountService.registerAccount({
 *   username: 'player123',
 *   password: 'securePassword',
 *   email: 'player@example.com'
 * });
 *
 * // Authenticate with password
 * const authResult = await accountService.authWithPassword({
 *   username: 'player123',
 *   password: 'securePassword'
 * });
 * ```
 */
export class AccountService extends RPServerService {
  /** Cache of active player accounts indexed by account ID */
  private readonly accounts: Map<AccountId, RPAccount> = new Map();

  /**
   * Retrieves an account by its unique identifier.
   *
   * First checks the local cache for performance, then falls back to the API
   * if the account is not cached. This is typically used to get account details
   * for authenticated players.
   *
   * @param accountId - The unique identifier of the account
   * @returns Promise resolving to the account details
   * @throws {EngineError} When the account is not found or access is denied
   *
   * @example
   * ```typescript
   * const account = await accountService.getAccount('acc_12345');
   * console.log(`Player: ${account.username}`);
   * ```
   */
  public async getAccount(accountId: AccountId): Promise<RPAccount> {
    const account = this.accounts.get(accountId);
    if (account) {
      return account;
    }

    return this.getEngineApi(AccountApi).getAccountById(accountId, { includeSignInOptions: true });
  }

  /**
   * Registers a new account in the game server.
   *
   * This endpoint creates a new player account with the provided credentials.
   * The account will be immediately available for authentication.
   *
   * @param request - The account registration details
   * @returns Promise resolving to the created account
   * @throws {EngineError} When registration fails (e.g., username taken, invalid data)
   *
   * @example
   * ```typescript
   * const account = await accountService.registerAccount({
   *   username: 'newplayer',
   *   password: 'securePassword123',
   *   email: 'player@example.com'
   * });
   * ```
   */
  public registerAccount(request: RegisterAccountRequest): Promise<RPAccount> {
    return this.getEngineApi(AccountApi).registerAccount(request);
  }

  /**
   * Authenticates a player using their username and password.
   *
   * This endpoint performs password-based authentication and returns access tokens
   * that can be used for further API calls or session creation.
   *
   * @param request - The authentication credentials
   * @returns Promise resolving to authentication result with tokens
   * @throws {EngineError} When authentication fails (invalid credentials, account banned, etc.)
   *
   * @example
   * ```typescript
   * const result = await accountService.authWithPassword({
   *   username: 'player123',
   *   password: 'playerPassword'
   * });
   *
   * if (result.success) {
   *   console.log('Access token:', result.accessToken);
   * }
   * ```
   */
  public async authWithPassword(request: AccountAuthRequest): Promise<GrantAccessResult> {
    return this.getEngineApi(AccountApi).authWithPassword(request);
  }

  /**
   * Initiates external login authentication flow (pre-authentication step).
   *
   * This endpoint starts the external authentication process and returns
   * information needed to complete the authentication with external providers.
   *
   * @param request - The external login pre-authentication request
   * @returns Promise resolving to pre-authentication result
   * @throws {EngineError} When pre-authentication setup fails
   */
  public preAuthExternalLogin(
    request: ExternalLoginPreAuthRequest,
  ): Promise<ExternalLoginPreAuthResult> {
    return this.getEngineApi(AccountApi).preAuthExternalLogin(request);
  }

  /**
   * Completes external login authentication flow.
   *
   * This endpoint completes the external authentication process using tokens
   * received from external providers.
   *
   * @param request - The external login authentication request with provider tokens
   * @returns Promise resolving to authentication result with access tokens
   * @throws {EngineError} When external authentication fails or tokens are invalid
   */
  public authExternalLogin(request: ExternalLoginAuthRequest): Promise<GrantAccessResult> {
    return this.getEngineApi(AccountApi).authExternalLogin(request);
  }

  /**
   * Authenticates using Discord's implicit OAuth flow.
   *
   * This method handles Discord authentication using the implicit flow where
   * discord userId is received directly from gamemode instance.
   *
   * @param request - The Discord implicit authentication request
   * @returns Promise resolving to authentication result
   * @throws {EngineError} When Discord authentication fails
   */
  public async authDiscordImplicitFlow(
    request: RPImplicitDiscordAuthRequest,
  ): Promise<GrantAccessResult> {
    const discordUserId = this.getService(RPDiscordService).getDiscordUserId(request.sessionId);
    if (!discordUserId) {
      throw new NotFoundError('DISCORD_USER_NOT_FOUND', {});
    }

    return this.getEngineApi(DiscordApi).authImplicitFlow({
      discordUserId,
      ...request,
    });
  }

  /**
   * Authenticates using Discord's OAuth code flow.
   *
   * This method handles Discord authentication using the authorization code flow
   * where an authorization code is exchanged for access tokens.
   *
   * @param request - The Discord OAuth token request
   * @returns Promise resolving to authentication result
   * @throws {EngineError} When Discord OAuth authentication fails
   */
  public async authDiscordOAuthFlow(request: DiscordOAuthTokenRequest): Promise<GrantAccessResult> {
    return this.getEngineApi(DiscordApi).authOAuthFlow(request);
  }

  /**
   * Retrieves Discord user information by session Id.
   *
   * This method fetches Discord user details which can be used for
   * checking if the user is whitelisted for the server.
   *
   * @param sessionId - The session ID of the user
   * @returns Promise resolving to Discord user account information
   * @throws {EngineError} When Discord user is not found or access is denied
   */
  public async getDiscordUser(sessionId: SessionId): Promise<DiscordUserAccountInfo> {
    const discordUserId = this.getService(RPDiscordService).getDiscordUserId(sessionId);
    if (!discordUserId) {
      throw new NotFoundError('DISCORD_USER_NOT_FOUND', {});
    }

    return this.getEngineApi(DiscordApi).getDiscordUserById(discordUserId);
  }

  /**
   * Gets the Discord OAuth authorization URL for game integration.
   *
   * This method generates the OAuth authorization URL that players can use
   * to authorize the game to access their Discord account information.
   *
   * @returns Promise resolving to the Discord OAuth authorization URL
   * @throws {EngineError} When OAuth URL generation fails
   */
  public async getDiscordOAuthAuthorizeUrl(): Promise<RedirectUri> {
    return this.getEngineApi(DiscordApi).getDiscordOAuthAuthorizeUrl(DiscordOAuthRedirectType.Game);
  }

  @OnServer('sessionAuthorized')
  private async onSessionAuthorized({ account }: RPSessionAuthorized) {
    this.accounts.set(account.id, await this.getAccount(account.id));
  }

  @OnServer('sessionFinished')
  private async onSessionFinished({ accountId }: RPSessionFinished) {
    if (!accountId) {
      return;
    }

    this.accounts.delete(accountId);
  }

  @OnServer('socketAccountUsernameChanged')
  private async onSocketAccountUsernameChanged(payload: SocketAccountUsernameChanged) {
    const account = this.accounts.get(payload.id);
    if (!account) {
      return;
    }

    this.accounts.set(payload.id, {
      ...account,
      username: payload.username,
    });

    this.eventEmitter.emit('accountUsernameChanged', {
      accountId: payload.id,
      username: payload.username,
    });
  }
}
