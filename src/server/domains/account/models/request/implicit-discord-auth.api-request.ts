export interface ImplicitDiscordAuthApiRequest {
  /**
   * Username of the authenticated user. It should not be null if it is first time user is authenticated.
   * @type {string}
   * @memberof ImplicitDiscordAuthApiRequest
   */
  username?: string | null;
  /**
   * Email of the authenticated user. It should not be null if it is first time user is authenticated and email is required.
   * @type {string}
   * @memberof ImplicitDiscordAuthApiRequest
   */
  email?: string | null;
  /**
   * Locale of the authenticated user.
   * @type {string}
   * @memberof ImplicitDiscordAuthApiRequest
   */
  locale?: string;
}
