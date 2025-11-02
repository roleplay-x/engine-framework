/**
 * Tests for EventService
 */
import { MockLogger } from '../../../../test/mocks';

import { EventService } from './service';
import { ClientPlatformAdapter } from '../../natives/adapters/platform.adapter';

describe('EventService', () => {
  let mockLogger: MockLogger;
  let mockPlatformAdapter: jest.Mocked<ClientPlatformAdapter>;
  let eventService: EventService;

  beforeEach(async () => {
    mockLogger = new MockLogger();
    mockPlatformAdapter = {
      network: {
        onServerEvent: jest.fn(),
        emitToServer: jest.fn(),
        on: jest.fn(),
        off: jest.fn(),
        once: jest.fn(),
        emit: jest.fn(),
        removeAllListeners: jest.fn(),
        listenerCount: jest.fn().mockReturnValue(0),
        onGameEvent: jest.fn(),
        offGameEvent: jest.fn(),
        mapPlatformEvent: jest.fn(),
        unmapPlatformEvent: jest.fn(),
        getMappedGameEvent: jest.fn().mockReturnValue(null),
      },
    } as unknown as jest.Mocked<ClientPlatformAdapter>;

    const mockContext = {
      logger: mockLogger,
      platformAdapter: mockPlatformAdapter,
    } as any;

    eventService = new EventService(mockContext);

    await eventService.init();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with logger and platform adapter', () => {
      expect(eventService).toBeInstanceOf(EventService);
    });
  });

  describe('onServerEvent', () => {
    it('should delegate to platform adapter network', () => {
      const handler = jest.fn();
      eventService.onServerEvent('playerSpawned', handler);

      expect(mockPlatformAdapter.network.onServerEvent).toHaveBeenCalledWith(
        'playerSpawned',
        expect.any(Function),
      );
    });
  });

  describe('onGameEvent', () => {
    it('should delegate to platform adapter network', () => {
      const handler = jest.fn();
      eventService.onGameEvent('entityDamage', handler);

      expect(mockPlatformAdapter.network.onGameEvent).toHaveBeenCalledWith(
        'entityDamage',
        expect.any(Function),
      );
    });

    it('should support typed game events', () => {
      const handler = (victim: number, attacker: number, weaponHash: number, damage: number) => {
        expect(typeof victim).toBe('number');
        expect(typeof attacker).toBe('number');
        expect(typeof weaponHash).toBe('number');
        expect(typeof damage).toBe('number');
      };

      eventService.onGameEvent('entityDamage', handler);
      expect(mockPlatformAdapter.network.onGameEvent).toHaveBeenCalledWith(
        'entityDamage',
        expect.any(Function),
      );
    });
  });

  describe('offGameEvent', () => {
    it('should delegate to platform adapter network', () => {
      const handler = jest.fn();
      eventService.offGameEvent('entityDamage', handler);

      expect(mockPlatformAdapter.network.offGameEvent).toHaveBeenCalledWith(
        'entityDamage',
        handler,
      );
    });
  });

  describe('mapPlatformEvent', () => {
    it('should delegate to platform adapter network', () => {
      eventService.mapPlatformEvent('customEvent', 'entityDamage');

      expect(mockPlatformAdapter.network.mapPlatformEvent).toHaveBeenCalledWith(
        'customEvent',
        'entityDamage',
      );
    });
  });

  describe('unmapPlatformEvent', () => {
    it('should delegate to platform adapter network', () => {
      eventService.unmapPlatformEvent('customEvent');

      expect(mockPlatformAdapter.network.unmapPlatformEvent).toHaveBeenCalledWith('customEvent');
    });
  });

  describe('getMappedGameEvent', () => {
    it('should delegate to platform adapter network', () => {
      (mockPlatformAdapter.network.getMappedGameEvent as jest.Mock).mockReturnValue('entityDamage');

      const result = eventService.getMappedGameEvent('entityDamage');

      expect(mockPlatformAdapter.network.getMappedGameEvent).toHaveBeenCalledWith('entityDamage');
      expect(result).toBe('entityDamage');
    });

    it('should return null when no mapping exists', () => {
      (mockPlatformAdapter.network.getMappedGameEvent as jest.Mock).mockReturnValue(null);

      const result = eventService.getMappedGameEvent('unknownEvent');

      expect(result).toBeNull();
    });
  });

  describe('emitToServer', () => {
    it('should delegate to platform adapter network', () => {
      eventService.emitToServer('playerReady', 'arg1');

      expect(mockPlatformAdapter.network.emitToServer).toHaveBeenCalledWith(
        'playerReady',
        'arg1'
      );
    });
  });

  describe('on', () => {
    it('should delegate to platform adapter network', () => {
      const handler = jest.fn();
      (eventService.on as any)('testEvent', handler);

      expect(mockPlatformAdapter.network.on).toHaveBeenCalledWith(
        'testEvent',
        expect.any(Function),
      );
    });
  });

  describe('off', () => {
    it('should delegate to platform adapter network', () => {
      const handler = jest.fn();
      (eventService.off as any)('testEvent', handler);

      expect(mockPlatformAdapter.network.off).toHaveBeenCalledWith('testEvent', handler);
    });
  });

  describe('once', () => {
    it('should delegate to platform adapter network', () => {
      const handler = jest.fn();
      (eventService.once as any)('testEvent', handler);

      expect(mockPlatformAdapter.network.once).toHaveBeenCalledWith('testEvent', expect.any(Function));
    });
  });

  describe('emit', () => {
    it('should delegate to platform adapter network', () => {
      (eventService.emit as any)('testEvent', 'arg1');

      expect(mockPlatformAdapter.network.emit).toHaveBeenCalledWith('testEvent', 'arg1');
    });
  });

  describe('removeAllListeners', () => {
    it('should delegate to platform adapter network', () => {
      (eventService.removeAllListeners as any)('testEvent');

      expect(mockPlatformAdapter.network.removeAllListeners).toHaveBeenCalledWith('testEvent');
    });

    it('should remove all listeners when no event specified', () => {
      eventService.removeAllListeners();

      expect(mockPlatformAdapter.network.removeAllListeners).toHaveBeenCalledWith(undefined);
    });
  });

  describe('listenerCount', () => {
    it('should delegate to platform adapter network', () => {
      (mockPlatformAdapter.network.listenerCount as jest.Mock).mockReturnValue(5);

      const count = (eventService.listenerCount as any)('testEvent');

      expect(mockPlatformAdapter.network.listenerCount).toHaveBeenCalledWith('testEvent');
      expect(count).toBe(5);
    });
  });

  describe('integration scenarios', () => {
    it('should handle complete event lifecycle', () => {
      const handler = jest.fn();

      eventService.onGameEvent('entityDamage', handler);
      expect(mockPlatformAdapter.network.onGameEvent).toHaveBeenCalledWith(
        'entityDamage',
        expect.any(Function),
      );

      eventService.offGameEvent('entityDamage', handler);
      expect(mockPlatformAdapter.network.offGameEvent).toHaveBeenCalledWith(
        'entityDamage',
        handler,
      );

      (eventService.listenerCount as any)('entityDamage');
      expect(mockPlatformAdapter.network.listenerCount).toHaveBeenCalledWith('entityDamage');
    });

    it('should handle platform event mapping lifecycle', () => {
      eventService.mapPlatformEvent('onPlayerSpawn', 'entityDamage');
      expect(mockPlatformAdapter.network.mapPlatformEvent).toHaveBeenCalledWith(
        'onPlayerSpawn',
        'entityDamage',
      );

      (mockPlatformAdapter.network.getMappedGameEvent as jest.Mock).mockReturnValue('entityDamage');
      const mappedEvent = eventService.getMappedGameEvent('onPlayerSpawn');
      expect(mappedEvent).toBe('entityDamage');

      eventService.unmapPlatformEvent('onPlayerSpawn');
      expect(mockPlatformAdapter.network.unmapPlatformEvent).toHaveBeenCalledWith('onPlayerSpawn');
    });

    it('should handle server communication', () => {
      // Client'tan server'a event gönderme (doğru type ile)
      eventService.emitToServer('playerReady', {});
      expect(mockPlatformAdapter.network.emitToServer).toHaveBeenCalledWith('playerReady', {});

      // Server'dan client'a event dinleme (var olan event ile)
      const serverHandler = jest.fn();
      eventService.onServerEvent('playerSpawned', serverHandler);
      expect(mockPlatformAdapter.network.onServerEvent).toHaveBeenCalledWith(
        'playerSpawned',
        expect.any(Function),
      );
    });
  });

  describe('error handling', () => {
    it('should handle platform adapter errors gracefully', () => {
      const error = new Error('Platform adapter error');
      (mockPlatformAdapter.network.onGameEvent as jest.Mock).mockImplementation(() => {
        throw error;
      });

      const handler = jest.fn();
      expect(() => eventService.onGameEvent('entityDamage', handler)).toThrow(
        'Platform adapter error',
      );
    });

    it('should handle mapping errors gracefully', () => {
      const error = new Error('Mapping error');
      (mockPlatformAdapter.network.mapPlatformEvent as jest.Mock).mockImplementation(() => {
        throw error;
      });

      expect(() => eventService.mapPlatformEvent('testEvent', 'entityDamage')).toThrow(
        'Mapping error',
      );
    });
  });
});
