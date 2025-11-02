/**
 * Tests for CharacterService
 */
import { Character, CharacterApi, SessionEndReason } from '@roleplayx/engine-sdk';

import { RPEventEmitter } from '../../../core/bus/event-emitter';
import { RPHookBus } from '../../../core/bus/hook-bus';
import { MockLogger } from '../../../../test/mocks';
import { RPServerContext } from '../../core/context';
import { RPServerEvents } from '../../core/events/events';
import { RPServerHooks } from '../../core/hooks/hooks';
import { AccountId } from '../account/models/account';
import { SessionService } from '../session/service';
import { WebViewService } from '../webview/service';
import { ReferenceService } from '../reference/service';

import { CharacterService } from './service';
import { CharacterId, RPCharacter } from './models/character';
import { CharacterFactory } from './factory';

describe('CharacterService', () => {
  let mockLogger: MockLogger;
  let mockEventEmitter: RPEventEmitter<RPServerEvents>;
  let mockHookBus: RPHookBus<RPServerHooks>;
  let mockContext: RPServerContext;
  let characterService: CharacterService;
  let mockCharacterApi: jest.Mocked<CharacterApi>;
  let mockCharacterFactory: jest.Mocked<CharacterFactory>;
  let mockSessionService: jest.Mocked<SessionService>;
  let mockWebViewService: jest.Mocked<WebViewService>;
  let mockReferenceService: jest.Mocked<ReferenceService>;

  // Test data
  const testAccountId: AccountId = 'acc_test123';
  const testCharacterId: CharacterId = 'char_test123';
  const testCharacter: RPCharacter = {
    id: testCharacterId,
    accountId: testAccountId,
    firstName: 'John',
    lastName: 'Doe',
    fullName: 'John Doe',
    birthDate: '1990-01-15',
    gender: 'male',
    genderName: 'Male',
    isActive: true,
    createdDate: Date.now(),
    lastModifiedDate: Date.now(),
    appearance: {
      values: [],
      isUpdateRequired: true,
      version: 0,
    },
    spawned: true,
  };

  const testCharacter2: RPCharacter = {
    id: 'char_test456',
    accountId: testAccountId,
    firstName: 'Jane',
    lastName: 'Doe',
    fullName: 'Jane Doe',
    birthDate: '1992-05-20',
    gender: 'female',
    genderName: 'Female',
    isActive: true,
    createdDate: Date.now(),
    lastModifiedDate: Date.now(),
    appearance: {
      values: [],
      isUpdateRequired: true,
      version: 0,
    },
    spawned: true,
  };

  beforeEach(() => {
    mockLogger = new MockLogger();
    mockEventEmitter = new RPEventEmitter<RPServerEvents>();
    mockHookBus = new RPHookBus<RPServerHooks>();

    mockCharacterApi = {
      getCharacterById: jest.fn().mockResolvedValue(testCharacter),
      getCharacters: jest.fn().mockResolvedValue({
        items: [testCharacter, testCharacter2],
        totalCount: 2,
        pageIndex: 0,
        pageSize: 100,
        pageCount: 1,
      }),
    } as unknown as jest.Mocked<CharacterApi>;

    mockCharacterFactory = {
      create: jest.fn().mockImplementation(async ({ character }) => ({
        ...character,
        appearance: {
          values: [],
          isUpdateRequired: true,
          version: 0,
        },
        spawned: false,
      })),
    } as unknown as jest.Mocked<CharacterFactory>;

    mockSessionService = {
      getPlayerBySession: jest.fn().mockReturnValue({ id: 'player_123' }),
    } as unknown as jest.Mocked<SessionService>;

    mockWebViewService = {
      closeScreen: jest.fn(),
      showScreen: jest.fn(),
    } as unknown as jest.Mocked<WebViewService>;

    mockReferenceService = {
      fetchReferenceSegmentDefinitionIds: jest.fn().mockResolvedValue([]),
    } as unknown as jest.Mocked<ReferenceService>;

    mockContext = {
      logger: mockLogger,
      eventEmitter: mockEventEmitter,
      hookBus: mockHookBus,
      getEngineApi: jest.fn().mockReturnValue(mockCharacterApi),
      getService: jest.fn().mockImplementation((service) => {
        if (service === CharacterFactory) return mockCharacterFactory;
        if (service === SessionService) return mockSessionService;
        if (service === WebViewService) return mockWebViewService;
        if (service === ReferenceService) return mockReferenceService;
        return undefined;
      }),
    } as unknown as RPServerContext;

    characterService = new CharacterService(mockContext);
  });

  describe('getCharacter', () => {
    it('should return character from cache if available', async () => {
      // Pre-populate cache
      characterService['characters'].set(testCharacterId, testCharacter);

      const result = await characterService.getCharacter(testCharacterId);

      expect(result).toBe(testCharacter);
      expect(mockCharacterApi.getCharacterById).not.toHaveBeenCalled();
    });

    it('should fetch character from API if not in cache', async () => {
      const result = await characterService.getCharacter(testCharacterId);

      expect(result).toEqual({ ...testCharacter, spawned: false });
      expect(mockCharacterApi.getCharacterById).toHaveBeenCalledWith(testCharacterId, {
        includeAppearance: true,
        includeMotives: true,
        accountId: undefined,
      });
    });

    it('should validate accountId if provided and character matches', async () => {
      characterService['characters'].set(testCharacterId, testCharacter);

      const result = await characterService.getCharacter(testCharacterId, testAccountId);

      expect(result).toBe(testCharacter);
    });

    it('should return undefined if accountId does not match', async () => {
      characterService['characters'].set(testCharacterId, testCharacter);

      const result = await characterService.getCharacter(testCharacterId, 'acc_different');

      expect(result).toBeUndefined();
    });

    it('should cache character if account is tracked', async () => {
      // Setup account tracking
      characterService['accountToCharacterIds'].set(testAccountId, []);

      const result = await characterService.getCharacter(testCharacterId);

      expect(result).toEqual({ ...testCharacter, spawned: false });
      expect(characterService['characters'].has(testCharacterId)).toBe(true);
      expect(characterService['accountToCharacterIds'].get(testAccountId)).toContain(
        testCharacterId,
      );
    });

    it('should not cache character if account is not tracked', async () => {
      const result = await characterService.getCharacter(testCharacterId);

      expect(result).toEqual({ ...testCharacter, spawned: false });
      expect(characterService['characters'].has(testCharacterId)).toBe(false);
    });

    it('should pass accountId to API when validating ownership', async () => {
      const result = await characterService.getCharacter(testCharacterId, testAccountId);

      expect(mockCharacterApi.getCharacterById).toHaveBeenCalledWith(testCharacterId, {
        includeAppearance: true,
        includeMotives: true,
        accountId: testAccountId,
      });
    });
  });

  describe('getCharactersByAccountId', () => {
    it('should return characters from cache if available', async () => {
      // Pre-populate cache
      characterService['characters'].set(testCharacter.id, testCharacter);
      characterService['characters'].set(testCharacter2.id, testCharacter2);
      characterService['accountToCharacterIds'].set(testAccountId, [
        testCharacter.id,
        testCharacter2.id,
      ]);

      const result = await characterService.getCharactersByAccountId(testAccountId);

      expect(result).toEqual([testCharacter, testCharacter2]);
      expect(mockCharacterApi.getCharacters).not.toHaveBeenCalled();
    });

    it('should fetch characters from API if not in cache', async () => {
      const result = await characterService.getCharactersByAccountId(testAccountId);

      expect(result).toEqual([
        { ...testCharacter, spawned: false },
        { ...testCharacter2, spawned: false },
      ]);
      expect(mockCharacterApi.getCharacters).toHaveBeenCalledWith({
        accountId: testAccountId,
        includeMotives: true,
        includeAppearance: true,
        onlyActive: true,
        pageSize: 20,
        pageIndex: 1,
      });
    });

    it('should filter out undefined characters from cache', async () => {
      // Pre-populate cache with one character missing
      characterService['characters'].set(testCharacter.id, testCharacter);
      characterService['accountToCharacterIds'].set(testAccountId, [
        testCharacter.id,
        'char_missing',
      ]);

      const result = await characterService.getCharactersByAccountId(testAccountId);

      expect(result).toEqual([testCharacter]);
    });

    it('should return empty array if account has no characters in cache', async () => {
      characterService['accountToCharacterIds'].set(testAccountId, []);

      const result = await characterService.getCharactersByAccountId(testAccountId);

      expect(result).toEqual([]);
      expect(mockCharacterApi.getCharacters).not.toHaveBeenCalled();
    });
  });

  describe('event handlers', () => {
    describe('onSessionAuthorized', () => {
      it('should cache all characters when session is authorized', async () => {
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

        expect(characterService['characters'].has(testCharacter.id)).toBe(true);
        expect(characterService['characters'].has(testCharacter2.id)).toBe(true);
        expect(characterService['accountToCharacterIds'].get(testAccountId)).toEqual([
          testCharacter.id,
          testCharacter2.id,
        ]);
      });

      it('should handle empty character list', async () => {
        mockCharacterApi.getCharacters.mockResolvedValue({
          items: [],
          totalCount: 0,
          pageIndex: 0,
          pageSize: 100,
          pageCount: 0,
        });

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

        expect(characterService['accountToCharacterIds'].get(testAccountId)).toEqual([]);
      });
    });

    describe('onSessionCharacterLinked', () => {
      it('should fetch character when character is linked', async () => {
        const sessionInfoAccount = {
          id: testAccountId,
          username: 'testuser',
          segmentDefinitionIds: [],
          authorizedDate: Date.now(),
        };

        const sessionCharacter = {
          id: testCharacterId,
          firstName: 'John',
          lastName: 'Doe',
          fullName: 'John Doe',
          linkedDate: Date.now(),
          segmentDefinitionIds: [],
        };

        mockEventEmitter.emit('sessionCharacterLinked', {
          sessionId: 'session_123',
          account: sessionInfoAccount,
          character: sessionCharacter,
        });

        // Wait for async handler
        await new Promise((resolve) => setTimeout(resolve, 10));

        expect(mockCharacterApi.getCharacterById).toHaveBeenCalledWith(testCharacterId, {
          includeAppearance: true,
          includeMotives: true,
          accountId: undefined,
        });
      });
    });

    describe('onSessionFinished', () => {
      beforeEach(() => {
        // Pre-populate cache
        characterService['characters'].set(testCharacter.id, testCharacter);
        characterService['characters'].set(testCharacter2.id, testCharacter2);
        characterService['accountToCharacterIds'].set(testAccountId, [
          testCharacter.id,
          testCharacter2.id,
        ]);
      });

      it('should remove all characters from cache when session finishes with accountId', () => {
        mockEventEmitter.emit('sessionFinished', {
          sessionId: 'session_123',
          accountId: testAccountId,
          endReason: SessionEndReason.ConnectionDropped,
        });

        expect(characterService['characters'].has(testCharacter.id)).toBe(false);
        expect(characterService['characters'].has(testCharacter2.id)).toBe(false);
        expect(characterService['accountToCharacterIds'].has(testAccountId)).toBe(false);
      });

      it('should do nothing when session finishes without accountId', () => {
        mockEventEmitter.emit('sessionFinished', {
          sessionId: 'session_123',
          accountId: undefined,
          endReason: SessionEndReason.ConnectionDropped,
        });

        expect(characterService['characters'].has(testCharacter.id)).toBe(true);
        expect(characterService['characters'].has(testCharacter2.id)).toBe(true);
        expect(characterService['accountToCharacterIds'].has(testAccountId)).toBe(true);
      });

      it('should do nothing when account has no characters', () => {
        characterService['accountToCharacterIds'].set('acc_empty', []);

        mockEventEmitter.emit('sessionFinished', {
          sessionId: 'session_123',
          accountId: 'acc_empty',
          endReason: SessionEndReason.ConnectionDropped,
        });

        expect(characterService['characters'].has(testCharacter.id)).toBe(true);
        expect(characterService['characters'].has(testCharacter2.id)).toBe(true);
      });

      it('should do nothing when account is not tracked', () => {
        mockEventEmitter.emit('sessionFinished', {
          sessionId: 'session_123',
          accountId: 'acc_unknown',
          endReason: SessionEndReason.ConnectionDropped,
        });

        expect(characterService['characters'].has(testCharacter.id)).toBe(true);
        expect(characterService['characters'].has(testCharacter2.id)).toBe(true);
        expect(characterService['accountToCharacterIds'].has(testAccountId)).toBe(true);
      });
    });
  });

  describe('updateCharacterAppearance', () => {
    const updatedCharacter: Character = {
      id: testCharacterId,
      accountId: testAccountId,
      firstName: 'John',
      lastName: 'Doe',
      fullName: 'John Doe',
      birthDate: '1990-01-15',
      gender: 'male',
      genderName: 'Male',
      isActive: true,
      createdDate: Date.now(),
      lastModifiedDate: Date.now(),
      appearance: {
        data: { hairColor: 'black', eyeColor: 'green' },
        version: 2,
        imageUrl: 'https://example.com/updated.png',
      },
    };

    beforeEach(() => {
      characterService['characters'].set(testCharacterId, testCharacter);
      characterService['accountToCharacterIds'].set(testAccountId, [testCharacterId]);

      mockCharacterApi.updateCharacterAppearance = jest
        .fn()
        .mockResolvedValue(updatedCharacter);
      mockReferenceService.getReferenceSegments = jest.fn().mockReturnValue([
        { id: 'seg_1' },
        { id: 'seg_2' },
      ]);
    });

    it('should update character appearance via API', async () => {
      const appearanceData = { hairColor: 'black', eyeColor: 'green' };
      const base64Image = 'data:image/png;base64,abc123';

      await characterService.updateCharacterAppearance(
        testCharacterId,
        appearanceData,
        base64Image,
      );

      expect(mockCharacterApi.updateCharacterAppearance).toHaveBeenCalledWith(testCharacterId, {
        data: appearanceData,
        base64Image,
      });
    });

    it('should update character appearance without image', async () => {
      const appearanceData = { hairColor: 'black', eyeColor: 'green' };

      await characterService.updateCharacterAppearance(testCharacterId, appearanceData);

      expect(mockCharacterApi.updateCharacterAppearance).toHaveBeenCalledWith(testCharacterId, {
        data: appearanceData,
        base64Image: undefined,
      });
    });

    it('should refresh character in cache after update', async () => {
      const appearanceData = { hairColor: 'black', eyeColor: 'green' };

      await characterService.updateCharacterAppearance(testCharacterId, appearanceData);

      expect(mockCharacterFactory.create).toHaveBeenCalledWith({
        character: updatedCharacter,
        existingCharacter: testCharacter,
        accountSegmentDefinitionIds: ['seg_1', 'seg_2'],
      });
    });

    it('should update character in cache with new appearance data', async () => {
      const appearanceData = { hairColor: 'black', eyeColor: 'green' };

      await characterService.updateCharacterAppearance(testCharacterId, appearanceData);

      const cachedCharacter = characterService['characters'].get(testCharacterId);
      expect(cachedCharacter).toBeDefined();
      expect(cachedCharacter?.id).toBe(testCharacterId);
    });
  });

  describe('markCharacterAsSpawned', () => {
    it('should mark character as spawned', () => {
      characterService['characters'].set(testCharacterId, {
        ...testCharacter,
        spawned: false,
      });

      characterService.markCharacterAsSpawned(testCharacterId);

      const character = characterService['characters'].get(testCharacterId);
      expect(character?.spawned).toBe(true);
    });

    it('should do nothing if character is not in cache', () => {
      characterService.markCharacterAsSpawned('char_nonexistent');

      expect(characterService['characters'].has('char_nonexistent')).toBe(false);
    });

    it('should preserve all other character properties', () => {
      const originalCharacter = {
        ...testCharacter,
        spawned: false,
      };
      characterService['characters'].set(testCharacterId, originalCharacter);

      characterService.markCharacterAsSpawned(testCharacterId);

      const character = characterService['characters'].get(testCharacterId);
      expect(character).toEqual({
        ...originalCharacter,
        spawned: true,
      });
    });

    it('should handle already spawned character', () => {
      characterService['characters'].set(testCharacterId, {
        ...testCharacter,
        spawned: true,
      });

      characterService.markCharacterAsSpawned(testCharacterId);

      const character = characterService['characters'].get(testCharacterId);
      expect(character?.spawned).toBe(true);
    });
  });

  describe('cache management', () => {
    it('should maintain separate characters in cache', () => {
      const character1: RPCharacter = { ...testCharacter, id: 'char_1' };
      const character2: RPCharacter = { ...testCharacter, id: 'char_2', firstName: 'Jane' };

      characterService['characters'].set('char_1', character1);
      characterService['characters'].set('char_2', character2);

      expect(characterService['characters'].get('char_1')).toEqual(character1);
      expect(characterService['characters'].get('char_2')).toEqual(character2);
      expect(characterService['characters'].size).toBe(2);
    });

    it('should handle cache updates correctly', () => {
      characterService['characters'].set(testCharacterId, testCharacter);

      const updatedCharacter = { ...testCharacter, firstName: 'Johnny' };
      characterService['characters'].set(testCharacterId, updatedCharacter);

      expect(characterService['characters'].get(testCharacterId)).toEqual(updatedCharacter);
      expect(characterService['characters'].size).toBe(1);
    });

    it('should track multiple accounts separately', () => {
      const account1Id: AccountId = 'acc_1';
      const account2Id: AccountId = 'acc_2';

      characterService['accountToCharacterIds'].set(account1Id, ['char_1', 'char_2']);
      characterService['accountToCharacterIds'].set(account2Id, ['char_3']);

      expect(characterService['accountToCharacterIds'].get(account1Id)).toEqual([
        'char_1',
        'char_2',
      ]);
      expect(characterService['accountToCharacterIds'].get(account2Id)).toEqual(['char_3']);
    });

    it('should handle character addition to existing account mapping', () => {
      characterService['accountToCharacterIds'].set(testAccountId, [testCharacter.id]);

      const newCharacter: RPCharacter = {
        ...testCharacter,
        id: 'char_new',
      };

      characterService['characters'].set(newCharacter.id, newCharacter);
      characterService['accountToCharacterIds'].get(testAccountId)?.push(newCharacter.id);

      expect(characterService['accountToCharacterIds'].get(testAccountId)).toEqual([
        testCharacter.id,
        'char_new',
      ]);
    });
  });
});
