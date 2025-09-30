import {
  RegisterAccountRequest,
  AccountAuthRequest,
  GrantAccessResult,
  ExternalLoginAuthRequest,
  RedirectUri,
} from '@roleplayx/engine-sdk';
import { ExternalLoginPreAuthRequest } from '@roleplayx/engine-sdk/account/models/external-login-pre-auth-request';
import { ExternalLoginPreAuthResult } from '@roleplayx/engine-sdk/account/models/external-login-pre-auth-result';
import { DiscordUserAccountInfo } from '@roleplayx/engine-sdk/discord/models/discord-user-account-info';

import { ApiTestServer } from '../../../../test/api-test-utils';
import { SessionService } from '../session/service';
import { generateSessionTokenHash, RPSession } from '../session/models/session';

import { AccountController } from './api.controller';
import { AccountService } from './service';
import { RPAccount } from './models/account';

describe('AccountController Integration', () => {
  let testServer: ApiTestServer;
  let mockAccountService: jest.Mocked<AccountService>;
  let mockSessionService: jest.Mocked<SessionService>;

  const testSessionId = 'sess_test123';
  const testAccount: RPAccount = {
    id: 'acc_test123',
    username: 'testuser',
    locale: 'en-US',
    email: 'test@example.com',
    signInOptions: [],
    createdDate: Date.now(),
    lastModifiedDate: Date.now(),
  };

  beforeEach(async () => {
    mockAccountService = {
      registerAccount: jest.fn(),
      authWithPassword: jest.fn(),
      preAuthExternalLogin: jest.fn(),
      authExternalLogin: jest.fn(),
      getDiscordUser: jest.fn(),
      authDiscordImplicitFlow: jest.fn(),
      getDiscordOAuthAuthorizeUrl: jest.fn(),
      authDiscordOAuthFlow: jest.fn(),
    } as unknown as jest.Mocked<AccountService>;

    mockSessionService = {
      getSession: jest.fn(),
    } as unknown as jest.Mocked<SessionService>;

    testServer = new ApiTestServer({
      gamemodeApiKeyHash: 'test-hash',
    })
      .mockService(AccountService, mockAccountService)
      .mockService(SessionService, mockSessionService);

    testServer.registerController(AccountController);
    await testServer.start();
  });

  afterEach(async () => {
    await testServer.stop();
  });

  describe('POST /accounts', () => {
    const registerRequest: RegisterAccountRequest = {
      username: 'newuser',
      password: 'password123',
      confirmPassword: 'password123',
      email: 'newuser@example.com',
    };

    const sessionToken = Buffer.from(`${testSessionId}:session_token_123`).toString('base64');
    const authHeader = `Basic ${sessionToken}`;

    it('should register account successfully when session has no account', async () => {
      const expectedTokenHash = generateSessionTokenHash(testSessionId, 'session_token_123');

      const sessionWithoutAccount: RPSession = {
        id: testSessionId,
        tokenHash: expectedTokenHash,
        token: 'session_token_123',
        hash: 'session_hash',
      };

      mockSessionService.getSession.mockReturnValue(sessionWithoutAccount);
      mockAccountService.registerAccount.mockResolvedValue(testAccount);

      const fastify = testServer.getFastify();
      const response = await fastify.inject({
        method: 'POST',
        url: '/accounts',
        headers: {
          authorization: authHeader,
          'content-type': 'application/json',
        },
        payload: registerRequest,
      });

      expect(response.statusCode).toBe(201);
      expect(JSON.parse(response.payload)).toEqual(testAccount);
      expect(mockSessionService.getSession).toHaveBeenCalledWith(testSessionId);
      expect(mockAccountService.registerAccount).toHaveBeenCalledWith(registerRequest);
    });

    it('should return 409 conflict when session already has an account', async () => {
      const expectedTokenHash = generateSessionTokenHash(testSessionId, 'session_token_123');

      const sessionWithAccount: RPSession = {
        id: testSessionId,
        tokenHash: expectedTokenHash,
        token: 'session_token_123',
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
        method: 'POST',
        url: '/accounts',
        headers: {
          authorization: authHeader,
          'content-type': 'application/json',
        },
        payload: registerRequest,
      });

      expect(response.statusCode).toBe(409);
      const responseBody = JSON.parse(response.payload);
      expect(responseBody.key).toBe('SESSION_HAS_AUTHORIZED');
      expect(responseBody.params).toEqual({});
      expect(mockSessionService.getSession).toHaveBeenCalledWith(testSessionId);
      expect(mockAccountService.registerAccount).not.toHaveBeenCalled();
    });

    it('should return 404 when session is not found', async () => {
      mockSessionService.getSession.mockReturnValue(undefined);

      const fastify = testServer.getFastify();
      const response = await fastify.inject({
        method: 'POST',
        url: '/accounts',
        headers: {
          authorization: authHeader,
          'content-type': 'application/json',
        },
        payload: registerRequest,
      });

      expect(response.statusCode).toBe(404);
      const responseBody = JSON.parse(response.payload);
      expect(responseBody.key).toBe('SESSION_NOT_FOUND');
      expect(mockAccountService.registerAccount).not.toHaveBeenCalled();
    });

    it('should return 401 when no authorization header is provided', async () => {
      const fastify = testServer.getFastify();
      const response = await fastify.inject({
        method: 'POST',
        url: '/accounts',
        headers: {
          'content-type': 'application/json',
        },
        payload: registerRequest,
      });

      expect(response.statusCode).toBe(401);
      const responseBody = JSON.parse(response.payload);
      expect(responseBody.key).toBe('SESSION_TOKEN_MISSING');
    });

    it('should return 404 when session is not found in auth middleware', async () => {
      // Mock session service to return undefined for this session
      mockSessionService.getSession.mockReturnValue(undefined);

      const fastify = testServer.getFastify();
      const response = await fastify.inject({
        method: 'POST',
        url: '/accounts',
        headers: {
          authorization: authHeader,
          'content-type': 'application/json',
        },
        payload: registerRequest,
      });

      // Auth middleware should catch this and return 404
      expect(response.statusCode).toBe(404);
      const responseBody = JSON.parse(response.payload);
      expect(responseBody.key).toBe('SESSION_NOT_FOUND');
    });

    it('should return 401 when token hash does not match', async () => {
      const sessionWithDifferentHash: RPSession = {
        id: testSessionId,
        tokenHash: 'different_hash', // Wrong hash
        token: 'session_token_123',
        hash: 'session_hash',
      };

      mockSessionService.getSession.mockReturnValue(sessionWithDifferentHash);

      const fastify = testServer.getFastify();
      const response = await fastify.inject({
        method: 'POST',
        url: '/accounts',
        headers: {
          authorization: authHeader,
          'content-type': 'application/json',
        },
        payload: registerRequest,
      });

      expect(response.statusCode).toBe(401);
      const responseBody = JSON.parse(response.payload);
      expect(responseBody.key).toBe('INVALID_SESSION_TOKEN');
    });
  });

  describe('POST /accounts/auth', () => {
    const authRequest: AccountAuthRequest = {
      username: 'testuser',
      password: 'password123',
    };

    const grantAccessResult: GrantAccessResult = {
      access_token: 'access_token_123',
      account_id: 'acc_test123',
      token_type: 'Bearer',
      expires_in: 3600,
    };

    const sessionToken = Buffer.from(`${testSessionId}:session_token_123`).toString('base64');
    const authHeader = `Basic ${sessionToken}`;

    it('should authenticate successfully when session has no account', async () => {
      const expectedTokenHash = generateSessionTokenHash(testSessionId, 'session_token_123');

      const sessionWithoutAccount: RPSession = {
        id: testSessionId,
        tokenHash: expectedTokenHash,
        token: 'session_token_123',
        hash: 'session_hash',
      };

      mockSessionService.getSession.mockReturnValue(sessionWithoutAccount);
      mockAccountService.authWithPassword.mockResolvedValue(grantAccessResult);

      const fastify = testServer.getFastify();
      const response = await fastify.inject({
        method: 'POST',
        url: '/accounts/auth',
        headers: {
          authorization: authHeader,
          'content-type': 'application/json',
        },
        payload: authRequest,
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.payload)).toEqual(grantAccessResult);
      expect(mockSessionService.getSession).toHaveBeenCalledWith(testSessionId);
      expect(mockAccountService.authWithPassword).toHaveBeenCalledWith(authRequest);
    });

    it('should return 409 conflict when session already has an account', async () => {
      const expectedTokenHash = generateSessionTokenHash(testSessionId, 'session_token_123');

      const sessionWithAccount: RPSession = {
        id: testSessionId,
        tokenHash: expectedTokenHash,
        token: 'session_token_123',
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
        method: 'POST',
        url: '/accounts/auth',
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
      expect(mockAccountService.authWithPassword).not.toHaveBeenCalled();
    });

    it('should return 401 when no authorization header is provided', async () => {
      const fastify = testServer.getFastify();
      const response = await fastify.inject({
        method: 'POST',
        url: '/accounts/auth',
        headers: {
          'content-type': 'application/json',
        },
        payload: authRequest,
      });

      expect(response.statusCode).toBe(401);
      const responseBody = JSON.parse(response.payload);
      expect(responseBody.key).toBe('SESSION_TOKEN_MISSING');
    });
  });

  describe('POST /accounts/external-login/pre-auth', () => {
    const preAuthRequest: ExternalLoginPreAuthRequest = {
      password: 'password123',
      email: 'test@example.com',
    };

    const preAuthResult: ExternalLoginPreAuthResult = {
      externalId: 'ext_id_123',
      username: 'testuser',
      email: 'test@example.com',
      accountId: 'acc_test123',
      emailInputRequired: false,
      usernameInputRequired: false,
    };

    const sessionToken = Buffer.from(`${testSessionId}:session_token_123`).toString('base64');
    const authHeader = `Basic ${sessionToken}`;

    it('should pre-authenticate successfully when session has no account', async () => {
      const expectedTokenHash = generateSessionTokenHash(testSessionId, 'session_token_123');

      const sessionWithoutAccount: RPSession = {
        id: testSessionId,
        tokenHash: expectedTokenHash,
        token: 'session_token_123',
        hash: 'session_hash',
      };

      mockSessionService.getSession.mockReturnValue(sessionWithoutAccount);
      mockAccountService.preAuthExternalLogin.mockResolvedValue(preAuthResult);

      const fastify = testServer.getFastify();
      const response = await fastify.inject({
        method: 'POST',
        url: '/accounts/external-login/pre-auth',
        headers: {
          authorization: authHeader,
          'content-type': 'application/json',
        },
        payload: preAuthRequest,
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.payload)).toEqual(preAuthResult);
      expect(mockSessionService.getSession).toHaveBeenCalledWith(testSessionId);
      expect(mockAccountService.preAuthExternalLogin).toHaveBeenCalledWith(preAuthRequest);
    });

    it('should return 409 conflict when session already has an account', async () => {
      const expectedTokenHash = generateSessionTokenHash(testSessionId, 'session_token_123');

      const sessionWithAccount: RPSession = {
        id: testSessionId,
        tokenHash: expectedTokenHash,
        hash: 'session_hash',
        token: 'session_token_123',
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
        method: 'POST',
        url: '/accounts/external-login/pre-auth',
        headers: {
          authorization: authHeader,
          'content-type': 'application/json',
        },
        payload: preAuthRequest,
      });

      expect(response.statusCode).toBe(409);
      const responseBody = JSON.parse(response.payload);
      expect(responseBody.key).toBe('SESSION_HAS_AUTHORIZED');
      expect(responseBody.params).toEqual({});
      expect(mockSessionService.getSession).toHaveBeenCalledWith(testSessionId);
      expect(mockAccountService.preAuthExternalLogin).not.toHaveBeenCalled();
    });

    it('should return 401 when no authorization header is provided', async () => {
      const fastify = testServer.getFastify();
      const response = await fastify.inject({
        method: 'POST',
        url: '/accounts/external-login/pre-auth',
        headers: {
          'content-type': 'application/json',
        },
        payload: preAuthRequest,
      });

      expect(response.statusCode).toBe(401);
      const responseBody = JSON.parse(response.payload);
      expect(responseBody.key).toBe('SESSION_TOKEN_MISSING');
    });
  });

  describe('POST /accounts/external-login/auth', () => {
    const authRequest: ExternalLoginAuthRequest = {
      password: 'password123',
      username: 'testuser',
      email: 'test@example.com',
    };

    const grantAccessResult: GrantAccessResult = {
      access_token: 'access_token_123',
      account_id: 'acc_test123',
      token_type: 'Bearer',
      expires_in: 3600,
    };

    const sessionToken = Buffer.from(`${testSessionId}:session_token_123`).toString('base64');
    const authHeader = `Basic ${sessionToken}`;

    it('should authenticate successfully when session has no account', async () => {
      const expectedTokenHash = generateSessionTokenHash(testSessionId, 'session_token_123');

      const sessionWithoutAccount: RPSession = {
        id: testSessionId,
        tokenHash: expectedTokenHash,
        token: 'session_token_123',
        hash: 'session_hash',
      };

      mockSessionService.getSession.mockReturnValue(sessionWithoutAccount);
      mockAccountService.authExternalLogin.mockResolvedValue(grantAccessResult);

      const fastify = testServer.getFastify();
      const response = await fastify.inject({
        method: 'POST',
        url: '/accounts/external-login/auth',
        headers: {
          authorization: authHeader,
          'content-type': 'application/json',
        },
        payload: authRequest,
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.payload)).toEqual(grantAccessResult);
      expect(mockSessionService.getSession).toHaveBeenCalledWith(testSessionId);
      expect(mockAccountService.authExternalLogin).toHaveBeenCalledWith(authRequest);
    });

    it('should return 409 conflict when session already has an account', async () => {
      const expectedTokenHash = generateSessionTokenHash(testSessionId, 'session_token_123');

      const sessionWithAccount: RPSession = {
        id: testSessionId,
        tokenHash: expectedTokenHash,
        token: 'session_token_123',
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
        method: 'POST',
        url: '/accounts/external-login/auth',
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
      expect(mockAccountService.authExternalLogin).not.toHaveBeenCalled();
    });

    it('should return 401 when no authorization header is provided', async () => {
      const fastify = testServer.getFastify();
      const response = await fastify.inject({
        method: 'POST',
        url: '/accounts/external-login/auth',
        headers: {
          'content-type': 'application/json',
        },
        payload: authRequest,
      });

      expect(response.statusCode).toBe(401);
      const responseBody = JSON.parse(response.payload);
      expect(responseBody.key).toBe('SESSION_TOKEN_MISSING');
    });
  });

  describe('GET /accounts/discord', () => {
    const discordUserInfo: DiscordUserAccountInfo = {
      accountExists: false,
      usernameRegex: '^[a-zA-Z0-9_]{3,16}$',
      emailRequired: true,
      userId: 'discord_123',
      isMemberOfGuild: true,
      isWhitelisted: true,
      roles: ['@everyone', 'Member'],
      username: 'testuser',
    };

    const sessionToken = Buffer.from(`${testSessionId}:session_token_123`).toString('base64');
    const authHeader = `Basic ${sessionToken}`;

    it('should get Discord user successfully when session has no account', async () => {
      const expectedTokenHash = generateSessionTokenHash(testSessionId, 'session_token_123');

      const sessionWithoutAccount: RPSession = {
        id: testSessionId,
        tokenHash: expectedTokenHash,
        token: 'session_token_123',
        hash: 'session_hash',
      };

      mockSessionService.getSession.mockReturnValue(sessionWithoutAccount);
      mockAccountService.getDiscordUser.mockResolvedValue(discordUserInfo);

      const fastify = testServer.getFastify();
      const response = await fastify.inject({
        method: 'GET',
        url: '/accounts/discord',
        headers: {
          authorization: authHeader,
        },
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.payload)).toEqual(discordUserInfo);
      expect(mockSessionService.getSession).toHaveBeenCalledWith(testSessionId);
      expect(mockAccountService.getDiscordUser).toHaveBeenCalledWith(testSessionId);
    });

    it('should get Discord user successfully even when session has an account', async () => {
      const expectedTokenHash = generateSessionTokenHash(testSessionId, 'session_token_123');

      const sessionWithAccount: RPSession = {
        id: testSessionId,
        token: 'session_token_123',
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
      mockAccountService.getDiscordUser.mockResolvedValue(discordUserInfo);

      const fastify = testServer.getFastify();
      const response = await fastify.inject({
        method: 'GET',
        url: '/accounts/discord',
        headers: {
          authorization: authHeader,
        },
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.payload)).toEqual(discordUserInfo);
      expect(mockSessionService.getSession).toHaveBeenCalledWith(testSessionId);
      expect(mockAccountService.getDiscordUser).toHaveBeenCalledWith(testSessionId);
    });

    it('should return 401 when no authorization header is provided', async () => {
      const fastify = testServer.getFastify();
      const response = await fastify.inject({
        method: 'GET',
        url: '/accounts/discord',
        headers: {},
      });

      expect(response.statusCode).toBe(401);
      const responseBody = JSON.parse(response.payload);
      expect(responseBody.key).toBe('SESSION_TOKEN_MISSING');
    });
  });

  describe('POST /accounts/discord/auth', () => {
    const implicitAuthRequest = {
      discordUserId: 'discord_user_123',
    };

    const grantAccessResult: GrantAccessResult = {
      access_token: 'access_token_123',
      account_id: 'acc_test123',
      token_type: 'Bearer',
      expires_in: 3600,
    };

    const sessionToken = Buffer.from(`${testSessionId}:session_token_123`).toString('base64');
    const authHeader = `Basic ${sessionToken}`;

    it('should authenticate successfully when session has no account', async () => {
      const expectedTokenHash = generateSessionTokenHash(testSessionId, 'session_token_123');

      const sessionWithoutAccount: RPSession = {
        id: testSessionId,
        tokenHash: expectedTokenHash,
        token: 'session_token_123',
        hash: 'session_hash',
      };

      mockSessionService.getSession.mockReturnValue(sessionWithoutAccount);
      mockAccountService.authDiscordImplicitFlow.mockResolvedValue(grantAccessResult);

      const fastify = testServer.getFastify();
      const response = await fastify.inject({
        method: 'POST',
        url: '/accounts/discord/auth',
        headers: {
          authorization: authHeader,
          'content-type': 'application/json',
        },
        payload: implicitAuthRequest,
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.payload)).toEqual(grantAccessResult);
      expect(mockSessionService.getSession).toHaveBeenCalledWith(testSessionId);
      expect(mockAccountService.authDiscordImplicitFlow).toHaveBeenCalledWith({
        sessionId: testSessionId,
        ...implicitAuthRequest,
      });
    });

    it('should return 409 conflict when session already has an account', async () => {
      const expectedTokenHash = generateSessionTokenHash(testSessionId, 'session_token_123');

      const sessionWithAccount: RPSession = {
        id: testSessionId,
        tokenHash: expectedTokenHash,
        token: 'session_token_123',
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
        method: 'POST',
        url: '/accounts/discord/auth',
        headers: {
          authorization: authHeader,
          'content-type': 'application/json',
        },
        payload: implicitAuthRequest,
      });

      expect(response.statusCode).toBe(409);
      const responseBody = JSON.parse(response.payload);
      expect(responseBody.key).toBe('SESSION_HAS_AUTHORIZED');
      expect(mockAccountService.authDiscordImplicitFlow).not.toHaveBeenCalled();
    });

    it('should return 401 when no authorization header is provided', async () => {
      const fastify = testServer.getFastify();
      const response = await fastify.inject({
        method: 'POST',
        url: '/accounts/discord/auth',
        headers: {
          'content-type': 'application/json',
        },
        payload: implicitAuthRequest,
      });

      expect(response.statusCode).toBe(401);
      const responseBody = JSON.parse(response.payload);
      expect(responseBody.key).toBe('SESSION_TOKEN_MISSING');
    });
  });

  describe('GET /accounts/discord/oauth/authorize', () => {
    const redirectUri: RedirectUri = {
      uri: 'https://discord.com/oauth2/authorize?client_id=123&redirect_uri=...',
    };

    const sessionToken = Buffer.from(`${testSessionId}:session_token_123`).toString('base64');
    const authHeader = `Basic ${sessionToken}`;

    it('should get OAuth URL successfully when session has no account', async () => {
      const expectedTokenHash = generateSessionTokenHash(testSessionId, 'session_token_123');

      const sessionWithoutAccount: RPSession = {
        id: testSessionId,
        tokenHash: expectedTokenHash,
        token: 'session_token_123',
        hash: 'session_hash',
      };

      mockSessionService.getSession.mockReturnValue(sessionWithoutAccount);
      mockAccountService.getDiscordOAuthAuthorizeUrl.mockResolvedValue(redirectUri);

      const fastify = testServer.getFastify();
      const response = await fastify.inject({
        method: 'GET',
        url: '/accounts/discord/oauth/authorize',
        headers: {
          authorization: authHeader,
        },
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.payload)).toEqual(redirectUri);
      expect(mockSessionService.getSession).toHaveBeenCalledWith(testSessionId);
      expect(mockAccountService.getDiscordOAuthAuthorizeUrl).toHaveBeenCalled();
    });

    it('should return 409 conflict when session already has an account', async () => {
      const expectedTokenHash = generateSessionTokenHash(testSessionId, 'session_token_123');

      const sessionWithAccount: RPSession = {
        id: testSessionId,
        tokenHash: expectedTokenHash,
        token: 'session_token_123',
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
        method: 'GET',
        url: '/accounts/discord/oauth/authorize',
        headers: {
          authorization: authHeader,
        },
      });

      expect(response.statusCode).toBe(409);
      const responseBody = JSON.parse(response.payload);
      expect(responseBody.key).toBe('SESSION_HAS_AUTHORIZED');
      expect(mockAccountService.getDiscordOAuthAuthorizeUrl).not.toHaveBeenCalled();
    });

    it('should return 401 when no authorization header is provided', async () => {
      const fastify = testServer.getFastify();
      const response = await fastify.inject({
        method: 'GET',
        url: '/accounts/discord/oauth/authorize',
        headers: {},
      });

      expect(response.statusCode).toBe(401);
      const responseBody = JSON.parse(response.payload);
      expect(responseBody.key).toBe('SESSION_TOKEN_MISSING');
    });
  });

  describe('POST /accounts/discord/oauth/token', () => {
    const oauthTokenRequest = {
      code: 'oauth_code_123',
      state: 'state_token_123',
    };

    const grantAccessResult: GrantAccessResult = {
      access_token: 'access_token_123',
      account_id: 'acc_test123',
      token_type: 'Bearer',
      expires_in: 3600,
    };

    const sessionToken = Buffer.from(`${testSessionId}:session_token_123`).toString('base64');
    const authHeader = `Basic ${sessionToken}`;

    it('should authenticate successfully when session has no account', async () => {
      const expectedTokenHash = generateSessionTokenHash(testSessionId, 'session_token_123');

      const sessionWithoutAccount: RPSession = {
        id: testSessionId,
        tokenHash: expectedTokenHash,
        token: 'session_token_123',
        hash: 'session_hash',
      };

      mockSessionService.getSession.mockReturnValue(sessionWithoutAccount);
      mockAccountService.authDiscordOAuthFlow.mockResolvedValue(grantAccessResult);

      const fastify = testServer.getFastify();
      const response = await fastify.inject({
        method: 'POST',
        url: '/accounts/discord/oauth/token',
        headers: {
          authorization: authHeader,
          'content-type': 'application/json',
        },
        payload: oauthTokenRequest,
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.payload)).toEqual(grantAccessResult);
      expect(mockSessionService.getSession).toHaveBeenCalledWith(testSessionId);
      expect(mockAccountService.authDiscordOAuthFlow).toHaveBeenCalledWith({
        ...oauthTokenRequest,
        redirectType: expect.any(String),
      });
    });

    it('should return 409 conflict when session already has an account', async () => {
      const expectedTokenHash = generateSessionTokenHash(testSessionId, 'session_token_123');

      const sessionWithAccount: RPSession = {
        id: testSessionId,
        tokenHash: expectedTokenHash,
        token: 'session_token_123',
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
        method: 'POST',
        url: '/accounts/discord/oauth/token',
        headers: {
          authorization: authHeader,
          'content-type': 'application/json',
        },
        payload: oauthTokenRequest,
      });

      expect(response.statusCode).toBe(409);
      const responseBody = JSON.parse(response.payload);
      expect(responseBody.key).toBe('SESSION_HAS_AUTHORIZED');
      expect(mockAccountService.authDiscordOAuthFlow).not.toHaveBeenCalled();
    });

    it('should return 401 when no authorization header is provided', async () => {
      const fastify = testServer.getFastify();
      const response = await fastify.inject({
        method: 'POST',
        url: '/accounts/discord/oauth/token',
        headers: {
          'content-type': 'application/json',
        },
        payload: oauthTokenRequest,
      });

      expect(response.statusCode).toBe(401);
      const responseBody = JSON.parse(response.payload);
      expect(responseBody.key).toBe('SESSION_TOKEN_MISSING');
    });
  });
});
