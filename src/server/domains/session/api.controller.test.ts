import { AuthorizeSessionRequest } from '@roleplayx/engine-sdk';
import { SessionInfo } from '@roleplayx/engine-sdk/session/models/session-info';

import { ApiTestServer } from '../../../../test/api-test-utils';

import { generateSessionTokenHash, RPSession } from './models/session';
import { SessionController } from './api.controller';
import { SessionService } from './service';

describe('SessionController Integration', () => {
  let testServer: ApiTestServer;
  let mockSessionService: jest.Mocked<SessionService>;

  const testSessionId = 'sess_test123';

  beforeEach(async () => {
    mockSessionService = {
      getSession: jest.fn(),
      authorizeSession: jest.fn(),
    } as unknown as jest.Mocked<SessionService>;

    testServer = new ApiTestServer({
      gamemodeApiKeyHash: 'test-hash',
    }).mockService(SessionService, mockSessionService);

    testServer.registerController(SessionController);
    await testServer.start();
  });

  afterEach(async () => {
    await testServer.stop();
  });

  describe('PUT /sessions/auth', () => {
    const authRequest: AuthorizeSessionRequest = {
      accessToken: 'access_token_123',
    };

    const sessionInfo: SessionInfo = {
      id: testSessionId,
      tokenHash: 'token_hash_123',
      account: {
        id: 'acc_test123',
        username: 'testuser',
        segmentDefinitionIds: [],
        authorizedDate: Date.now(),
      },
      ipAddress: '127.0.0.1',
    };

    const sessionToken = Buffer.from(`${testSessionId}:session_token_123`).toString('base64');
    const authHeader = `Basic ${sessionToken}`;

    it('should authorize session successfully when session has no account', async () => {
      const expectedTokenHash = generateSessionTokenHash(testSessionId, 'session_token_123');

      const sessionWithoutAccount: RPSession = {
        id: testSessionId,
        tokenHash: expectedTokenHash,
        hash: 'session_hash',
      };

      mockSessionService.getSession.mockReturnValue(sessionWithoutAccount);
      mockSessionService.authorizeSession.mockResolvedValue(sessionInfo);

      const fastify = testServer.getFastify();
      const response = await fastify.inject({
        method: 'PUT',
        url: '/sessions/auth',
        headers: {
          authorization: authHeader,
          'content-type': 'application/json',
        },
        payload: authRequest,
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.payload)).toEqual(sessionInfo);
      expect(mockSessionService.getSession).toHaveBeenCalledWith(testSessionId);
      expect(mockSessionService.authorizeSession).toHaveBeenCalledWith(testSessionId, authRequest);
    });

    it('should return 409 conflict when session already has an account', async () => {
      const expectedTokenHash = generateSessionTokenHash(testSessionId, 'session_token_123');

      const sessionWithAccount: RPSession = {
        id: testSessionId,
        tokenHash: expectedTokenHash,
        hash: 'session_hash',
        account: {
          id: 'existing_acc',
          username: 'existinguser',
          segmentDefinitionIds: [],
          authorizedDate: Date.now(),
        },
      };

      mockSessionService.getSession.mockReturnValue(sessionWithAccount);

      const fastify = testServer.getFastify();
      const response = await fastify.inject({
        method: 'PUT',
        url: '/sessions/auth',
        headers: {
          authorization: authHeader,
          'content-type': 'application/json',
        },
        payload: authRequest,
      });

      expect(response.statusCode).toBe(409);
      const responseBody = JSON.parse(response.payload);
      expect(responseBody.key).toBe('SESSION_HAS_AUTHORIZED');
      expect(responseBody.params).toEqual({});
      expect(mockSessionService.getSession).toHaveBeenCalledWith(testSessionId);
      expect(mockSessionService.authorizeSession).not.toHaveBeenCalled();
    });

    it('should return 401 when no authorization header is provided', async () => {
      const fastify = testServer.getFastify();
      const response = await fastify.inject({
        method: 'PUT',
        url: '/sessions/auth',
        headers: {
          'content-type': 'application/json',
        },
        payload: authRequest,
      });

      expect(response.statusCode).toBe(401);
      const responseBody = JSON.parse(response.payload);
      expect(responseBody.key).toBe('SESSION_TOKEN_MISSING');
    });

    it('should return 401 when invalid session token is provided', async () => {
      const invalidAuthHeader = 'Basic invalid_token';

      const fastify = testServer.getFastify();
      const response = await fastify.inject({
        method: 'PUT',
        url: '/sessions/auth',
        headers: {
          authorization: invalidAuthHeader,
          'content-type': 'application/json',
        },
        payload: authRequest,
      });

      expect(response.statusCode).toBe(401);
      const responseBody = JSON.parse(response.payload);
      expect(responseBody.key).toBe('INVALID_SESSION_TOKEN_FORMAT');
    });

    it('should return 404 when session is not found', async () => {
      mockSessionService.getSession.mockReturnValue(undefined);

      const fastify = testServer.getFastify();
      const response = await fastify.inject({
        method: 'PUT',
        url: '/sessions/auth',
        headers: {
          authorization: authHeader,
          'content-type': 'application/json',
        },
        payload: authRequest,
      });

      expect(response.statusCode).toBe(404);
      expect(mockSessionService.getSession).toHaveBeenCalledWith(testSessionId);
      expect(mockSessionService.authorizeSession).not.toHaveBeenCalled();
    });
  });
});
