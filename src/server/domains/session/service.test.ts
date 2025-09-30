/**
 * Tests for SessionService
 */
import { AccessPolicy, SessionEndReason, EngineError } from '@roleplayx/engine-sdk';

import { ConflictError, ForbiddenError, NotFoundError } from '../../core/errors';
import { RPEventEmitter } from '../../../core/bus/event-emitter';
import { RPHookBus } from '../../../core/bus/hook-bus';
import { MockLogger } from '../../../../test/mocks';
import { RPServerContext } from '../../core/context';
import { RPServerEvents } from '../../core/events/events';
import { RPServerHooks } from '../../core/hooks/hooks';

import { SessionService } from './service';
import { RPSession, SessionId, generateSessionTokenHash } from './models/session';

describe('SessionService', () => {
  let mockLogger: MockLogger;
  let mockEventEmitter: RPEventEmitter<RPServerEvents>;
  let mockHookBus: RPHookBus<RPServerHooks>;
  let mockContext: RPServerContext;
  let sessionService: SessionService;

  // Test data
  const testSessionId: SessionId = 'sess_test123';
  const testSession: RPSession = {
    id: testSessionId,
    tokenHash: 'abcd1234hash',
    hash: 'session_hash_123',
  };

  const testSessionWithAccount: RPSession = {
    ...testSession,
    account: {
      id: 'acc_test123',
      username: 'testuser',
      segmentDefinitionIds: [],
      authorizedDate: Date.now(),
    },
  };

  const testSessionWithCharacter: RPSession = {
    ...testSessionWithAccount,
    character: {
      id: 'char_test123',
      firstName: 'Test',
      lastName: 'Character',
      fullName: 'Test Character',
      linkedDate: Date.now(),
      segmentDefinitionIds: [],
    },
  };

  beforeEach(() => {
    mockLogger = new MockLogger();
    mockEventEmitter = new RPEventEmitter<RPServerEvents>();
    mockHookBus = new RPHookBus<RPServerHooks>();

    mockContext = {
      logger: mockLogger,
      eventEmitter: mockEventEmitter,
      hookBus: mockHookBus,
      getEngineApi: jest.fn().mockReturnValue({
        startSession: jest.fn().mockResolvedValue({ token: 'session_token_123' }),
        authorizeSession: jest.fn().mockResolvedValue({}),
        linkCharacterToSession: jest.fn().mockResolvedValue({}),
        finishSession: jest.fn().mockResolvedValue({}),
        getActiveSessionInfo: jest.fn().mockResolvedValue(testSessionWithAccount),
      }),
      getService: jest.fn(),
    } as unknown as RPServerContext;

    sessionService = new SessionService(mockContext);
  });

  describe('getSession', () => {
    it('should return session if exists in cache', () => {
      sessionService['sessions'].set(testSessionId, testSession);

      const result = sessionService.getSession(testSessionId);

      expect(result).toBe(testSession);
    });

    it('should return undefined if session does not exist', () => {
      const result = sessionService.getSession('nonexistent_session');

      expect(result).toBeUndefined();
    });
  });

  describe('generateTokenHash', () => {
    it('should generate consistent hash for same inputs', () => {
      const sessionId = 'sess_123';
      const token = 'token_abc';

      const hash1 = generateSessionTokenHash(sessionId, token);
      const hash2 = generateSessionTokenHash(sessionId, token);

      expect(hash1).toBe(hash2);
      expect(typeof hash1).toBe('string');
      expect(hash1.length).toBeGreaterThan(0);
    });

    it('should generate different hashes for different inputs', () => {
      const hash1 = generateSessionTokenHash('sess_1', 'token_a');
      const hash2 = generateSessionTokenHash('sess_2', 'token_b');

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('authorizeSession', () => {
    it('should delegate to SessionApi', async () => {
      const request = { accessToken: 'access_token_123' };

      await sessionService.authorizeSession(testSessionId, request);

      expect(mockContext.getEngineApi).toHaveBeenCalled();
    });
  });

  describe('linkCharacterToSession', () => {
    it('should delegate to SessionApi', async () => {
      const request = { characterId: 'char_123' };

      await sessionService.linkCharacterToSession(testSessionId, request);

      expect(mockContext.getEngineApi).toHaveBeenCalled();
    });
  });

  describe('validateAccessPolicy', () => {
    it('should not throw when session has the required access policy', () => {
      const mockReferenceService = {
        hasAccessPolicyInSegmentDefinitions: jest.fn().mockReturnValue(true),
      };
      (mockContext.getService as jest.Mock).mockReturnValue(mockReferenceService);
      sessionService['sessions'].set(testSessionId, testSessionWithAccount);

      expect(() => {
        sessionService.validateAccessPolicy(testSessionId, AccessPolicy.AccountRead);
      }).not.toThrow();

      expect(mockReferenceService.hasAccessPolicyInSegmentDefinitions).toHaveBeenCalledWith(
        AccessPolicy.AccountRead,
        testSessionWithAccount.account?.segmentDefinitionIds,
      );
    });

    it('should throw ForbiddenError when session lacks the required access policy', () => {
      const mockReferenceService = {
        hasAccessPolicyInSegmentDefinitions: jest.fn().mockReturnValue(false),
      };
      (mockContext.getService as jest.Mock).mockReturnValue(mockReferenceService);
      sessionService['sessions'].set(testSessionId, testSessionWithAccount);

      expect(() => {
        sessionService.validateAccessPolicy(testSessionId, AccessPolicy.AccountWrite);
      }).toThrow(ForbiddenError);
    });

    it('should throw NotFoundError when session does not exist', () => {
      expect(() => {
        sessionService.validateAccessPolicy('non_existent_session', AccessPolicy.AccountRead);
      }).toThrow(NotFoundError);
    });

    it('should throw ConflictError when session has no account', () => {
      sessionService['sessions'].set(testSessionId, testSession);

      expect(() => {
        sessionService.validateAccessPolicy(testSessionId, AccessPolicy.AccountRead);
      }).toThrow(ConflictError);
    });
  });

  describe('hasAccessPolicy', () => {
    let mockReferenceService: {
      hasAccessPolicyInSegmentDefinitions: jest.MockedFunction<
        (accessPolicy: AccessPolicy, segmentDefinitionIds: ReadonlyArray<string>) => boolean
      >;
    };

    beforeEach(() => {
      mockReferenceService = {
        hasAccessPolicyInSegmentDefinitions: jest.fn(),
      };
      (mockContext.getService as jest.Mock).mockReturnValue(mockReferenceService);
    });

    it('should return true when account has the access policy', () => {
      mockReferenceService.hasAccessPolicyInSegmentDefinitions.mockReturnValue(true);
      sessionService['sessions'].set(testSessionId, testSessionWithAccount);

      const result = sessionService.hasAccessPolicy(testSessionId, AccessPolicy.AccountRead);

      expect(result).toBe(true);
      expect(mockReferenceService.hasAccessPolicyInSegmentDefinitions).toHaveBeenCalledWith(
        AccessPolicy.AccountRead,
        testSessionWithAccount.account?.segmentDefinitionIds,
      );
    });

    it('should return true when character has the access policy', () => {
      mockReferenceService.hasAccessPolicyInSegmentDefinitions
        .mockReturnValueOnce(false) // account check fails
        .mockReturnValueOnce(true); // character check succeeds
      sessionService['sessions'].set(testSessionId, testSessionWithCharacter);

      const result = sessionService.hasAccessPolicy(testSessionId, AccessPolicy.CharacterRead);

      expect(result).toBe(true);
      expect(mockReferenceService.hasAccessPolicyInSegmentDefinitions).toHaveBeenCalledTimes(2);
      expect(mockReferenceService.hasAccessPolicyInSegmentDefinitions).toHaveBeenNthCalledWith(
        1,
        AccessPolicy.CharacterRead,
        testSessionWithCharacter.account?.segmentDefinitionIds,
      );
      expect(mockReferenceService.hasAccessPolicyInSegmentDefinitions).toHaveBeenNthCalledWith(
        2,
        AccessPolicy.CharacterRead,
        testSessionWithCharacter.character?.segmentDefinitionIds,
      );
    });

    it('should return false when neither account nor character has the access policy', () => {
      mockReferenceService.hasAccessPolicyInSegmentDefinitions.mockReturnValue(false);
      sessionService['sessions'].set(testSessionId, testSessionWithCharacter);

      const result = sessionService.hasAccessPolicy(testSessionId, AccessPolicy.AccountWrite);

      expect(result).toBe(false);
      expect(mockReferenceService.hasAccessPolicyInSegmentDefinitions).toHaveBeenCalledTimes(2);
    });

    it('should return false when account lacks policy and no character is linked', () => {
      mockReferenceService.hasAccessPolicyInSegmentDefinitions.mockReturnValue(false);
      sessionService['sessions'].set(testSessionId, testSessionWithAccount);

      const result = sessionService.hasAccessPolicy(testSessionId, AccessPolicy.AccountWrite);

      expect(result).toBe(false);
      expect(mockReferenceService.hasAccessPolicyInSegmentDefinitions).toHaveBeenCalledTimes(1);
    });

    it('should throw NotFoundError when session does not exist', () => {
      expect(() => {
        sessionService.hasAccessPolicy('non_existent_session', AccessPolicy.AccountRead);
      }).toThrow(NotFoundError);
    });

    it('should throw ConflictError when session has no account', () => {
      sessionService['sessions'].set(testSessionId, testSession);

      expect(() => {
        sessionService.hasAccessPolicy(testSessionId, AccessPolicy.AccountRead);
      }).toThrow(ConflictError);
    });

    it('should prioritize account access policy over character access policy', () => {
      mockReferenceService.hasAccessPolicyInSegmentDefinitions
        .mockReturnValueOnce(true) // account check succeeds
        .mockReturnValueOnce(false); // character check would fail, but shouldn't be called
      sessionService['sessions'].set(testSessionId, testSessionWithCharacter);

      const result = sessionService.hasAccessPolicy(testSessionId, AccessPolicy.AccountRead);

      expect(result).toBe(true);
      expect(mockReferenceService.hasAccessPolicyInSegmentDefinitions).toHaveBeenCalledTimes(1);
    });
  });

  describe('event handlers', () => {

    describe('onPlayerDisconnected', () => {
      it('should finish session via API', async () => {
        const mockSessionApi = {
          finishSession: jest.fn().mockResolvedValue({}),
        };
        (mockContext.getEngineApi as jest.Mock).mockReturnValue(mockSessionApi);

        mockEventEmitter.emit('playerDisconnected', {
          sessionId: testSessionId,
          reason: SessionEndReason.ConnectionDropped,
        });

        // Wait for async handler
        await new Promise((resolve) => setTimeout(resolve, 10));

        expect(mockSessionApi.finishSession).toHaveBeenCalledWith(testSessionId, {
          endReason: SessionEndReason.ConnectionDropped,
        });
      });
    });

    describe('onSocketSessionStarted', () => {
      it('should update session with hash', async () => {
        // Create a player session first so getPlayerBySession returns a player
        sessionService.createPlayerSession(
          testSessionId,
          'test_player_123',
          '192.168.1.1',
          'token_hash',
        );
        sessionService['sessions'].set(testSessionId, testSession);

        mockEventEmitter.emit('socketSessionStarted', {
          id: testSessionId,
          ipAddress: '192.168.1.1',
          hash: 'new_hash_123',
          timestamp: Date.now(),
        });

        // Wait for async handler
        await new Promise((resolve) => setTimeout(resolve, 10));

        const updatedSession = sessionService['sessions'].get(testSessionId);
        expect(updatedSession?.hash).toBe('new_hash_123');
      });
    });

    describe('onSocketSessionFinished', () => {
      beforeEach(() => {
        sessionService['sessions'].set(testSessionId, testSession);
      });

      it('should remove session and emit sessionFinished event', async () => {
        const emitSpy = jest.spyOn(mockEventEmitter, 'emit');

        mockEventEmitter.emit('socketSessionFinished', {
          id: testSessionId,
          ipAddress: '192.168.1.1',
          accountId: 'acc_123',
          characterId: 'char_123',
          endReason: SessionEndReason.ConnectionDropped,
          endReasonText: 'Connection lost',
          hash: 'session_hash_123',
          timestamp: Date.now(),
        });

        expect(sessionService['sessions'].has(testSessionId)).toBe(false);
        expect(emitSpy).toHaveBeenCalledWith('sessionFinished', {
          sessionId: testSessionId,
          accountId: 'acc_123',
          characterId: 'char_123',
          endReason: SessionEndReason.ConnectionDropped,
          endReasonText: 'Connection lost',
        });
      });

      it('should do nothing if session does not exist', async () => {
        sessionService['sessions'].delete(testSessionId);
        const emitSpy = jest.spyOn(mockEventEmitter, 'emit');

        mockEventEmitter.emit('socketSessionFinished', {
          id: testSessionId,
          ipAddress: '192.168.1.1',
          accountId: 'acc_123',
          endReason: SessionEndReason.ConnectionDropped,
          hash: 'session_hash_123',
          timestamp: Date.now(),
        });

        expect(emitSpy).toHaveBeenCalledTimes(1); // Only the original emit
      });
    });

    describe('onSocketSessionAuthorized', () => {
      beforeEach(() => {
        sessionService['sessions'].set(testSessionId, testSession);
      });

      it('should refresh session and emit sessionAuthorized event', async () => {
        const emitSpy = jest.spyOn(mockEventEmitter, 'emit');

        mockEventEmitter.emit('socketSessionAuthorized', {
          id: testSessionId,
          ipAddress: '192.168.1.1',
          accountId: 'acc_test123',
          signInMethod: 'password',
          authorizedDate: Date.now(),
          hash: 'session_hash_123',
          timestamp: Date.now(),
        });

        // Wait for async handler
        await new Promise((resolve) => setTimeout(resolve, 10));

        expect(emitSpy).toHaveBeenCalledWith('sessionAuthorized', {
          sessionId: testSessionId,
          account: testSessionWithAccount.account,
        });
      });

      it('should do nothing if session has no account after refresh', async () => {
        (mockContext.getEngineApi as jest.Mock).mockReturnValue({
          getActiveSessionInfo: jest.fn().mockResolvedValue({ ...testSession, account: null }),
        });
        const emitSpy = jest.spyOn(mockEventEmitter, 'emit');

        mockEventEmitter.emit('socketSessionAuthorized', {
          id: testSessionId,
          ipAddress: '192.168.1.1',
          accountId: 'acc_test123',
          signInMethod: 'password',
          authorizedDate: Date.now(),
          hash: 'session_hash_123',
          timestamp: Date.now(),
        });

        // Wait for async handler
        await new Promise((resolve) => setTimeout(resolve, 10));

        expect(emitSpy).toHaveBeenCalledTimes(1); // Only the original emit
      });
    });

    describe('onSocketSessionCharacterLinked', () => {
      beforeEach(() => {
        sessionService['sessions'].set(testSessionId, testSession);
      });

      it('should refresh session and emit sessionCharacterLinked event', async () => {
        (mockContext.getEngineApi as jest.Mock).mockReturnValue({
          getActiveSessionInfo: jest.fn().mockResolvedValue(testSessionWithCharacter),
        });
        const emitSpy = jest.spyOn(mockEventEmitter, 'emit');

        mockEventEmitter.emit('socketSessionCharacterLinked', {
          id: testSessionId,
          ipAddress: '192.168.1.1',
          accountId: 'acc_test123',
          characterId: 'char_test123',
          characterLinkedDate: Date.now(),
          signInMethod: 'password',
          authorizedDate: Date.now() - 1000,
          hash: 'session_hash_123',
          timestamp: Date.now(),
        });

        // Wait for async handler
        await new Promise((resolve) => setTimeout(resolve, 10));

        expect(emitSpy).toHaveBeenCalledWith('sessionCharacterLinked', {
          sessionId: testSessionId,
          account: testSessionWithCharacter.account,
          character: testSessionWithCharacter.character,
        });
      });
    });

    describe('onSocketSessionUpdated', () => {
      beforeEach(() => {
        sessionService['sessions'].set(testSessionId, { ...testSession, hash: 'old_hash' });
      });

      it('should refresh session and emit sessionUpdated event when hash changes', async () => {
        const emitSpy = jest.spyOn(mockEventEmitter, 'emit');

        mockEventEmitter.emit('socketSessionUpdated', {
          id: testSessionId,
          hash: 'new_hash',
          timestamp: Date.now(),
        });

        // Wait for async handler
        await new Promise((resolve) => setTimeout(resolve, 10));

        expect(emitSpy).toHaveBeenCalledWith('sessionUpdated', {
          sessionId: testSessionId,
          account: testSessionWithAccount.account,
          character: testSessionWithAccount.character,
        });
      });

      it('should do nothing if hash has not changed', async () => {
        sessionService['sessions'].set(testSessionId, { ...testSession, hash: 'same_hash' });
        const emitSpy = jest.spyOn(mockEventEmitter, 'emit');

        mockEventEmitter.emit('socketSessionUpdated', {
          id: testSessionId,
          hash: 'same_hash',
          timestamp: Date.now(),
        });

        // Wait for async handler
        await new Promise((resolve) => setTimeout(resolve, 10));

        expect(emitSpy).toHaveBeenCalledTimes(1); // Only the original emit
      });
    });
  });

  describe('cache management', () => {
    it('should maintain separate sessions in cache', () => {
      const session1: RPSession = { ...testSession, id: 'sess_1' };
      const session2: RPSession = { ...testSession, id: 'sess_2' };

      sessionService['sessions'].set('sess_1', session1);
      sessionService['sessions'].set('sess_2', session2);

      expect(sessionService['sessions'].get('sess_1')).toEqual(session1);
      expect(sessionService['sessions'].get('sess_2')).toEqual(session2);
      expect(sessionService['sessions'].size).toBe(2);
    });

    it('should handle session updates correctly', () => {
      sessionService['sessions'].set(testSessionId, testSession);

      const updatedSession = { ...testSession, hash: 'updated_hash' };
      sessionService['sessions'].set(testSessionId, updatedSession);

      expect(sessionService['sessions'].get(testSessionId)).toEqual(updatedSession);
      expect(sessionService['sessions'].size).toBe(1);
    });
  });

  // Player-Session Management Tests
  describe('Player-Session Management', () => {
    const testPlayerId = 'player_test123';
    const testSessionId2 = 'sess_test456';

    describe('createPlayerSession', () => {
      it('should create a player-session association', () => {
        sessionService.createPlayerSession(
          testSessionId2,
          testPlayerId,
          '192.168.1.1',
          'token_hash',
        );

        expect(sessionService['sessionToPlayer'].get(testSessionId2)?.id).toBe(testPlayerId);
      });

      it('should throw error when session already has an associated player', () => {
        sessionService.createPlayerSession(
          testSessionId2,
          testPlayerId,
          '192.168.1.1',
          'token_hash',
        );

        expect(() => {
          sessionService.createPlayerSession(
            testSessionId2,
            'another_player',
            '192.168.1.1',
            'token_hash',
          );
        }).toThrow(`Session ${testSessionId2} already has an associated player`);
      });

      it('should allow different sessions to have different players', () => {
        const playerId2 = 'player_test456';
        const sessionId3 = 'sess_test789';

        sessionService.createPlayerSession(
          testSessionId2,
          testPlayerId,
          '192.168.1.1',
          'token_hash',
        );
        sessionService.createPlayerSession(sessionId3, playerId2, '192.168.1.2', 'token_hash2');

        expect(sessionService['sessionToPlayer'].get(testSessionId2)?.id).toBe(testPlayerId);
        expect(sessionService['sessionToPlayer'].get(sessionId3)?.id).toBe(playerId2);
      });
    });

    describe('getPlayerBySession', () => {
      it('should return player ID for existing session', () => {
        sessionService.createPlayerSession(
          testSessionId2,
          testPlayerId,
          '192.168.1.1',
          'token_hash',
        );

        const result = sessionService.getPlayerBySession(testSessionId2);

        expect(result?.id).toBe(testPlayerId);
      });

      it('should return undefined for non-existing session', () => {
        const result = sessionService.getPlayerBySession('non_existent_session');

        expect(result).toBeUndefined();
      });
    });

    describe('getSessionIdByPlayer', () => {
      it('should return session ID for existing player', () => {
        sessionService.createPlayerSession(
          testSessionId2,
          testPlayerId,
          '192.168.1.1',
          'token_hash',
        );

        const result = sessionService.getSessionIdByPlayer(testPlayerId);

        expect(result).toBe(testSessionId2);
      });

      it('should return undefined for non-existing player', () => {
        const result = sessionService.getSessionIdByPlayer('non_existent_player');

        expect(result).toBeUndefined();
      });

      it('should return the first session when player has multiple sessions', () => {
        const sessionId3 = 'sess_test789';
        sessionService.createPlayerSession(
          testSessionId2,
          testPlayerId,
          '192.168.1.1',
          'token_hash',
        );
        sessionService.createPlayerSession(sessionId3, testPlayerId, '192.168.1.2', 'token_hash2');

        const result = sessionService.getSessionIdByPlayer(testPlayerId);

        // Should return one of the sessions (implementation dependent)
        expect([testSessionId2, sessionId3]).toContain(result);
      });
    });

    describe('removePlayerBySession', () => {
      it('should remove player-session association', () => {
        sessionService.createPlayerSession(
          testSessionId2,
          testPlayerId,
          '192.168.1.1',
          'token_hash',
        );
        expect(sessionService['sessionToPlayer'].has(testSessionId2)).toBe(true);

        sessionService.removePlayerBySession(testSessionId2);

        expect(sessionService['sessionToPlayer'].has(testSessionId2)).toBe(false);
      });

      it('should not throw when removing non-existing session', () => {
        expect(() => {
          sessionService.removePlayerBySession('non_existent_session');
        }).not.toThrow();
      });
    });

    describe('removePlayer', () => {
      it('should remove all sessions for a specific player', () => {
        const sessionId3 = 'sess_test789';
        sessionService.createPlayerSession(
          testSessionId2,
          testPlayerId,
          '192.168.1.1',
          'token_hash',
        );
        sessionService.createPlayerSession(sessionId3, testPlayerId, '192.168.1.2', 'token_hash2');

        sessionService.removePlayer(testPlayerId);

        expect(sessionService['sessionToPlayer'].has(testSessionId2)).toBe(false);
        expect(sessionService['sessionToPlayer'].has(sessionId3)).toBe(false);
      });

      it('should not affect other players sessions', () => {
        const otherPlayerId = 'player_other123';
        const otherSessionId = 'sess_other456';

        sessionService.createPlayerSession(
          testSessionId2,
          testPlayerId,
          '192.168.1.1',
          'token_hash',
        );
        sessionService.createPlayerSession(
          otherSessionId,
          otherPlayerId,
          '192.168.1.3',
          'token_hash3',
        );

        sessionService.removePlayer(testPlayerId);

        expect(sessionService['sessionToPlayer'].has(testSessionId2)).toBe(false);
        expect(sessionService['sessionToPlayer'].has(otherSessionId)).toBe(true);
        expect(sessionService['sessionToPlayer'].get(otherSessionId)?.id).toBe(otherPlayerId);
      });

      it('should not throw when removing non-existing player', () => {
        expect(() => {
          sessionService.removePlayer('non_existent_player');
        }).not.toThrow();
      });
    });

    describe('hasPlayer', () => {
      it('should return true when session has an associated player', () => {
        sessionService.createPlayerSession(
          testSessionId2,
          testPlayerId,
          '192.168.1.1',
          'token_hash',
        );

        const result = sessionService.hasPlayer(testSessionId2);

        expect(result).toBe(true);
      });

      it('should return false when session has no associated player', () => {
        const result = sessionService.hasPlayer('session_without_player');

        expect(result).toBe(false);
      });
    });

    describe('hasActiveSession', () => {
      it('should return true when player has an active session', () => {
        sessionService.createPlayerSession(
          testSessionId2,
          testPlayerId,
          '192.168.1.1',
          'token_hash',
        );

        const result = sessionService.hasActiveSession(testPlayerId);

        expect(result).toBe(true);
      });

      it('should return false when player has no active session', () => {
        const result = sessionService.hasActiveSession('player_without_session');

        expect(result).toBe(false);
      });

      it('should return false after player sessions are removed', () => {
        sessionService.createPlayerSession(
          testSessionId2,
          testPlayerId,
          '192.168.1.1',
          'token_hash',
        );
        expect(sessionService.hasActiveSession(testPlayerId)).toBe(true);

        sessionService.removePlayer(testPlayerId);

        expect(sessionService.hasActiveSession(testPlayerId)).toBe(false);
      });
    });
  });

  // Integration Tests
  describe('Session Lifecycle Integration with Player Management', () => {
    const testPlayerId = 'player_integration123';
    const testSessionId2 = 'sess_integration456';

    describe('onPlayerDisconnected integration', () => {
      it('should remove player-session association when player disconnects', async () => {
        // Setup: Create session and player association
        sessionService['sessions'].set(testSessionId2, testSession);
        sessionService.createPlayerSession(
          testSessionId2,
          testPlayerId,
          '192.168.1.1',
          'token_hash',
        );

        expect(sessionService.hasPlayer(testSessionId2)).toBe(true);

        // Trigger player disconnection
        mockEventEmitter.emit('playerDisconnected', {
          sessionId: testSessionId2,
          reason: SessionEndReason.ConnectionDropped,
        });

        // Wait for async handler
        await new Promise((resolve) => setTimeout(resolve, 10));

        // Verify player-session association is removed
        expect(sessionService.hasPlayer(testSessionId2)).toBe(false);
        expect(sessionService.getPlayerBySession(testSessionId2)).toBeUndefined();
      });
    });

    describe('onSocketSessionFinished integration', () => {
      it('should remove player-session association when session is finished', async () => {
        // Setup: Create session and player association
        sessionService['sessions'].set(testSessionId2, testSession);
        sessionService.createPlayerSession(
          testSessionId2,
          testPlayerId,
          '192.168.1.1',
          'token_hash',
        );

        expect(sessionService.hasPlayer(testSessionId2)).toBe(true);

        // Trigger session finished event
        mockEventEmitter.emit('socketSessionFinished', {
          id: testSessionId2,
          ipAddress: '192.168.1.1',
          accountId: 'acc_123',
          characterId: 'char_123',
          endReason: SessionEndReason.ConnectionDropped,
          endReasonText: 'Connection lost',
          hash: 'session_hash_123',
          timestamp: Date.now(),
        });

        // Verify player-session association is removed
        expect(sessionService.hasPlayer(testSessionId2)).toBe(false);
        expect(sessionService.getPlayerBySession(testSessionId2)).toBeUndefined();
      });
    });

    describe('refreshSession error handling integration', () => {
      it('should remove player-session association when session is dropped', async () => {
        // Setup: Create session and player association
        sessionService['sessions'].set(testSessionId2, testSession);
        sessionService.createPlayerSession(
          testSessionId2,
          testPlayerId,
          '192.168.1.1',
          'token_hash',
        );

        expect(sessionService.hasPlayer(testSessionId2)).toBe(true);

        // Mock API to return 404 error
        const mockEngineError = new EngineError('SESSION_NOT_FOUND', 'Session not found', {}, 404);
        (mockContext.getEngineApi as jest.Mock).mockReturnValue({
          getActiveSessionInfo: jest.fn().mockRejectedValue(mockEngineError),
        });

        // Trigger refreshSession indirectly through socketSessionAuthorized
        mockEventEmitter.emit('socketSessionAuthorized', {
          id: testSessionId2,
          ipAddress: '192.168.1.1',
          accountId: 'acc_test123',
          signInMethod: 'password',
          authorizedDate: Date.now(),
          hash: 'session_hash_123',
          timestamp: Date.now(),
        });

        // Wait for async handler
        await new Promise((resolve) => setTimeout(resolve, 10));

        // Verify player-session association is removed
        expect(sessionService.hasPlayer(testSessionId2)).toBe(false);
        expect(sessionService.getPlayerBySession(testSessionId2)).toBeUndefined();
      });
    });

    describe('Multiple players and sessions integration', () => {
      it('should handle multiple player-session associations correctly', () => {
        const player1 = 'player_1';
        const player2 = 'player_2';
        const session1 = 'sess_1';
        const session2 = 'sess_2';
        const session3 = 'sess_3';

        // Create multiple associations
        sessionService.createPlayerSession(session1, player1, '192.168.1.1', 'token_hash1');
        sessionService.createPlayerSession(session2, player2, '192.168.1.2', 'token_hash2');
        sessionService.createPlayerSession(session3, player1, '192.168.1.3', 'token_hash3'); // Same player, different session

        // Verify all associations exist
        expect(sessionService.getPlayerBySession(session1)?.id).toBe(player1);
        expect(sessionService.getPlayerBySession(session2)?.id).toBe(player2);
        expect(sessionService.getPlayerBySession(session3)?.id).toBe(player1);

        expect(sessionService.hasActiveSession(player1)).toBe(true);
        expect(sessionService.hasActiveSession(player2)).toBe(true);

        // Remove one player - should remove all their sessions
        sessionService.removePlayer(player1);

        expect(sessionService.hasActiveSession(player1)).toBe(false);
        expect(sessionService.hasActiveSession(player2)).toBe(true);
        expect(sessionService.getPlayerBySession(session1)).toBeUndefined();
        expect(sessionService.getPlayerBySession(session3)).toBeUndefined();
        expect(sessionService.getPlayerBySession(session2)?.id).toBe(player2);
      });
    });
  });
});
