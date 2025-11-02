/**
 * Tests for CharacterFactory
 */
import {
  BaseBlueprintConfigValue,
  BlueprintConfigCategory,
  BlueprintConfigType,
  Character,
} from '@roleplayx/engine-sdk';

import { RPEventEmitter } from '../../../core/bus/event-emitter';
import { RPHookBus } from '../../../core/bus/hook-bus';
import { MockLogger } from '../../../../test/mocks';
import { RPServerContext } from '../../core/context';
import { RPServerEvents } from '../../core/events/events';
import { RPServerHooks } from '../../core/hooks/hooks';
import { BlueprintService } from '../blueprint/service';
import { ReferenceService } from '../reference/service';

import { CharacterFactory } from './factory';
import { RPCharacter } from './models/character';

describe('CharacterFactory', () => {
  let mockLogger: MockLogger;
  let mockEventEmitter: RPEventEmitter<RPServerEvents>;
  let mockHookBus: RPHookBus<RPServerHooks>;
  let mockContext: RPServerContext;
  let characterFactory: CharacterFactory;
  let mockBlueprintService: jest.Mocked<BlueprintService>;
  let mockReferenceService: jest.Mocked<ReferenceService>;

  // Test data
  const testCharacter: Character = {
    id: 'char_test123',
    accountId: 'acc_test123',
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
      data: { hairColor: 'brown', eyeColor: 'blue' },
      version: 1,
      imageUrl: 'https://example.com/image.png',
    },
  };

  const testBlueprintValues: BaseBlueprintConfigValue[] = [
    {
      configKey: 'hairColor',
      type: BlueprintConfigType.Dropdown,
      value: 'brown',
    },
    {
      configKey: 'eyeColor',
      type: BlueprintConfigType.Dropdown,
      value: 'blue',
    },
  ];

  beforeEach(() => {
    mockLogger = new MockLogger();
    mockEventEmitter = new RPEventEmitter<RPServerEvents>();
    mockHookBus = new RPHookBus<RPServerHooks>();

    mockBlueprintService = {
      getValues: jest.fn().mockReturnValue(testBlueprintValues),
      isRequiredValuesMissing: jest.fn().mockReturnValue(false),
    } as unknown as jest.Mocked<BlueprintService>;

    mockReferenceService = {
      fetchReferenceSegmentDefinitionIds: jest.fn().mockResolvedValue([]),
    } as unknown as jest.Mocked<ReferenceService>;

    mockContext = {
      logger: mockLogger,
      eventEmitter: mockEventEmitter,
      hookBus: mockHookBus,
      getService: jest.fn().mockImplementation((service) => {
        if (service === BlueprintService) return mockBlueprintService;
        if (service === ReferenceService) return mockReferenceService;
        return undefined;
      }),
      getEngineApi: jest.fn(),
    } as unknown as RPServerContext;

    characterFactory = new CharacterFactory(mockContext);
  });

  describe('create', () => {
    it('should transform character with appearance data', async () => {
      const result = await characterFactory.create({ character: testCharacter });

      expect(result).toMatchObject({
        id: 'char_test123',
        accountId: 'acc_test123',
        firstName: 'John',
        lastName: 'Doe',
        fullName: 'John Doe',
        birthDate: '1990-01-15',
        gender: 'male',
        genderName: 'Male',
        isActive: true,
      });

      expect(result.appearance).toEqual({
        values: testBlueprintValues,
        isUpdateRequired: false,
        imageUrl: 'https://example.com/image.png',
        version: 1,
      });
    });

    it('should call BlueprintService.getValues with correct parameters', async () => {
      await characterFactory.create({ character: testCharacter });

      expect(mockBlueprintService.getValues).toHaveBeenCalledWith(
        BlueprintConfigCategory.CharacterAppearance,
        { hairColor: 'brown', eyeColor: 'blue' },
      );
    });

    it('should call BlueprintService.isRequiredValuesMissing with correct parameters', async () => {
      await characterFactory.create({ character: testCharacter });

      expect(mockBlueprintService.isRequiredValuesMissing).toHaveBeenCalledWith(
        BlueprintConfigCategory.CharacterAppearance,
        { hairColor: 'brown', eyeColor: 'blue' },
        expect.any(Function),
      );
    });

    it('should set isUpdateRequired to true when required values are missing', async () => {
      mockBlueprintService.isRequiredValuesMissing.mockReturnValue(true);

      const result = await characterFactory.create({ character: testCharacter });

      expect(result.appearance.isUpdateRequired).toBe(true);
    });

    it('should set isUpdateRequired to false when all required values are present', async () => {
      mockBlueprintService.isRequiredValuesMissing.mockReturnValue(false);

      const result = await characterFactory.create({ character: testCharacter });

      expect(result.appearance.isUpdateRequired).toBe(false);
    });

    it('should handle character without imageUrl in appearance', async () => {
      const characterWithoutImage: Character = {
        ...testCharacter,
        appearance: {
          data: { hairColor: 'brown' },
          version: 1,
        },
      };

      const result = await characterFactory.create({ character: characterWithoutImage });

      expect(result.appearance.imageUrl).toBeUndefined();
      expect(result.appearance.values).toEqual(testBlueprintValues);
      expect(result.appearance.version).toBe(1);
    });

    it('should handle character without appearance data', async () => {
      const characterWithoutAppearance: Character = {
        ...testCharacter,
        appearance: undefined,
      };

      const result = await characterFactory.create({ character: characterWithoutAppearance });

      expect(result.appearance).toEqual({
        values: [],
        version: 0,
        isUpdateRequired: true,
      });

      expect(mockBlueprintService.getValues).not.toHaveBeenCalled();
      expect(mockBlueprintService.isRequiredValuesMissing).not.toHaveBeenCalled();
    });

    it('should preserve all character properties', async () => {
      const result = await characterFactory.create({ character: testCharacter });

      expect(result.id).toBe(testCharacter.id);
      expect(result.accountId).toBe(testCharacter.accountId);
      expect(result.firstName).toBe(testCharacter.firstName);
      expect(result.lastName).toBe(testCharacter.lastName);
      expect(result.fullName).toBe(testCharacter.fullName);
      expect(result.birthDate).toBe(testCharacter.birthDate);
      expect(result.gender).toBe(testCharacter.gender);
      expect(result.genderName).toBe(testCharacter.genderName);
      expect(result.isActive).toBe(testCharacter.isActive);
      expect(result.createdDate).toBe(testCharacter.createdDate);
      expect(result.lastModifiedDate).toBe(testCharacter.lastModifiedDate);
    });

    it('should return RPCharacter type', async () => {
      const result = await characterFactory.create({ character: testCharacter });

      // Type assertion to ensure correct return type
      const rpCharacter: RPCharacter = result;
      expect(rpCharacter).toBeDefined();
      expect(rpCharacter.appearance).toBeDefined();
      expect(rpCharacter.appearance.values).toBeInstanceOf(Array);
      expect(typeof rpCharacter.appearance.isUpdateRequired).toBe('boolean');
      expect(typeof rpCharacter.appearance.version).toBe('number');
    });

    it('should handle empty appearance data', async () => {
      const characterWithEmptyAppearance: Character = {
        ...testCharacter,
        appearance: {
          data: {},
          version: 0,
        },
      };

      mockBlueprintService.getValues.mockReturnValue([]);
      mockBlueprintService.isRequiredValuesMissing.mockReturnValue(true);

      const result = await characterFactory.create({ character: characterWithEmptyAppearance });

      expect(result.appearance).toEqual({
        values: [],
        version: 0,
        isUpdateRequired: true,
        imageUrl: undefined,
      });

      expect(mockBlueprintService.getValues).toHaveBeenCalledWith(
        BlueprintConfigCategory.CharacterAppearance,
        {},
      );
    });

    it('should handle appearance with multiple data fields', async () => {
      const characterWithComplexAppearance: Character = {
        ...testCharacter,
        appearance: {
          data: {
            hairColor: 'brown',
            eyeColor: 'blue',
            skinTone: 'light',
            height: '180',
            weight: '75',
          },
          version: 2,
          imageUrl: 'https://example.com/complex.png',
        },
      };

      const complexBlueprintValues: BaseBlueprintConfigValue[] = [
        {
          configKey: 'hairColor',
          type: BlueprintConfigType.Dropdown,
          value: 'brown',
        },
        {
          configKey: 'eyeColor',
          type: BlueprintConfigType.Dropdown,
          value: 'blue',
        },
        {
          configKey: 'skinTone',
          type: BlueprintConfigType.Dropdown,
          value: 'light',
        },
        {
          configKey: 'height',
          type: BlueprintConfigType.Slider,
          value: 180,
        },
        {
          configKey: 'weight',
          type: BlueprintConfigType.Slider,
          value: 75,
        },
      ];

      mockBlueprintService.getValues.mockReturnValue(complexBlueprintValues);

      const result = await characterFactory.create({ character: characterWithComplexAppearance });

      expect(result.appearance.values).toEqual(complexBlueprintValues);
      expect(result.appearance.values).toHaveLength(5);
      expect(mockBlueprintService.getValues).toHaveBeenCalledWith(
        BlueprintConfigCategory.CharacterAppearance,
        characterWithComplexAppearance.appearance!.data,
      );
    });
  });
});
