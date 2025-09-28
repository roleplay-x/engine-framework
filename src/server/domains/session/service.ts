import {
  AccessPolicy,
  AuthorizeSessionRequest,
  EngineError,
  LinkCharacterToSessionRequest,
  SessionApi,
  SessionEndReason,
  ConfigKey,
} from '@roleplayx/engine-sdk';

import { SocketSessionStarted } from '../../socket/events/socket-session-started';
import { RPPlayerConnecting } from '../../natives/events/player/player-connecting';
import { RPPlayerJoined } from '../../natives/events/player/player-joined';
import { SocketSessionAuthorized } from '../../socket/events/socket-session-authorized';
import { SocketSessionFinished } from '../../socket/events/socket-session-finished';
import { RPServerService } from '../../core/server-service';
import { OnServer } from '../../core/events/decorators';
import { SocketSessionCharacterLinked } from '../../socket/events/socket-session-character-linked';
import { SocketSessionUpdated } from '../../socket/events/socket-session-updated';
import { RPPlayerDisconnected } from '../../natives/events/player/player-disconnected';
import { ConflictError, ForbiddenError, NotFoundError } from '../../core/errors';
import { ReferenceService } from '../reference/service';

import { generateSessionTokenHash, PlayerId, RPSession, SessionId } from './models/session';
import { WorldService } from '../world/service';
import { ServerPlayer } from '../../natives/entitites';

/**
 * Service for managing player sessions in the roleplay server.
 *
 * This service provides functionality for:
 * - Session lifecycle management (start, authorize, finish)
 * - Session token generation and verification
 * - Character linking to active sessions
 * - Session state caching and synchronization
 * - Player-session association management
 *
 * The service maintains a local cache of active sessions and player-session mappings
 * that gets populated when players connect and cleaned up when sessions end. It handles
 * the complete session workflow from initial connection through authentication and
 * character selection, while also managing the association between sessions and game players.
 *
 * @example
 * ```typescript
 * // Get an active session
 * const session = sessionService.getSession(sessionId);
 *
 * // Authorize a session
 * await sessionService.authorizeSession(sessionId, {
 *   accessToken: 'player_access_token'
 * });
 *
 * // Link character to session
 * await sessionService.linkCharacterToSession(sessionId, {
 *   characterId: 'char_12345'
 * });
 *
 * // Create player-session association
 * sessionService.createPlayerSession(sessionId, playerId);
 *
 * // Get player by session
 * const playerId = sessionService.getPlayerBySession(sessionId);
 * ```
 */
export class SessionService extends RPServerService {
  /** Cache of active player sessions indexed by session ID */
  private readonly sessions: Map<SessionId, RPSession> = new Map([]);

  /** Mapping of session ID to player for player-session association */
  private readonly sessionToPlayer: Map<SessionId, ServerPlayer> = new Map([]);

  /**
   * Retrieves a session by its unique identifier.
   *
   * Returns the cached session data if available. This method provides quick access
   * to session information without making API calls. Sessions are automatically
   * cached when players connect and updated through socket events.
   *
   * @param sessionId - The unique identifier of the session
   * @returns The session data if found, undefined otherwise
   *
   * @example
   * ```typescript
   * const session = sessionService.getSession('sess_12345');
   * if (session) {
   *   console.log(`Session for account: ${session.account?.id}`);
   * }
   * ```
   */
  public getSession(sessionId: SessionId): RPSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Authorizes a session using an access token.
   *
   * This method authenticates a player session by validating their access token
   * with the roleplay engine. Once authorized, the session becomes associated
   * with the player's account and can access account-specific features.
   *
   * @param sessionId - The unique identifier of the session to authorize
   * @param request - The authorization request containing the access token
   * @returns Promise resolving when authorization is complete
   * @throws {EngineError} When authorization fails (invalid token, expired, etc.)
   *
   * @example
   * ```typescript
   * await sessionService.authorizeSession('sess_12345', {
   *   accessToken: 'player_access_token_here'
   * });
   * ```
   */
  public authorizeSession(sessionId: SessionId, request: AuthorizeSessionRequest) {
    return this.getEngineApi(SessionApi).authorizeSession(sessionId, request);
  }

  /**
   * Links a character to an authorized session.
   *
   * This method associates a specific character with the player's session,
   * allowing them to enter the game world. The session must already be
   * authorized before a character can be linked.
   *
   * @param sessionId - The unique identifier of the authorized session
   * @param request - The character linking request containing character ID
   * @returns Promise resolving when character is successfully linked
   * @throws {EngineError} When linking fails (session not authorized, character not found, etc.)
   *
   * @example
   * ```typescript
   * await sessionService.linkCharacterToSession('sess_12345', {
   *   characterId: 'char_67890'
   * });
   * ```
   */
  public linkCharacterToSession(sessionId: SessionId, request: LinkCharacterToSessionRequest) {
    return this.getEngineApi(SessionApi).linkCharacterToSession(sessionId, request);
  }

  /**
   * Validates that a session has the required access policy.
   *
   * This method checks if the session has the specified access policy and throws
   * a ForbiddenError if the policy is not granted. Used for authorization checks
   * before allowing access to protected resources or operations.
   *
   * @param sessionId - The unique identifier of the session to validate
   * @param accessPolicy - The access policy that must be present
   * @throws {ForbiddenError} When the session lacks the required access policy
   * @throws {NotFoundError} When the session is not found
   * @throws {ConflictError} When the session is not authorized
   *
   * @example
   * ```typescript
   * // Will throw if session doesn't have AccountWrite policy
   * sessionService.validateAccessPolicy('sess_123', AccessPolicy.AccountWrite);
   * ```
   */
  public validateAccessPolicy(sessionId: SessionId, accessPolicy: AccessPolicy): void {
    if (!this.hasAccessPolicy(sessionId, accessPolicy)) {
      throw new ForbiddenError('INSUFFICIENT_ACCESS_LEVEL', { accessPolicy });
    }
  }

  /**
   * Checks if a session has a specific access policy.
   *
   * This method determines whether the session has the required access policy
   * by checking both account-level and character-level segment definitions.
   * The session must be authorized (have an associated account) to perform
   * access policy checks.
   *
   * @param sessionId - The unique identifier of the session to check
   * @param accessPolicy - The access policy to verify
   * @returns True if the session has the access policy, false otherwise
   * @throws {NotFoundError} When the session is not found
   * @throws {ConflictError} When the session is not authorized (no account)
   *
   * @example
   * ```typescript
   * if (sessionService.hasAccessPolicy('sess_123', AccessPolicy.AccountRead)) {
   *   // Session can read account data
   *   console.log('Access granted');
   * }
   * ```
   */
  public hasAccessPolicy(sessionId: SessionId, accessPolicy: AccessPolicy): boolean {
    const session = this.getSession(sessionId);
    if (!session) {
      throw new NotFoundError('SESSION_NOT_FOUND', {});
    }

    if (!session.account) {
      throw new ConflictError('SESSION_HAS_NOT_AUTHORIZED', {});
    }

    const referenceService = this.getService(ReferenceService);
    if (
      referenceService.hasAccessPolicyInSegmentDefinitions(
        accessPolicy,
        session.account.segmentDefinitionIds,
      )
    ) {
      return true;
    }

    if (!session.character) {
      return false;
    }

    return referenceService.hasAccessPolicyInSegmentDefinitions(
      accessPolicy,
      session.character.segmentDefinitionIds,
    );
  }

  @OnServer('playerConnecting')
  private async onPlayerConnecting({ sessionId, ipAddress, playerId }: RPPlayerConnecting) {
    try {
      const { token } = await this.getEngineApi(SessionApi).startSession(sessionId, { ipAddress });

      const tokenHash = generateSessionTokenHash(sessionId, token);
      this.createPlayerSession(sessionId, playerId, ipAddress, tokenHash);

      this.eventEmitter.emit('sessionStarted', { sessionId, sessionToken: token });

      this.logger.info(`Player ${sessionId} connected and joined with IP ${ipAddress}`);
    } catch {
      this.eventEmitter.emit('sessionFinished', {
        sessionId,
        endReason: SessionEndReason.SessionInitFailed,
      });
    }
  }

  @OnServer('playerDisconnected')
  private async onPlayerDisconnected({ sessionId, reason }: RPPlayerDisconnected) {
    this.removePlayerBySession(sessionId);
    await this.getEngineApi(SessionApi).finishSession(sessionId, { endReason: reason });
  }

  @OnServer('socketSessionStarted')
  private async onSocketSessionStarted(payload: SocketSessionStarted) {
    const player = this.getPlayerBySession(payload.id);
    if (!player) {
      return;
    }

    const session = this.sessions.get(payload.id);
    if (session) {
      session.hash = payload.hash;
    }

    player.emit('playerJoined', {
      playerId: player.id,
      ipAddress: player.ip,
      sessionId: payload.id,
    });
  }

  @OnServer('socketSessionFinished')
  private async onSocketSessionFinished(payload: SocketSessionFinished) {
    if (!this.sessions.delete(payload.id)) {
      return;
    }

    this.removePlayerBySession(payload.id);

    this.eventEmitter.emit('sessionFinished', {
      sessionId: payload.id,
      accountId: payload.accountId,
      characterId: payload.characterId,
      endReason: payload.endReason,
      endReasonText: payload.endReasonText,
    });
  }

  @OnServer('socketSessionAuthorized')
  private async onSocketSessionAuthorized(payload: SocketSessionAuthorized) {
    const session = await this.refreshSession(payload.id);
    if (!session?.account) {
      return;
    }

    this.eventEmitter.emit('sessionAuthorized', {
      sessionId: session.id,
      account: session.account,
    });
  }

  @OnServer('socketSessionCharacterLinked')
  private async onSocketSessionCharacterLinked(payload: SocketSessionCharacterLinked) {
    const session = await this.refreshSession(payload.id);
    if (!session?.character) {
      return;
    }

    this.eventEmitter.emit('sessionCharacterLinked', {
      sessionId: session.id,
      account: session.account!,
      character: session.character!,
    });

    const player = this.getPlayerBySession(session.id);
    if (player) {
      const worldService = this.getService(WorldService);
      await worldService.setLoginCamera(player.id);
    }
  }

  @OnServer('socketSessionUpdated')
  private async onSocketSessionUpdated(payload: SocketSessionUpdated) {
    if (payload.hash === this.sessions.get(payload.id)?.hash) {
      return;
    }

    const session = await this.refreshSession(payload.id);
    if (!session) {
      return;
    }

    this.eventEmitter.emit('sessionUpdated', {
      sessionId: session.id,
      account: session.account,
      character: session.character,
    });
  }

  private async refreshSession(sessionId: SessionId): Promise<RPSession | undefined> {
    if (!this.sessions.has(sessionId)) {
      return;
    }

    try {
      const sessionInfo = await this.getEngineApi(SessionApi).getActiveSessionInfo(sessionId);
      this.sessions.set(sessionId, {
        ...(this.sessions.get(sessionId) ?? { id: sessionId }),
        ...sessionInfo,
      });
      return this.sessions.get(sessionId);
    } catch (error) {
      if (error instanceof EngineError && error.statusCode === 404) {
        this.eventEmitter.emit('sessionFinished', {
          sessionId,
          endReason: SessionEndReason.ConnectionDropped,
        });
        this.sessions.delete(sessionId);
        this.removePlayerBySession(sessionId);
      }
    }
  }

  private async getTokenHash(sessionId: SessionId): Promise<string> {
    const sessionInfo = await this.getEngineApi(SessionApi).getActiveSessionInfo(sessionId);
    return sessionInfo.tokenHash;
  }

  /**
   * Creates a player-session association.
   *
   * This method establishes a mapping between a session and a player,
   * allowing the session to be associated with a specific game player.
   *
   * @param sessionId - The unique identifier of the session
   * @param playerId - The unique identifier of the player
   * @throws {Error} When the session already has an associated player
   *
   * @example
   * ```typescript
   * sessionService.createPlayerSession('sess_12345', 'player_67890');
   * ```
   */
  public createPlayerSession(
    sessionId: SessionId,
    playerId: string,
    ip: string,
    tokenHash: string,
  ): void {
    if (this.sessionToPlayer.has(sessionId)) {
      throw new Error(`Session ${sessionId} already has an associated player`);
    }

    const player = ServerPlayer.create(playerId, sessionId, ip, this.context.platformAdapter);
    this.sessionToPlayer.set(sessionId, player);
    this.sessions.set(sessionId, { id: sessionId, tokenHash });
  }

  /**
   * Retrieves the player ID associated with a session.
   *
   * @param sessionId - The unique identifier of the session
   * @returns The player ID if found, undefined otherwise
   *
   * @example
   * ```typescript
   * const playerId = sessionService.getPlayerBySession('sess_12345');
   * if (playerId) {
   *   console.log(`Player associated with session: ${playerId}`);
   * }
   * ```
   */
  public getPlayerBySession(sessionId: SessionId): ServerPlayer | undefined {
    return this.sessionToPlayer.get(sessionId);
  }

  /**
   * Retrieves the session ID associated with a player.
   *
   * @param playerId - The unique identifier of the player
   * @returns The session ID if found, undefined otherwise
   *
   * @example
   * ```typescript
   * const sessionId = sessionService.getSessionByPlayer('player_67890');
   * if (sessionId) {
   *   console.log(`Session associated with player: ${sessionId}`);
   * }
   * ```
   */
  public getSessionByPlayer(playerId: string): SessionId | undefined {
    for (const [sessionId, player] of this.sessionToPlayer.entries()) {
      if (player.id === playerId) {
        return sessionId;
      }
    }
    return undefined;
  }

  /**
   * Removes the player-session association.
   *
   * This method removes the mapping between a session and its associated player.
   * The session itself remains active unless explicitly finished.
   *
   * @param sessionId - The unique identifier of the session
   *
   * @example
   * ```typescript
   * sessionService.removePlayerBySession('sess_12345');
   * ```
   */
  public removePlayerBySession(sessionId: SessionId): void {
    this.sessionToPlayer.delete(sessionId);
  }

  /**
   * Removes all session associations for a specific player.
   *
   * This method removes all session mappings associated with the given player.
   *
   * @param playerId - The unique identifier of the player
   *
   * @example
   * ```typescript
   * sessionService.removePlayer('player_67890');
   * ```
   */
  public removePlayer(playerId: string): void {
    for (const [sessionId, player] of this.sessionToPlayer.entries()) {
      if (player.id === playerId) {
        this.sessionToPlayer.delete(sessionId);
      }
    }
  }

  /**
   * Checks if a session has an associated player.
   *
   * @param sessionId - The unique identifier of the session
   * @returns True if the session has an associated player, false otherwise
   *
   * @example
   * ```typescript
   * if (sessionService.hasPlayer('sess_12345')) {
   *   console.log('Session has an associated player');
   * }
   * ```
   */
  public hasPlayer(sessionId: SessionId): boolean {
    return this.sessionToPlayer.has(sessionId);
  }

  /**
   * Checks if a player has an active session.
   *
   * @param playerId - The unique identifier of the player
   * @returns True if the player has an active session, false otherwise
   *
   * @example
   * ```typescript
   * if (sessionService.hasActiveSession('player_67890')) {
   *   console.log('Player has an active session');
   * }
   * ```
   */
  public hasActiveSession(playerId: string): boolean {
    return this.getSessionByPlayer(playerId) !== undefined;
  }
}
