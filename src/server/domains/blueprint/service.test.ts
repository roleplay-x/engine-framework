/**
 * Tests for BlueprintService
 */
import {
  BlueprintApi,
  BlueprintConfig,
  BlueprintConfigCategory,
  BlueprintConfigSection,
  BlueprintConfigType,
} from '@roleplayx/engine-sdk';

import { RPEventEmitter } from '../../../core/bus/event-emitter';
import { RPHookBus } from '../../../core/bus/hook-bus';
import { MockLogger } from '../../../../test/mocks';
import { RPServerContext } from '../../core/context';
import { RPServerEvents } from '../../core/events/events';
import { RPServerHooks } from '../../core/hooks/hooks';

import { BlueprintService } from './service';

describe('BlueprintService', () => {
  let mockLogger: MockLogger;
  let mockEventEmitter: RPEventEmitter<RPServerEvents>;
  let mockHookBus: RPHookBus<RPServerHooks>;
  let mockContext: RPServerContext;
  let blueprintService: BlueprintService;
  let mockBlueprintApi: jest.Mocked<BlueprintApi>;

  // Test data
  const testConfig1: BlueprintConfig = {
    id: 'cfg_1',
    category: BlueprintConfigCategory.CharacterAppearance,
    categoryName: 'Character Appearance',
    sectionId: 'sec_1',
    sectionKey: 'appearance',
    type: BlueprintConfigType.Dropdown,
    typeName: 'Dropdown',
    key: 'hairColor',
    name: 'Hair Color',
    order: 1,
    enabled: true,
    optional: false,
    parameters: {},
    constraints: {},
  };

  const testConfig2: BlueprintConfig = {
    id: 'cfg_2',
    category: BlueprintConfigCategory.CharacterAppearance,
    categoryName: 'Character Appearance',
    sectionId: 'sec_1',
    sectionKey: 'appearance',
    type: BlueprintConfigType.Dropdown,
    typeName: 'Dropdown',
    key: 'eyeColor',
    name: 'Eye Color',
    order: 2,
    enabled: true,
    optional: false,
    parameters: {},
    constraints: {},
  };

  const testConfig3: BlueprintConfig = {
    id: 'cfg_3',
    category: BlueprintConfigCategory.CharacterAppearance,
    categoryName: 'Character Appearance',
    sectionId: 'sec_1',
    sectionKey: 'appearance',
    type: BlueprintConfigType.ListSelect,
    typeName: 'List Select',
    key: 'accessories',
    name: 'Accessories',
    order: 3,
    enabled: true,
    optional: true,
    parameters: {},
    constraints: {},
  };

  const testSection1: BlueprintConfigSection = {
    id: 'sec_1',
    category: BlueprintConfigCategory.CharacterAppearance,
    categoryName: 'Character Appearance',
    key: 'appearance',
    name: 'Appearance',
    order: 1,
    enabled: true,
    visible: true,
    constraints: {},
    configs: [testConfig1, testConfig2, testConfig3],
  };

  beforeEach(() => {
    mockLogger = new MockLogger();
    mockEventEmitter = new RPEventEmitter<RPServerEvents>();
    mockHookBus = new RPHookBus<RPServerHooks>();

    mockBlueprintApi = {
      getAllBlueprintSections: jest.fn().mockResolvedValue([testSection1]),
      getBlueprintConfig: jest.fn(),
    } as unknown as jest.Mocked<BlueprintApi>;

    mockContext = {
      logger: mockLogger,
      eventEmitter: mockEventEmitter,
      hookBus: mockHookBus,
      getEngineApi: jest.fn().mockReturnValue(mockBlueprintApi),
      getService: jest.fn(),
    } as unknown as RPServerContext;

    blueprintService = new BlueprintService(mockContext);
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  describe('init', () => {
    it('should load blueprint sections on initialization', async () => {
      await blueprintService.init();

      expect(mockBlueprintApi.getAllBlueprintSections).toHaveBeenCalledWith({
        category: undefined,
        enabled: true,
        noCache: true,
        includeConfigs: true,
      });
    });

    it('should cache configs after initialization', async () => {
      await blueprintService.init();

      const values = blueprintService.getValues(BlueprintConfigCategory.CharacterAppearance, {
        hairColor: 'brown',
      });

      expect(values.length).toBeGreaterThan(0);
    });

    it('should setup periodic refresh interval', async () => {
      jest.useFakeTimers();

      await blueprintService.init();

      // Clear initial call
      mockBlueprintApi.getAllBlueprintSections.mockClear();

      // Fast-forward 5 minutes
      jest.advanceTimersByTime(300000);

      expect(mockBlueprintApi.getAllBlueprintSections).toHaveBeenCalledTimes(1);

      jest.useRealTimers();
    });
  });

  describe('getValues', () => {
    beforeEach(async () => {
      await blueprintService.init();
    });

    it('should return empty array for unknown category', () => {
      const values = blueprintService.getValues('UnknownCategory' as any, {
        hairColor: 'brown',
      });

      expect(values).toEqual([]);
    });

    it('should transform raw data to blueprint values', () => {
      const data = {
        hairColor: 'brown',
        eyeColor: 'blue',
      };

      const values = blueprintService.getValues(BlueprintConfigCategory.CharacterAppearance, data);

      expect(values).toBeDefined();
      expect(Array.isArray(values)).toBe(true);
    });

    it('should handle empty data', () => {
      const values = blueprintService.getValues(BlueprintConfigCategory.CharacterAppearance, {});

      expect(values).toEqual([]);
    });

    it('should only return values for existing configs', () => {
      const data = {
        hairColor: 'brown',
        nonExistentKey: 'value',
      };

      const values = blueprintService.getValues(BlueprintConfigCategory.CharacterAppearance, data);

      // Should not include nonExistentKey
      const hasNonExistent = values.some((v) => v.configKey === 'nonExistentKey');
      expect(hasNonExistent).toBe(false);
    });
  });

  describe('isRequiredValuesMissing', () => {
    beforeEach(async () => {
      await blueprintService.init();
    });

    it('should return false when all required values are present', () => {
      const data = {
        hairColor: 'brown',
        eyeColor: 'blue',
      };

      const result = blueprintService.isRequiredValuesMissing(
        BlueprintConfigCategory.CharacterAppearance,
        data,
      );

      expect(result).toBe(false);
    });

    it('should return true when a required value is missing', () => {
      const data = {
        hairColor: 'brown',
        // eyeColor is missing
      };

      const result = blueprintService.isRequiredValuesMissing(
        BlueprintConfigCategory.CharacterAppearance,
        data,
      );

      expect(result).toBe(true);
    });

    it('should return true when a required value is empty string', () => {
      const data = {
        hairColor: '',
        eyeColor: 'blue',
      };

      const result = blueprintService.isRequiredValuesMissing(
        BlueprintConfigCategory.CharacterAppearance,
        data,
      );

      expect(result).toBe(true);
    });

    it('should return false when optional values are missing', () => {
      const data = {
        hairColor: 'brown',
        eyeColor: 'blue',
        // accessories is optional, so missing is OK
      };

      const result = blueprintService.isRequiredValuesMissing(
        BlueprintConfigCategory.CharacterAppearance,
        data,
      );

      expect(result).toBe(false);
    });

    it('should return false for unknown category', () => {
      const result = blueprintService.isRequiredValuesMissing('UnknownCategory' as any, {
        someKey: 'value',
      });

      expect(result).toBe(false);
    });

    it('should return false when category has no required configs', async () => {
      // Create a section with only optional configs
      const optionalSection: BlueprintConfigSection = {
        id: 'sec_optional',
        category: 'TestCategory' as BlueprintConfigCategory,
        categoryName: 'Test Category',
        key: 'test_optional',
        name: 'Optional Section',
        order: 1,
        enabled: true,
        visible: true,
        constraints: {},
        configs: [testConfig3], // Only optional config
      };

      mockBlueprintApi.getAllBlueprintSections.mockResolvedValue([optionalSection]);

      const newService = new BlueprintService(mockContext);
      await newService.init();

      const result = newService.isRequiredValuesMissing('TestCategory' as any, {});

      expect(result).toBe(false);
    });
  });

  describe('config caching', () => {
    it('should cache enabled configs only', async () => {
      const disabledConfig: BlueprintConfig = {
        ...testConfig1,
        id: 'cfg_disabled',
        key: 'disabledKey',
        enabled: false,
      };

      const sectionWithDisabled: BlueprintConfigSection = {
        ...testSection1,
        configs: [testConfig1, disabledConfig],
      };

      mockBlueprintApi.getAllBlueprintSections.mockResolvedValue([sectionWithDisabled]);

      await blueprintService.init();

      const values = blueprintService.getValues(BlueprintConfigCategory.CharacterAppearance, {
        hairColor: 'brown',
        disabledKey: 'value',
      });

      const hasDisabled = values.some((v) => v.configKey === 'disabledKey');
      expect(hasDisabled).toBe(false);
    });

    it('should cache configs from enabled sections only', async () => {
      const disabledSection: BlueprintConfigSection = {
        ...testSection1,
        id: 'sec_disabled',
        enabled: false,
        configs: [testConfig1],
      };

      mockBlueprintApi.getAllBlueprintSections.mockResolvedValue([disabledSection]);

      await blueprintService.init();

      const values = blueprintService.getValues(BlueprintConfigCategory.CharacterAppearance, {
        hairColor: 'brown',
      });

      expect(values).toEqual([]);
    });

    it('should handle sections with no configs', async () => {
      const emptySection: BlueprintConfigSection = {
        ...testSection1,
        configs: undefined,
      };

      mockBlueprintApi.getAllBlueprintSections.mockResolvedValue([emptySection]);

      await blueprintService.init();

      const values = blueprintService.getValues(BlueprintConfigCategory.CharacterAppearance, {
        hairColor: 'brown',
      });

      expect(values).toEqual([]);
    });

    it('should group configs by category', async () => {
      const vehicleSection: BlueprintConfigSection = {
        ...testSection1,
        id: 'sec_vehicle',
        category: BlueprintConfigCategory.VehicleModification,
        categoryName: 'Vehicle Modification',
        key: 'vehicle',
        name: 'Vehicle',
        configs: [
          {
            ...testConfig1,
            id: 'cfg_vehicle',
            category: BlueprintConfigCategory.VehicleModification,
            categoryName: 'Vehicle Modification',
            sectionId: 'sec_vehicle',
            sectionKey: 'vehicle',
            key: 'color',
          },
        ],
      };

      mockBlueprintApi.getAllBlueprintSections.mockResolvedValue([testSection1, vehicleSection]);

      await blueprintService.init();

      const appearanceValues = blueprintService.getValues(
        BlueprintConfigCategory.CharacterAppearance,
        { hairColor: 'brown' },
      );

      const vehicleValues = blueprintService.getValues(BlueprintConfigCategory.VehicleModification, {
        color: 'red',
      });

      expect(appearanceValues).toBeDefined();
      expect(vehicleValues).toBeDefined();
    });
  });

  describe('required keys tracking', () => {
    beforeEach(async () => {
      await blueprintService.init();
    });

    it('should track required config keys', () => {
      const result = blueprintService.isRequiredValuesMissing(
        BlueprintConfigCategory.CharacterAppearance,
        {},
      );

      expect(result).toBe(true);
    });

    it('should not track optional config keys as required', () => {
      const result = blueprintService.isRequiredValuesMissing(
        BlueprintConfigCategory.CharacterAppearance,
        {
          hairColor: 'brown',
          eyeColor: 'blue',
          // accessories is optional
        },
      );

      expect(result).toBe(false);
    });

    it('should handle category with all optional configs', async () => {
      const allOptionalSection: BlueprintConfigSection = {
        id: 'sec_all_optional',
        category: 'TestCategory' as BlueprintConfigCategory,
        categoryName: 'Test Category',
        key: 'test_all_optional',
        name: 'All Optional',
        order: 1,
        enabled: true,
        visible: true,
        constraints: {},
        configs: [
          { ...testConfig1, optional: true },
          { ...testConfig2, optional: true },
        ],
      };

      mockBlueprintApi.getAllBlueprintSections.mockResolvedValue([allOptionalSection]);

      const newService = new BlueprintService(mockContext);
      await newService.init();

      const result = newService.isRequiredValuesMissing('TestCategory' as any, {});

      expect(result).toBe(false);
    });
  });
});