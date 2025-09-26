/**
 * Tests for ConfigurationService
 */
import { ConfigKey } from '@roleplayx/engine-sdk';

import { RPEventEmitter } from '../../../core/bus/event-emitter';
import { RPHookBus } from '../../../core/bus/hook-bus';
import { MockLogger } from '../../../../test/mocks';
import { RPServerContext } from '../../core/context';
import { RPServerEvents } from '../../core/events/events';
import { RPServerHooks } from '../../core/hooks/hooks';

import { ConfigurationService } from './service';

describe('ConfigurationService', () => {
  let mockLogger: MockLogger;
  let mockEventEmitter: RPEventEmitter<RPServerEvents>;
  let mockHookBus: RPHookBus<RPServerHooks>;
  let mockContext: RPServerContext;
  let configurationService: ConfigurationService;

  const testConfigs = [
    { key: ConfigKey.PlayerSlot, value: 32 },
    { key: ConfigKey.Name, value: 'Test Server' },
    { key: ConfigKey.SmtpEnabled, value: true },
  ];

  const mockConfigurationApi = {
    getConfiguration: jest.fn(),
  };

  beforeEach(() => {
    mockLogger = new MockLogger();
    mockEventEmitter = new RPEventEmitter<RPServerEvents>();
    mockHookBus = new RPHookBus<RPServerHooks>();

    // Reset mock before each test
    mockConfigurationApi.getConfiguration.mockResolvedValue(testConfigs);

    mockContext = {
      logger: mockLogger,
      eventEmitter: mockEventEmitter,
      hookBus: mockHookBus,
      getEngineApi: jest.fn().mockImplementation((apiType) => {
        if (apiType.name === 'ConfigurationApi') {
          return mockConfigurationApi;
        }
        return {};
      }),
      getService: jest.fn(),
    } as unknown as RPServerContext;

    configurationService = new ConfigurationService(mockContext);
  });

  describe('init', () => {
    it('should initialize configurations', async () => {
      await configurationService.init();

      const allConfigs = configurationService.getConfigs();
      expect(allConfigs).toEqual(testConfigs);
      expect(mockContext.getEngineApi).toHaveBeenCalled();
    });

    it('should log initialization step', async () => {
      const infoSpy = jest.spyOn(mockLogger, 'info');

      await configurationService.init();

      expect(infoSpy).toHaveBeenCalledWith('Initializing configuration...');
    });

    it('should populate configuration map for fast lookup', async () => {
      await configurationService.init();

      const playerSlotConfig = configurationService.getConfig(ConfigKey.PlayerSlot);
      const nameConfig = configurationService.getConfig(ConfigKey.Name);
      const smtpConfig = configurationService.getConfig(ConfigKey.SmtpEnabled);

      expect(playerSlotConfig).toEqual(testConfigs[0]);
      expect(nameConfig).toEqual(testConfigs[1]);
      expect(smtpConfig).toEqual(testConfigs[2]);
    });
  });

  describe('getConfigs', () => {
    beforeEach(async () => {
      await configurationService.init();
    });

    it('should return all configurations', () => {
      const result = configurationService.getConfigs();

      expect(result).toEqual(testConfigs);
      expect(result).toHaveLength(3);
    });

    it('should return the same array reference', () => {
      const result1 = configurationService.getConfigs();
      const result2 = configurationService.getConfigs();

      expect(result1).toBe(result2);
    });
  });

  describe('getConfig', () => {
    beforeEach(async () => {
      await configurationService.init();
    });

    it('should return configuration by key if exists', () => {
      const result = configurationService.getConfig(ConfigKey.PlayerSlot);

      expect(result).toEqual(testConfigs[0]);
    });

    it('should return undefined if configuration does not exist', () => {
      const result = configurationService.getConfig(ConfigKey.Platform);

      expect(result).toBeUndefined();
    });

    it('should handle different configuration values', () => {
      const numberConfig = configurationService.getConfig(ConfigKey.PlayerSlot);
      const stringConfig = configurationService.getConfig(ConfigKey.Name);
      const booleanConfig = configurationService.getConfig(ConfigKey.SmtpEnabled);

      expect(numberConfig?.value).toBe(32);
      expect(stringConfig?.value).toBe('Test Server');
      expect(booleanConfig?.value).toBe(true);
    });
  });

  describe('socket event handlers', () => {
    beforeEach(async () => {
      await configurationService.init();
    });

    describe('onSocketConfigurationUpdated', () => {
      it('should refresh configurations and emit configurationUpdated event', async () => {
        const updatedConfigs = [
          { ...testConfigs[0], value: 64 },
          { ...testConfigs[1], value: 'Updated Server' },
          { ...testConfigs[2], value: false },
        ];

        (mockContext.getEngineApi as jest.Mock).mockImplementation((apiType) => {
          if (apiType.name === 'ConfigurationApi') {
            return {
              getConfiguration: jest.fn().mockResolvedValue(updatedConfigs),
            };
          }
          return {};
        });

        const emitSpy = jest.spyOn(mockEventEmitter, 'emit');
        const timestamp = Date.now();

        mockEventEmitter.emit('socketConfigurationUpdated', { timestamp });

        // Wait for async handler
        await new Promise((resolve) => setTimeout(resolve, 10));

        const allConfigs = configurationService.getConfigs();
        expect(allConfigs).toEqual(updatedConfigs);
        expect(emitSpy).toHaveBeenCalledWith('configurationUpdated', { timestamp });
      });

      it('should handle API call parameters correctly', async () => {
        const mockGetConfiguration = jest.fn().mockResolvedValue(testConfigs);
        (mockContext.getEngineApi as jest.Mock).mockImplementation((apiType) => {
          if (apiType.name === 'ConfigurationApi') {
            return { getConfiguration: mockGetConfiguration };
          }
          return {};
        });

        mockEventEmitter.emit('socketConfigurationUpdated', { timestamp: Date.now() });

        // Wait for async handler
        await new Promise((resolve) => setTimeout(resolve, 10));

        expect(mockGetConfiguration).toHaveBeenCalledWith({
          localized: false,
          onlyPublic: false,
          withOptions: false,
        });
      });

      it('should update configuration map after refresh', async () => {
        const updatedConfigs = [
          { ...testConfigs[0], value: 128 },
          { ...testConfigs[1], value: 'Super Server' },
        ];

        (mockContext.getEngineApi as jest.Mock).mockImplementation((apiType) => {
          if (apiType.name === 'ConfigurationApi') {
            return {
              getConfiguration: jest.fn().mockResolvedValue(updatedConfigs),
            };
          }
          return {};
        });

        mockEventEmitter.emit('socketConfigurationUpdated', { timestamp: Date.now() });

        // Wait for async handler
        await new Promise((resolve) => setTimeout(resolve, 10));

        const playerSlotConfig = configurationService.getConfig(ConfigKey.PlayerSlot);
        const nameConfig = configurationService.getConfig(ConfigKey.Name);
        const removedConfig = configurationService.getConfig(ConfigKey.SmtpEnabled);

        expect(playerSlotConfig?.value).toBe(128);
        expect(nameConfig?.value).toBe('Super Server');
        expect(removedConfig).toBeUndefined(); // This config was removed
      });
    });
  });

  describe('cache management', () => {
    beforeEach(async () => {
      await configurationService.init();
    });

    it('should maintain configuration array and map consistency', () => {
      const allConfigs = configurationService.getConfigs();

      allConfigs.forEach((config) => {
        const mappedConfig = configurationService.getConfig(config.key);
        expect(mappedConfig).toEqual(config);
      });
    });

    it('should handle empty configuration sets correctly', async () => {
      (mockContext.getEngineApi as jest.Mock).mockImplementation((apiType) => {
        if (apiType.name === 'ConfigurationApi') {
          return {
            getConfiguration: jest.fn().mockResolvedValue([]),
          };
        }
        return {};
      });

      await configurationService['refreshConfigs']();

      const allConfigs = configurationService.getConfigs();
      expect(allConfigs).toEqual([]);
      expect(allConfigs).toHaveLength(0);

      const someConfig = configurationService.getConfig(ConfigKey.PlayerSlot);
      expect(someConfig).toBeUndefined();
    });

    it('should handle configuration updates correctly', async () => {
      // Initial state
      expect(configurationService.getConfigs()).toHaveLength(3);

      // Update with new set
      const newConfigs = [
        { ...testConfigs[0], value: 256 },
        {
          key: ConfigKey.Platform,
          value: 'FIVEM',
        },
      ];

      (mockContext.getEngineApi as jest.Mock).mockImplementation((apiType) => {
        if (apiType.name === 'ConfigurationApi') {
          return {
            getConfiguration: jest.fn().mockResolvedValue(newConfigs),
          };
        }
        return {};
      });

      await configurationService['refreshConfigs']();

      const allConfigs = configurationService.getConfigs();
      expect(allConfigs).toEqual(newConfigs);
      expect(allConfigs).toHaveLength(2);

      // Check that old configs are removed and new ones are added
      expect(configurationService.getConfig(ConfigKey.PlayerSlot)?.value).toBe(256);
      expect(configurationService.getConfig(ConfigKey.Platform)?.value).toBe('FIVEM');
      expect(configurationService.getConfig(ConfigKey.Name)).toBeUndefined();
      expect(configurationService.getConfig(ConfigKey.SmtpEnabled)).toBeUndefined();
    });
  });
});
