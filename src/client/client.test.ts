/**
 * Tests for RPClient
 */
import { MockLogger } from '../../test/mocks';

import { RPClientContext } from './core/context';
import { RPClient, RPClientOptions } from './core/client';
import { EventService } from './domains/event/service';
import { PlayerService } from './domains/player/service';
import { HealthService } from './domains/health/service';
import { SpawnService } from './domains/spawn/service';
import { CameraService } from './domains/camera/service';
import { ClientPlatformAdapter } from './natives/adapters/platform.adapter';

jest.mock('./core/context');
jest.mock('./domains/event/service');
jest.mock('./domains/player/service');
jest.mock('./domains/health/service');
jest.mock('./domains/spawn/service');
jest.mock('./domains/camera/service');

describe('RPClient', () => {
  let mockLogger: MockLogger;
  let mockContext: jest.Mocked<RPClientContext>;
  let mockEventService: jest.Mocked<EventService>;
  let mockPlayerService: jest.Mocked<PlayerService>;
  let mockPlatformAdapter: jest.Mocked<ClientPlatformAdapter>;

  const testClientOptions: RPClientOptions = {
    clientId: 'test-client',
    logger: new MockLogger(),
  };

  const testNatives = {};

  beforeEach(() => {
    (RPClient as unknown as { instance: RPClient | undefined }).instance = undefined;

    mockLogger = new MockLogger();
    mockPlatformAdapter = {
      core: {
        wait: jest.fn().mockResolvedValue(undefined),
        getGameTimer: jest.fn().mockReturnValue(1000),
        getHashKey: jest.fn().mockReturnValue(12345),
        requestCollision: jest.fn(),
        hasCollisionLoadedAroundEntity: jest.fn().mockReturnValue(true),
        requestModel: jest.fn().mockResolvedValue(undefined),
        setModelAsNoLongerNeeded: jest.fn(),
        fadeScreen: jest.fn().mockResolvedValue(undefined),
        isScreenFaded: jest.fn().mockReturnValue(false),
        shutdownLoadingScreen: jest.fn(),
        isGameplayCamRendering: jest.fn().mockReturnValue(true),
      },
      player: {
        getPlayerId: jest.fn().mockReturnValue('player_123'),
        getPlayerPed: jest.fn().mockReturnValue(1),
        getRemotePlayerPed: jest.fn().mockReturnValue(2),
        setPlayerModel: jest.fn().mockResolvedValue(undefined),
        setPlayerControl: jest.fn(),
        setPlayerInvincible: jest.fn(),
        clearPlayerTasks: jest.fn(),
        clearPlayerWeapons: jest.fn(),
        clearPlayerWantedLevel: jest.fn(),
        doesEntityExist: jest.fn().mockReturnValue(true),
        getPlayerHealth: jest.fn().mockReturnValue(100),
        setPlayerHealth: jest.fn(),
        isPlayerDead: jest.fn().mockReturnValue(false),
        setEntityPosition: jest.fn(),
        setEntityHeading: jest.fn(),
        setEntityVisible: jest.fn(),
        setEntityCollision: jest.fn(),
        freezeEntityPosition: jest.fn(),
        getEntityCoords: jest.fn().mockReturnValue({ x: 0, y: 0, z: 0 }),
        isEntityVisible: jest.fn().mockReturnValue(true),
        isEntityDead: jest.fn().mockReturnValue(false),
        isEntityPositionFrozen: jest.fn().mockReturnValue(false),
        getPlayerFromServerId: jest.fn().mockReturnValue(1),
        resurrectLocalPlayer: jest.fn(),
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
        createCamera: jest.fn().mockReturnValue(1),
        destroyCamera: jest.fn(),
        setCameraActive: jest.fn(),
        renderScriptCameras: jest.fn(),
        setCameraCoord: jest.fn(),
        setCameraRotation: jest.fn(),
        setCameraFov: jest.fn(),
        pointCameraAtCoord: jest.fn(),
        pointCameraAtEntity: jest.fn(),
        attachCameraToEntity: jest.fn(),
        detachCamera: jest.fn(),
        isCameraActive: jest.fn().mockReturnValue(true),
        getCameraCoord: jest.fn().mockReturnValue({ x: 0, y: 0, z: 0 }),
        getCameraRotation: jest.fn().mockReturnValue({ x: 0, y: 0, z: 0 }),
        getCameraFov: jest.fn().mockReturnValue(50),
        displayHud: jest.fn(),
        displayRadar: jest.fn(),
        isHudHidden: jest.fn().mockReturnValue(false),
      },
    } as unknown as jest.Mocked<ClientPlatformAdapter>;

    mockEventService = {
      onServerEvent: jest.fn(),
      offServerEvent: jest.fn(),
      onGameEvent: jest.fn(),
      offGameEvent: jest.fn(),
      mapPlatformEvent: jest.fn(),
      unmapPlatformEvent: jest.fn(),
      getMappedGameEvent: jest.fn().mockReturnValue(null),
      emitToServer: jest.fn(),
      on: jest.fn(),
      off: jest.fn(),
      once: jest.fn(),
      emit: jest.fn(),
      removeAllListeners: jest.fn(),
      listenerCount: jest.fn().mockReturnValue(0),
    } as unknown as jest.Mocked<EventService>;

    mockPlayerService = {
      onPlayerSpawn: jest.fn(),
      onPlayerDeath: jest.fn(),
      onEntityDamage: jest.fn(),
      onVehicleEntered: jest.fn(),
      onVehicleExited: jest.fn(),
    } as unknown as jest.Mocked<PlayerService>;

    mockContext = {
      init: jest.fn().mockResolvedValue(undefined),
      dispose: jest.fn().mockResolvedValue(undefined),
      addService: jest.fn().mockReturnThis(),
      getService: jest.fn(),
      logger: mockLogger,
      platformAdapter: mockPlatformAdapter,
    } as unknown as jest.Mocked<RPClientContext>;

    (EventService as jest.Mock).mockImplementation(() => mockEventService);
    (PlayerService as jest.Mock).mockImplementation(() => mockPlayerService);
    (RPClientContext.create as jest.Mock).mockImplementation((ctor, options) => {
      return mockContext;
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
    process.removeAllListeners('SIGTERM');
    process.removeAllListeners('SIGINT');
    process.removeAllListeners('SIGHUP');
    process.removeAllListeners('uncaughtException');
    process.removeAllListeners('unhandledRejection');
  });

  describe('create', () => {
    it('should create a new client instance with default logger', () => {
      const client = RPClient.create(testClientOptions, testNatives, mockPlatformAdapter);

      expect(client).toBeInstanceOf(RPClient);
      expect(RPClientContext.create).toHaveBeenCalledWith(
        RPClientContext,
        expect.objectContaining({
          clientId: testClientOptions.clientId,
          platformAdapter: mockPlatformAdapter,
        }),
      );
    });

    it('should create a new client instance with custom logger', () => {
      const customLogger = new MockLogger();
      const optionsWithLogger = { ...testClientOptions, logger: customLogger };

      const client = RPClient.create(optionsWithLogger, testNatives, mockPlatformAdapter);

      expect(client).toBeInstanceOf(RPClient);
      expect(RPClientContext.create).toHaveBeenCalledWith(
        RPClientContext,
        expect.objectContaining({
          clientId: testClientOptions.clientId,
          platformAdapter: mockPlatformAdapter,
          logger: customLogger,
        }),
      );
    });

    it('should register all core services in correct order', () => {
      RPClient.create(testClientOptions, testNatives, mockPlatformAdapter);

      expect(mockContext.addService).toHaveBeenCalledTimes(6);
      expect(mockContext.addService).toHaveBeenNthCalledWith(1, EventService);
      expect(mockContext.addService).toHaveBeenNthCalledWith(2, PlayerService);
      expect(mockContext.addService).toHaveBeenNthCalledWith(3, HealthService);
      expect(mockContext.addService).toHaveBeenNthCalledWith(4, SpawnService);
      expect(mockContext.addService).toHaveBeenNthCalledWith(5, CameraService);
    });

    it('should replace previous instance when called multiple times', () => {
      const client1 = RPClient.create(testClientOptions, testNatives, mockPlatformAdapter);
      const client2 = RPClient.create(testClientOptions, testNatives, mockPlatformAdapter);

      expect(client1).not.toBe(client2);
      expect(RPClient.get()).toBe(client2);
    });
  });

  describe('get', () => {
    it('should return the singleton instance after creation', () => {
      const client = RPClient.create(testClientOptions, testNatives, mockPlatformAdapter);
      const retrievedClient = RPClient.get();

      expect(retrievedClient).toBe(client);
    });

    it('should throw error when no instance exists', () => {
      expect(() => RPClient.get()).toThrow(
        'RPClient instance is not created. Use RPClient.create() first.',
      );
    });
  });

  describe('start', () => {
    let client: RPClient;

    beforeEach(() => {
      client = RPClient.create(testClientOptions, testNatives, mockPlatformAdapter);
    });

    it('should initialize context', async () => {
      await client.start();

      expect(mockContext.init).toHaveBeenCalledTimes(1);
    });

    it('should handle context initialization failure', async () => {
      const contextError = new Error('Context init failed');
      mockContext.init.mockRejectedValue(contextError);

      await expect(client.start()).rejects.toThrow('Context init failed');
    });
  });

  describe('getContext', () => {
    let client: RPClient;

    beforeEach(() => {
      client = RPClient.create(testClientOptions, testNatives, mockPlatformAdapter);
    });

    it('should return the client context', () => {
      const context = client.getContext();

      expect(context).toBe(mockContext);
    });

    it('should support generic typing for custom contexts', () => {
      const context = client.getContext();

      expect(context).toBe(mockContext);
    });
  });

  describe('stop', () => {
    let client: RPClient;

    beforeEach(() => {
      client = RPClient.create(testClientOptions, testNatives, mockPlatformAdapter);
    });

    it('should dispose context gracefully', async () => {
      await client.stop();

      expect(mockContext.dispose).toHaveBeenCalledTimes(1);
    });

    it('should handle context disposal errors gracefully', async () => {
      const disposalError = new Error('Disposal failed');
      mockContext.dispose.mockRejectedValue(disposalError);

      await expect(client.stop()).rejects.toThrow('Disposal failed');
    });
  });

  describe('integration scenarios', () => {
    it('should support complete client lifecycle', async () => {
      const client = RPClient.create(testClientOptions, testNatives, mockPlatformAdapter);

      await client.start();
      expect(mockContext.init).toHaveBeenCalled();

      const context = client.getContext();
      expect(context).toBe(mockContext);
      await client.stop();
      expect(mockContext.dispose).toHaveBeenCalled();
    });

    it('should maintain singleton behavior across multiple operations', () => {
      const client1 = RPClient.create(testClientOptions, testNatives, mockPlatformAdapter);
      const client2 = RPClient.get();
      const client3 = RPClient.create(testClientOptions, testNatives, mockPlatformAdapter);
      const client4 = RPClient.get();

      expect(client1).toBe(client2);
      expect(client3).toBe(client4);
      expect(client1).not.toBe(client3);
    });

    it('should handle service registration chain properly', () => {
      RPClient.create(testClientOptions, testNatives, mockPlatformAdapter);

      const serviceOrder = [
        EventService,
        PlayerService,
        HealthService,
        SpawnService,
        CameraService,
      ];

      expect(mockContext.addService).toHaveBeenCalledTimes(6);
      serviceOrder.forEach((Service, index) => {
        expect(mockContext.addService).toHaveBeenNthCalledWith(index + 1, Service);
      });
    });
  });

  describe('error scenarios', () => {
    it('should handle context creation failure', () => {
      (RPClientContext.create as jest.Mock).mockImplementation(() => {
        throw new Error('Context creation failed');
      });

      expect(() => RPClient.create(testClientOptions, testNatives, mockPlatformAdapter)).toThrow(
        'Context creation failed',
      );
    });

    it('should handle service registration failure', () => {
      mockContext.addService.mockImplementation(() => {
        throw new Error('Service registration failed');
      });

      expect(() => RPClient.create(testClientOptions, testNatives, mockPlatformAdapter)).toThrow(
        'Service registration failed',
      );
    });
  });
});
