import { SessionId } from '../../../session/models/session';

export interface RPImplicitDiscordAuthRequest {
  /**
   * Session ID of the authenticated user.
   * @type {string}
   * @memberof RPImplicitDiscordAuthRequest
   */
  sessionId: SessionId;
  /**
   * Username of the authenticated user. It should not be null if it is first time user is authenticated.
   * @type {string}
   * @memberof RPImplicitDiscordAuthRequest
   */
  username?: string | null;
  /**
   * Email of the authenticated user. It should not be null if it is first time user is authenticated and email is required.
   * @type {string}
   * @memberof RPImplicitDiscordAuthRequest
   */
  email?: string | null;
  /**
   * Locale of the authenticated user.
   * @type {string}
   * @memberof RPImplicitDiscordAuthRequest
   */
  locale?: string;
}
