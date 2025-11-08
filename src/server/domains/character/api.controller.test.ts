import { UpdateCharacterAppearanceRequest } from '@roleplayx/engine-sdk';

import { ApiTestServer } from '../../../../test/api-test-utils';

import { CharacterController } from './api.controller';
import { CharacterService } from './service';
import { generateSessionTokenHash, RPSession } from '../session/models/session';
import { SessionService } from '../session/service';

describe('CharacterController Integration', () => {
  let testServer: ApiTestServer;
  let mockCharacterService: jest.Mocked<CharacterService>;
  let mockSessionService: jest.Mocked<SessionService>;

  const testSessionId = 'sess_test123';
  const testCharacterId = 'char_test123';

  beforeEach(async () => {
    mockCharacterService = {
      updateCharacterAppearance: jest.fn(),
    } as unknown as jest.Mocked<CharacterService>;

    mockSessionService = {
      getSession: jest.fn(),
    } as unknown as jest.Mocked<SessionService>;

    testServer = new ApiTestServer({
      gamemodeApiKeyHash: 'test-hash',
    })
      .mockService(CharacterService, mockCharacterService)
      .mockService(SessionService, mockSessionService);

    testServer.registerController(CharacterController);
    await testServer.start();
  });

  afterEach(async () => {
    await testServer.stop();
  });

  describe('PUT /characters/appearance', () => {
    const appearanceRequest: UpdateCharacterAppearanceRequest = {
      data: {
        hairColor: 'brown',
        eyeColor: 'blue',
        height: '180',
      },
      base64Image: 'data:image/png;base64,iVBORw0KGgo...',
    };

    const sessionToken = Buffer.from(`${testSessionId}:session_token_123`).toString('base64');
    const authHeader = `Basic ${sessionToken}`;

    it('should update character appearance successfully', async () => {
      const expectedTokenHash = generateSessionTokenHash(testSessionId, 'session_token_123');

      const sessionWithCharacter: RPSession = {
        id: testSessionId,
        tokenHash: expectedTokenHash,
        hash: 'session_hash',
        token: 'session_token_123',
        account: {
          id: 'acc_test123',
          username: 'testuser',
          segmentDefinitionIds: [],
          authorizedDate: Date.now(),
        },
        character: {
          id: testCharacterId,
          firstName: 'John',
          lastName: 'Doe',
          fullName: 'John Doe',
          linkedDate: Date.now(),
          segmentDefinitionIds: [],
        },
      };

      mockSessionService.getSession.mockReturnValue(sessionWithCharacter);
      mockCharacterService.updateCharacterAppearance.mockResolvedValue();

      const fastify = testServer.getFastify();
      const response = await fastify.inject({
        method: 'PUT',
        url: '/characters/appearance',
        headers: {
          authorization: authHeader,
          'content-type': 'application/json',
        },
        payload: appearanceRequest,
      });

      expect(response.statusCode).toBe(204);
      expect(mockCharacterService.updateCharacterAppearance).toHaveBeenCalledWith(
        testCharacterId,
        testSessionId,
        appearanceRequest.data,
        appearanceRequest.base64Image,
      );
    });

    it('should update character appearance without base64 image', async () => {
      const expectedTokenHash = generateSessionTokenHash(testSessionId, 'session_token_123');

      const sessionWithCharacter: RPSession = {
        id: testSessionId,
        tokenHash: expectedTokenHash,
        hash: 'session_hash',
        token: 'session_token_123',
        account: {
          id: 'acc_test123',
          username: 'testuser',
          segmentDefinitionIds: [],
          authorizedDate: Date.now(),
        },
        character: {
          id: testCharacterId,
          firstName: 'John',
          lastName: 'Doe',
          fullName: 'John Doe',
          linkedDate: Date.now(),
          segmentDefinitionIds: [],
        },
      };

      mockSessionService.getSession.mockReturnValue(sessionWithCharacter);
      mockCharacterService.updateCharacterAppearance.mockResolvedValue();

      const requestWithoutImage: UpdateCharacterAppearanceRequest = {
        data: {
          hairColor: 'brown',
          eyeColor: 'blue',
        },
      };

      const fastify = testServer.getFastify();
      const response = await fastify.inject({
        method: 'PUT',
        url: '/characters/appearance',
        headers: {
          authorization: authHeader,
          'content-type': 'application/json',
        },
        payload: requestWithoutImage,
      });

      expect(response.statusCode).toBe(204);
      expect(mockCharacterService.updateCharacterAppearance).toHaveBeenCalledWith(
        testCharacterId,
        testSessionId,
        requestWithoutImage.data,
        undefined,
      );
    });

    it('should return 403 when session is not linked to a character', async () => {
      const expectedTokenHash = generateSessionTokenHash(testSessionId, 'session_token_123');

      const sessionWithoutCharacter: RPSession = {
        id: testSessionId,
        tokenHash: expectedTokenHash,
        hash: 'session_hash',
        token: 'session_token_123',
        account: {
          id: 'acc_test123',
          username: 'testuser',
          segmentDefinitionIds: [],
          authorizedDate: Date.now(),
        },
      };

      mockSessionService.getSession.mockReturnValue(sessionWithoutCharacter);

      const fastify = testServer.getFastify();
      const response = await fastify.inject({
        method: 'PUT',
        url: '/characters/appearance',
        headers: {
          authorization: authHeader,
          'content-type': 'application/json',
        },
        payload: appearanceRequest,
      });

      expect(response.statusCode).toBe(403);
      const responseBody = JSON.parse(response.payload);
      expect(responseBody.key).toBe('SESSION_IS_NOT_LINKED_TO_A_CHARACTER');
      expect(mockCharacterService.updateCharacterAppearance).not.toHaveBeenCalled();
    });

    it('should return 403 when session is not authorized', async () => {
      const expectedTokenHash = generateSessionTokenHash(testSessionId, 'session_token_123');

      const sessionWithoutAccount: RPSession = {
        id: testSessionId,
        tokenHash: expectedTokenHash,
        hash: 'session_hash',
        token: 'session_token_123',
      };

      mockSessionService.getSession.mockReturnValue(sessionWithoutAccount);

      const fastify = testServer.getFastify();
      const response = await fastify.inject({
        method: 'PUT',
        url: '/characters/appearance',
        headers: {
          authorization: authHeader,
          'content-type': 'application/json',
        },
        payload: appearanceRequest,
      });

      expect(response.statusCode).toBe(403);
      expect(mockCharacterService.updateCharacterAppearance).not.toHaveBeenCalled();
    });

    it('should return 401 when no authorization header is provided', async () => {
      const fastify = testServer.getFastify();
      const response = await fastify.inject({
        method: 'PUT',
        url: '/characters/appearance',
        headers: {
          'content-type': 'application/json',
        },
        payload: appearanceRequest,
      });

      expect(response.statusCode).toBe(401);
      expect(mockCharacterService.updateCharacterAppearance).not.toHaveBeenCalled();
    });

    it('should return 404 when session is not found', async () => {
      mockSessionService.getSession.mockReturnValue(undefined);

      const fastify = testServer.getFastify();
      const response = await fastify.inject({
        method: 'PUT',
        url: '/characters/appearance',
        headers: {
          authorization: authHeader,
          'content-type': 'application/json',
        },
        payload: appearanceRequest,
      });

      expect(response.statusCode).toBe(404);
      expect(mockSessionService.getSession).toHaveBeenCalledWith(testSessionId);
      expect(mockCharacterService.updateCharacterAppearance).not.toHaveBeenCalled();
    });

    it('should return 401 when invalid session token format is provided', async () => {
      const invalidAuthHeader = 'Basic invalid_token';

      const fastify = testServer.getFastify();
      const response = await fastify.inject({
        method: 'PUT',
        url: '/characters/appearance',
        headers: {
          authorization: invalidAuthHeader,
          'content-type': 'application/json',
        },
        payload: appearanceRequest,
      });

      expect(response.statusCode).toBe(401);
      const responseBody = JSON.parse(response.payload);
      expect(responseBody.key).toBe('INVALID_SESSION_TOKEN_FORMAT');
    });

    it('should handle service errors correctly', async () => {
      const expectedTokenHash = generateSessionTokenHash(testSessionId, 'session_token_123');

      const sessionWithCharacter: RPSession = {
        id: testSessionId,
        tokenHash: expectedTokenHash,
        hash: 'session_hash',
        token: 'session_token_123',
        account: {
          id: 'acc_test123',
          username: 'testuser',
          segmentDefinitionIds: [],
          authorizedDate: Date.now(),
        },
        character: {
          id: testCharacterId,
          firstName: 'John',
          lastName: 'Doe',
          fullName: 'John Doe',
          linkedDate: Date.now(),
          segmentDefinitionIds: [],
        },
      };

      mockSessionService.getSession.mockReturnValue(sessionWithCharacter);
      mockCharacterService.updateCharacterAppearance.mockRejectedValue(
        new Error('Service error'),
      );

      const fastify = testServer.getFastify();
      const response = await fastify.inject({
        method: 'PUT',
        url: '/characters/appearance',
        headers: {
          authorization: authHeader,
          'content-type': 'application/json',
        },
        payload: appearanceRequest,
      });

      expect(response.statusCode).toBe(500);
      expect(mockCharacterService.updateCharacterAppearance).toHaveBeenCalledWith(
        testCharacterId,
        testSessionId,
        appearanceRequest.data,
        appearanceRequest.base64Image,
      );
    });
  });
});