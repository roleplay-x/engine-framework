/**
 * Tests for SpawnService
 */
import { MockLogger } from '../../../../test/mocks';
import { SpawnService, SpawnRequestOptions } from './service';
import { ClientPlatformAdapter } from '../../natives/adapters';
import { RPClientContext } from '../../core/context';
import { RPHookBus } from '../../../core/bus/hook-bus';
import { RPClientHooks } from '../../core/hooks/hooks';
import { Vector3 } from '../../../shared';
import { SpawnData } from '../../core/events/types';

// Mock platform adapter
const mockPlatformAdapter = {
  player: {
    getPlayerPed: jest.fn().mockReturnValue(1),
    setPlayerModel: jest.fn().mockResolvedValue(undefined),
    setEntityPosition: jest.fn(),
    setEntityHeading: jest.fn(),
    setPlayerControl: jest.fn(),
    setPlayerInvincible: jest.fn(),
    setPlayerHealth: jest.fn(),
    getEntityCoords: jest.fn().mockReturnValue({ x: 0, y: 0, z: 0 }),
  },
  core: {
    fadeScreen: jest.fn().mockResolvedValue(undefined),
  },
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
  camera: {
    getGameplayCamCoords: jest.fn().mockReturnValue({ x: 0, y: 0, z: 0 }),
    getGameplayCamRot: jest.fn().mockReturnValue({ x: 0, y: 0, z: 0 }),
  },
} as unknown as ClientPlatformAdapter;

// Mock event service
const mockEventService = {
  onServerEvent: jest.fn(),
  offServerEvent: jest.fn(),
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
};

// Mock hook bus
const mockHookBus = {
  run: jest.fn().mockResolvedValue(true),
} as unknown as RPHookBus<RPClientHooks>;

// Mock context
const mockContext = {
  logger: new MockLogger(),
  platformAdapter: mockPlatformAdapter,
  getService: jest.fn().mockReturnValue(mockEventService),
  hookBus: mockHookBus,
} as unknown as RPClientContext;

describe('SpawnService', () => {
  let spawnService: SpawnService;

  beforeEach(() => {
    jest.clearAllMocks();
    spawnService = new SpawnService(mockContext);
  });

  afterEach(() => {
    spawnService.dispose();
  });

  describe('initialization', () => {
    it('should initialize correctly', async () => {
      await spawnService.init();
      expect(spawnService).toBeInstanceOf(SpawnService);
    });

    it('should not be spawning initially', () => {
      expect(spawnService.isCurrentlySpawning()).toBe(false);
    });

    it('should have null spawn data initially', () => {
      expect(spawnService.getCurrentSpawnData()).toBeNull();
    });
  });

  describe('spawn request', () => {
    beforeEach(async () => {
      await spawnService.init();
    });

    it('should request spawn with spawn point ID', async () => {
      const options: SpawnRequestOptions = {
        spawnPointId: 'spawn_1',
      };

      await spawnService.requestSpawn(options);

      expect(mockEventService.emitToServer).toHaveBeenCalledWith('spawn:request', {
        spawnPointId: 'spawn_1',
      });
    });

    it('should request spawn without options', async () => {
      await spawnService.requestSpawn();

      expect(mockEventService.emitToServer).toHaveBeenCalledWith('spawn:request', {});
    });

    it('should not request spawn if already spawning', async () => {
      spawnService['isSpawning'] = true;

      await spawnService.requestSpawn();

      expect(mockEventService.emitToServer).not.toHaveBeenCalled();
    });
  });

  describe('spawn execution', () => {
    beforeEach(async () => {
      await spawnService.init();
    });

    it('should handle spawn execution from server', async () => {
      const spawnData: SpawnData = {
        position: new Vector3(100, 200, 300),
        heading: 90,
        model: 'mp_m_freemode_01',
        skipFade: false,
      };

      await spawnService['onSpawnExecute'](spawnData);

      expect(spawnService.isCurrentlySpawning()).toBe(true);
      expect(spawnService.getCurrentSpawnData()).toEqual(spawnData);
      expect(mockPlatformAdapter.player.setPlayerModel).toHaveBeenCalledWith('mp_m_freemode_01');
      expect(mockPlatformAdapter.player.setEntityPosition).toHaveBeenCalled();
      expect(mockPlatformAdapter.player.setEntityHeading).toHaveBeenCalledWith(1, 90);

      expect(mockPlatformAdapter.core.fadeScreen).toHaveBeenCalledTimes(2);
    });

    it('should handle spawn execution with skipFade', async () => {
      const spawnData: SpawnData = {
        position: new Vector3(100, 200, 300),
        heading: 90,
        skipFade: true,
      };

      await spawnService['onSpawnExecute'](spawnData);

      expect(mockPlatformAdapter.core.fadeScreen).not.toHaveBeenCalled();
    });

    it('should handle spawn execution without model', async () => {
      const spawnData: SpawnData = {
        position: new Vector3(100, 200, 300),
        heading: 90,
      };

      await spawnService['onSpawnExecute'](spawnData);

      expect(mockPlatformAdapter.player.setPlayerModel).not.toHaveBeenCalled();
    });
  });

  describe('spawn failure', () => {
    beforeEach(async () => {
      await spawnService.init();
    });

    it('should handle spawn failure', () => {
      spawnService['isSpawning'] = true;
      spawnService['currentSpawnData'] = { position: new Vector3(0, 0, 0), heading: 0 };

      spawnService['onSpawnFailed']({ error: 'Test error' });

      expect(spawnService.isCurrentlySpawning()).toBe(false);
      expect(spawnService.getCurrentSpawnData()).toBeNull();
      expect(mockEventService.emitToServer).toHaveBeenCalledWith('spawn:failed', {
        error: 'Test error',
      });
    });
  });

  describe('player events', () => {
    beforeEach(async () => {
      await spawnService.init();
    });

    it('should handle player ready event', () => {
      spawnService['onPlayerReady']();

      expect(mockEventService.emitToServer).toHaveBeenCalledWith('player:ready');
    });

    it('should handle player spawned event', () => {
      spawnService['isSpawning'] = true;
      spawnService['currentSpawnData'] = { position: new Vector3(0, 0, 0), heading: 0 };

      spawnService['onPlayerSpawned']({
        playerId: '1',
        data: { position: new Vector3(0, 0, 0), heading: 0 },
      });

      expect(spawnService.isCurrentlySpawning()).toBe(false);
      expect(spawnService.getCurrentSpawnData()).toBeNull();
      expect(mockEventService.emitToServer).toHaveBeenCalledWith('player:spawned');
    });

    it('should handle first init completed event', () => {
      spawnService['onFirstInitCompleted'](undefined);

      expect(mockEventService.emitToServer).toHaveBeenCalledWith('player:firstInitCompleted');
    });
  });

  describe('callback management', () => {
    beforeEach(async () => {
      await spawnService.init();
    });

    it('should set and remove spawn callbacks', () => {
      const callback = jest.fn();

      spawnService.setSpawnCallback('test', callback);
      expect(spawnService['spawnCallbacks'].has('test')).toBe(true);

      spawnService.removeSpawnCallback('test');
      expect(spawnService['spawnCallbacks'].has('test')).toBe(false);
    });

    it('should clear all spawn callbacks', () => {
      spawnService.setSpawnCallback('test1', jest.fn());
      spawnService.setSpawnCallback('test2', jest.fn());

      expect(spawnService['spawnCallbacks'].size).toBe(2);

      spawnService.clearSpawnCallbacks();
      expect(spawnService['spawnCallbacks'].size).toBe(0);
    });
  });

  describe('force respawn', () => {
    beforeEach(async () => {
      await spawnService.init();
    });

    it('should force respawn at current position', async () => {
      await spawnService.forceRespawn();

      expect(mockEventService.emitToServer).toHaveBeenCalledWith('spawn:request', {
        spawnPointId: undefined,
      });
    });
  });

  describe('error handling', () => {
    beforeEach(async () => {
      await spawnService.init();
    });

    it('should handle spawn execution errors', async () => {
      const error = new Error('Platform error');
      (mockPlatformAdapter.player.setPlayerModel as jest.Mock).mockRejectedValue(error);

      const spawnData: SpawnData = {
        position: new Vector3(100, 200, 300),
        heading: 90,
        model: 'mp_m_freemode_01',
      };

      await spawnService['onSpawnExecute'](spawnData);

      expect(mockEventService.emitToServer).toHaveBeenCalledWith('spawn:failed', {
        error: 'Platform error',
      });
    });
  });

  describe('disposal', () => {
    it('should dispose correctly', () => {
      spawnService.setSpawnCallback('test', jest.fn());
      spawnService['isSpawning'] = true;
      spawnService['currentSpawnData'] = { position: new Vector3(0, 0, 0), heading: 0 };

      spawnService.dispose();

      expect(spawnService['spawnCallbacks'].size).toBe(0);
      expect(spawnService.isCurrentlySpawning()).toBe(false);
      expect(spawnService.getCurrentSpawnData()).toBeNull();
    });
  });
});
