/**
 *
 * @export
 * @interface DiscordOAuthTokenApiRequest
 */
export interface DiscordOAuthTokenApiRequest {
  /**
   * Authorization code received from Discord after user consent.
   * @type {string}
   * @memberof DiscordOAuthTokenApiRequest
   */
  code: string;
}
