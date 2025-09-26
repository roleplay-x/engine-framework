/**
 * Tests for AccountService
 */
import { DiscordOAuthRedirectType, SessionEndReason } from '@roleplayx/engine-sdk';

import { RPEventEmitter } from '../../../core/bus/event-emitter';
import { RPHookBus } from '../../../core/bus/hook-bus';
import { MockLogger } from '../../../../test/mocks';
import { RPServerContext } from '../../core/context';
import { RPServerEvents } from '../../core/events/events';
import { RPServerHooks } from '../../core/hooks/hooks';
import { RPDiscordService } from '../../natives/services/discord.service';

import { AccountService } from './service';
import { AccountId, RPAccount } from './models/account';

describe('AccountService', () => {
  let mockLogger: MockLogger;
  let mockEventEmitter: RPEventEmitter<RPServerEvents>;
  let mockHookBus: RPHookBus<RPServerHooks>;
  let mockContext: RPServerContext;
  let accountService: AccountService;
  let mockDiscordService: jest.Mocked<RPDiscordService>;

  // Test data
  const testAccountId: AccountId = 'acc_test123';
  const testAccount: RPAccount = {
    id: testAccountId,
    username: 'testuser',
    locale: 'en-US',
    email: 'test@example.com',
    signInOptions: [],
    createdDate: Date.now(),
    lastModifiedDate: Date.now(),
  };

  beforeEach(() => {
    mockLogger = new MockLogger();
    mockEventEmitter = new RPEventEmitter<RPServerEvents>();
    mockHookBus = new RPHookBus<RPServerHooks>();

    mockDiscordService = {
      getDiscordUserId: jest.fn().mockReturnValue('discord_user_123'),
    } as unknown as jest.Mocked<RPDiscordService>;

    mockContext = {
      logger: mockLogger,
      eventEmitter: mockEventEmitter,
      hookBus: mockHookBus,
      getEngineApi: jest.fn().mockReturnValue({
        getAccountById: jest.fn().mockResolvedValue(testAccount),
        registerAccount: jest.fn().mockResolvedValue(testAccount),
        authWithPassword: jest.fn().mockResolvedValue({ access_token: 'token' }),
        preAuthExternalLogin: jest.fn().mockResolvedValue({ token: 'pre_auth' }),
        authExternalLogin: jest.fn().mockResolvedValue({ access_token: 'token' }),
      }),
      getService: jest.fn().mockReturnValue(mockDiscordService),
    } as unknown as RPServerContext;

    accountService = new AccountService(mockContext);
  });

  describe('getAccount', () => {
    it('should return account from cache if available', async () => {
      // Pre-populate cache
      accountService['accounts'].set(testAccountId, testAccount);

      const result = await accountService.getAccount(testAccountId);

      expect(result).toBe(testAccount);
    });

    it('should fetch account from API if not in cache', async () => {
      const result = await accountService.getAccount(testAccountId);

      expect(result).toEqual(testAccount);
      expect(mockContext.getEngineApi).toHaveBeenCalled();
    });
  });

  describe('registerAccount', () => {
    it('should delegate to AccountApi', async () => {
      const registerRequest = {
        username: 'newuser',
        password: 'password',
        confirmPassword: 'password',
        email: 'test@example.com',
      };

      const result = await accountService.registerAccount(registerRequest);

      expect(result).toEqual(testAccount);
      expect(mockContext.getEngineApi).toHaveBeenCalled();
    });
  });

  describe('authWithPassword', () => {
    it('should delegate to AccountApi', async () => {
      const authRequest = {
        username: 'testuser',
        password: 'password',
      };

      const result = await accountService.authWithPassword(authRequest);

      expect(result).toEqual({ access_token: 'token' });
      expect(mockContext.getEngineApi).toHaveBeenCalled();
    });
  });

  describe('Discord authentication', () => {
    beforeEach(() => {
      (mockContext.getEngineApi as jest.Mock).mockReturnValue({
        authImplicitFlow: jest.fn().mockResolvedValue({ access_token: 'discord_token' }),
        authOAuthFlow: jest.fn().mockResolvedValue({ access_token: 'oauth_token' }),
        getDiscordUserById: jest.fn().mockResolvedValue({ id: 'user123', username: 'discordUser' }),
      });
    });

    it('should handle Discord implicit flow', async () => {
      const request = { sessionId: 'test-session' };

      const result = await accountService.authDiscordImplicitFlow(request);

      expect(result).toEqual({ access_token: 'discord_token' });
      expect(mockContext.getEngineApi).toHaveBeenCalled();
    });

    it('should handle Discord OAuth flow', async () => {
      const request = {
        code: 'oauth_code',
        redirectType: DiscordOAuthRedirectType.Game,
      };

      const result = await accountService.authDiscordOAuthFlow(request);

      expect(result).toEqual({ access_token: 'oauth_token' });
      expect(mockContext.getEngineApi).toHaveBeenCalled();
    });

    it('should get Discord user', async () => {
      const result = await accountService.getDiscordUser('user123');

      expect(result).toEqual({ id: 'user123', username: 'discordUser' });
      expect(mockContext.getEngineApi).toHaveBeenCalled();
    });
  });

  describe('event handlers', () => {
    describe('onSessionAuthorized', () => {
      it('should cache account when session is authorized', async () => {
        const sessionInfoAccount = {
          id: testAccountId,
          username: 'testuser',
          segmentDefinitionIds: [],
          authorizedDate: Date.now(),
        };

        mockEventEmitter.emit('sessionAuthorized', {
          sessionId: 'session_123',
          account: sessionInfoAccount,
        });

        // Wait for async handler
        await new Promise((resolve) => setTimeout(resolve, 10));

        expect(accountService['accounts'].has(testAccountId)).toBe(true);
      });
    });

    describe('onSessionFinished', () => {
      beforeEach(() => {
        // Pre-populate cache
        accountService['accounts'].set(testAccountId, testAccount);
      });

      it('should remove account from cache when session finishes with accountId', () => {
        mockEventEmitter.emit('sessionFinished', {
          sessionId: 'session_123',
          accountId: testAccountId,
          endReason: SessionEndReason.ConnectionDropped,
        });

        expect(accountService['accounts'].has(testAccountId)).toBe(false);
      });

      it('should do nothing when session finishes without accountId', () => {
        mockEventEmitter.emit('sessionFinished', {
          sessionId: 'session_123',
          accountId: undefined,
          endReason: SessionEndReason.ConnectionDropped,
        });

        expect(accountService['accounts'].has(testAccountId)).toBe(true);
      });
    });

    describe('onSocketAccountUsernameChanged', () => {
      beforeEach(() => {
        // Pre-populate cache
        accountService['accounts'].set(testAccountId, testAccount);
      });

      it('should update cached account username and emit event', () => {
        const newUsername = 'updatedusername';
        const emitSpy = jest.spyOn(mockEventEmitter, 'emit');

        mockEventEmitter.emit('socketAccountUsernameChanged', {
          id: testAccountId,
          username: newUsername,
          timestamp: Date.now(),
        });

        const updatedAccount = accountService['accounts'].get(testAccountId);
        expect(updatedAccount?.username).toBe(newUsername);
        expect(emitSpy).toHaveBeenCalledWith('accountUsernameChanged', {
          accountId: testAccountId,
          username: newUsername,
        });
      });

      it('should do nothing if account is not in cache', () => {
        const emitSpy = jest.spyOn(mockEventEmitter, 'emit');
        const nonExistentAccountId: AccountId = 'acc_nonexistent';

        mockEventEmitter.emit('socketAccountUsernameChanged', {
          id: nonExistentAccountId,
          username: 'newusername',
          timestamp: Date.now(),
        });

        expect(emitSpy).toHaveBeenCalledTimes(1); // Only the original emit call
        expect(accountService['accounts'].has(nonExistentAccountId)).toBe(false);
      });
    });
  });

  describe('cache management', () => {
    it('should maintain separate accounts in cache', () => {
      const account1: RPAccount = { ...testAccount, id: 'acc_1' };
      const account2: RPAccount = { ...testAccount, id: 'acc_2', username: 'user2' };

      accountService['accounts'].set('acc_1', account1);
      accountService['accounts'].set('acc_2', account2);

      expect(accountService['accounts'].get('acc_1')).toEqual(account1);
      expect(accountService['accounts'].get('acc_2')).toEqual(account2);
      expect(accountService['accounts'].size).toBe(2);
    });

    it('should handle cache updates correctly', () => {
      accountService['accounts'].set(testAccountId, testAccount);

      const updatedAccount = { ...testAccount, username: 'updateduser' };
      accountService['accounts'].set(testAccountId, updatedAccount);

      expect(accountService['accounts'].get(testAccountId)).toEqual(updatedAccount);
      expect(accountService['accounts'].size).toBe(1);
    });
  });
});
