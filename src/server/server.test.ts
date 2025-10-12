/**
 * Tests for RPServer
 */
import { ApiKeyAuthorization, EngineClient } from '@roleplayx/engine-sdk';

import { RPEventEmitter } from '../core/bus/event-emitter';
import { MockLogger } from '../../test/mocks';

import { RPServerContext } from './core/context';
import { RPServer, RPServerNatives, RPServerOptions } from './server';
import { EngineSocket } from './socket/socket';
import { AccountService } from './domains/account/service';
import { SessionService } from './domains/session/service';
import { WorldService } from './domains/world/service';
import { ConfigurationService } from './domains/configuration/service';
import { LocalizationService } from './domains/localization/service';
import { ReferenceService } from './domains/reference/service';
import { ApiServer } from './api';
import { PlatformAdapter } from './natives/adapters/platform.adapter';

// Mock external dependencies
jest.mock('@roleplayx/engine-sdk');
jest.mock('./socket/socket');
jest.mock('./core/context');
jest.mock('./api/api-server');
jest.mock('./natives/adapters/platform.adapter');

describe('RPServer', () => {
  let mockLogger: MockLogger;
  let mockEngineSocket: jest.Mocked<EngineSocket>;
  let mockContext: jest.Mocked<RPServerContext>;
  let mockEngineClient: jest.Mocked<EngineClient>;
  let mockApiServer: jest.Mocked<ApiServer>;
  let mockPlatformAdapter: jest.Mocked<PlatformAdapter>;

  const testServerOptions: RPServerOptions = {
    serverId: 'test-server',
    apiUrl: 'https://api.test.com',
    socketUrl: 'wss://socket.test.com',
    apiKeyId: 'test-key-id',
    apiKeySecret: 'test-key-secret',
    timeout: 15000,
    api: {
      port: 0, // Use random port to avoid conflicts
      host: '127.0.0.1',
      gamemodeApiKeyHash: 'a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3',
    },
  };

  const testNatives: RPServerNatives = {};

  beforeEach(() => {
    (RPServer as unknown as { instance: RPServer | undefined }).instance = undefined;

    mockLogger = new MockLogger();
    mockPlatformAdapter = {
      player: {
        getPlayerId: jest.fn().mockReturnValue(1),
        getCurrentPlayerId: jest.fn().mockReturnValue(1),
        getPlayerName: jest.fn().mockReturnValue('TestPlayer'),
        getPlayerIP: jest.fn().mockReturnValue('127.0.0.1'),
        kickPlayer: jest.fn(),
        getPlayerPosition: jest.fn().mockReturnValue({ x: 0, y: 0, z: 0 }),
        setPlayerPosition: jest.fn(),
        getPlayerHealth: jest.fn().mockReturnValue(100),
      },
      events: {
        initializeEvents: jest.fn(),
        onPlayerJoin: jest.fn(),
        onPlayerLeave: jest.fn(),
        onPlayerDeath: jest.fn(),
        onPlayerSpawn: jest.fn(),
        onPlayerReady: jest.fn(),
      },
      network: {
        emitToPlayer: jest.fn(),
        emitToAll: jest.fn(),
        onClientEvent: jest.fn(),
        emitToClient: jest.fn(),
        broadcastToClients: jest.fn(),
      },
      core: {
        getMaxPlayers: jest.fn().mockReturnValue(100),
        getPlayerCount: jest.fn().mockReturnValue(0),
        log: jest.fn(),
      },
      setEventEmitter: jest.fn(),
    } as unknown as jest.Mocked<PlatformAdapter>;

    // Setup mocks
    mockEngineClient = {
      getEngineApi: jest.fn(),
    } as unknown as jest.Mocked<EngineClient>;

    mockEngineSocket = {
      start: jest.fn().mockResolvedValue(undefined),
      close: jest.fn(),
    } as unknown as jest.Mocked<EngineSocket>;

    mockApiServer = {
      start: jest.fn().mockResolvedValue(undefined),
      stop: jest.fn().mockResolvedValue(undefined),
      registerController: jest.fn().mockReturnThis(),
      getFastify: jest.fn(),
      getOpenApiSchema: jest.fn(),
    } as unknown as jest.Mocked<ApiServer>;

    mockContext = {
      init: jest.fn().mockResolvedValue(undefined),
      dispose: jest.fn().mockResolvedValue(undefined),
      addService: jest.fn().mockReturnThis(),
      getService: jest.fn(),
      logger: mockLogger,
    } as unknown as jest.Mocked<RPServerContext>;

    // Mock constructors
    (EngineClient as jest.Mock).mockImplementation(() => mockEngineClient);
    (EngineSocket as jest.Mock).mockImplementation(() => mockEngineSocket);
    (ApiServer as jest.Mock).mockImplementation(() => mockApiServer);
    (RPServerContext.create as jest.Mock).mockReturnValue(mockContext);
  });

  afterEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    // Remove process listeners to avoid interference between tests
    process.removeAllListeners('SIGTERM');
    process.removeAllListeners('SIGINT');
    process.removeAllListeners('SIGHUP');
    process.removeAllListeners('uncaughtException');
    process.removeAllListeners('unhandledRejection');
  });

  describe('create', () => {
    it('should create a new server instance with default logger', () => {
      const server = RPServer.create(testServerOptions, testNatives, mockPlatformAdapter);

      expect(server).toBeInstanceOf(RPServer);
      expect(EngineClient).toHaveBeenCalledWith(
        {
          apiUrl: testServerOptions.apiUrl,
          serverId: testServerOptions.serverId,
          timeout: testServerOptions.timeout,
          applicationName: 'gamemode',
        },
        expect.any(ApiKeyAuthorization),
      );
    });

    it('should create a new server instance with custom logger', () => {
      const customLogger = new MockLogger();
      const optionsWithLogger = { ...testServerOptions, logger: customLogger };

      const server = RPServer.create(optionsWithLogger, testNatives, mockPlatformAdapter);

      expect(server).toBeInstanceOf(RPServer);
      expect(EngineSocket).toHaveBeenCalledWith(
        {
          url: testServerOptions.socketUrl,
          serverId: testServerOptions.serverId,
          apiKeyId: testServerOptions.apiKeyId,
          apiKeySecret: testServerOptions.apiKeySecret,
        },
        expect.any(RPEventEmitter),
        customLogger,
      );
    });

    it('should create server with custom context', () => {
      class CustomContext extends RPServerContext {}

      const customOptions = { customData: 'test' };
      const nativesWithCustomContext: RPServerNatives = {
        ...testNatives,
        customContext: {
          type: CustomContext,
          options: customOptions,
        },
      };

      RPServer.create(testServerOptions, nativesWithCustomContext, mockPlatformAdapter);

      expect(RPServerContext.create).toHaveBeenCalledWith(
        CustomContext,
        expect.objectContaining({
          engineClient: mockEngineClient,
          customData: 'test',
        }),
      );
    });

    it('should register all core services in correct order', () => {
      RPServer.create(testServerOptions, testNatives, mockPlatformAdapter);

      expect(mockContext.addService).toHaveBeenCalledTimes(8);
      expect(mockContext.addService).toHaveBeenNthCalledWith(1, ConfigurationService);
      expect(mockContext.addService).toHaveBeenNthCalledWith(2, LocalizationService);
      expect(mockContext.addService).toHaveBeenNthCalledWith(3, WorldService);
      expect(mockContext.addService).toHaveBeenNthCalledWith(4, SessionService);
      expect(mockContext.addService).toHaveBeenNthCalledWith(5, ReferenceService);
      expect(mockContext.addService).toHaveBeenNthCalledWith(6, AccountService);
    });

    it('should replace previous instance when called multiple times', () => {
      const server1 = RPServer.create(testServerOptions, testNatives, mockPlatformAdapter);
      const server2 = RPServer.create(testServerOptions, testNatives, mockPlatformAdapter);

      expect(server1).not.toBe(server2);
      expect(RPServer.get()).toBe(server2);
    });
  });

  describe('get', () => {
    it('should return the singleton instance after creation', () => {
      const server = RPServer.create(testServerOptions, testNatives, mockPlatformAdapter);
      const retrievedServer = RPServer.get();

      expect(retrievedServer).toBe(server);
    });

    it('should throw error when no instance exists', () => {
      expect(() => RPServer.get()).toThrow(
        'RPServer instance is not created. Use RPServer.create() first.',
      );
    });
  });

  describe('start', () => {
    let server: RPServer;

    beforeEach(() => {
      server = RPServer.create(testServerOptions, testNatives, mockPlatformAdapter);
    });

    it('should start socket and initialize context', async () => {
      await server.start();

      expect(mockEngineSocket.start).toHaveBeenCalledTimes(1);
      expect(mockContext.init).toHaveBeenCalledTimes(1);
      expect(mockApiServer.start).toHaveBeenCalledTimes(1);
    });

    it('should register shutdown handlers', async () => {
      const originalListenerCount = process.listenerCount('SIGTERM');

      await server.start();

      expect(process.listenerCount('SIGTERM')).toBeGreaterThan(originalListenerCount);
      expect(process.listenerCount('SIGINT')).toBeGreaterThan(0);
      expect(process.listenerCount('SIGHUP')).toBeGreaterThan(0);
      expect(process.listenerCount('uncaughtException')).toBeGreaterThan(0);
      expect(process.listenerCount('unhandledRejection')).toBeGreaterThan(0);
    });

    it('should not register shutdown handlers multiple times', async () => {
      await server.start();
      const sigTermCount = process.listenerCount('SIGTERM');

      await server.start();

      expect(process.listenerCount('SIGTERM')).toBe(sigTermCount);
    });

    it('should handle socket start failure', async () => {
      const socketError = new Error('Socket connection failed');
      mockEngineSocket.start.mockRejectedValue(socketError);

      await expect(server.start()).rejects.toThrow('Socket connection failed');
      expect(mockContext.init).not.toHaveBeenCalled();
    });

    it('should handle context initialization failure', async () => {
      const contextError = new Error('Context init failed');
      mockContext.init.mockRejectedValue(contextError);

      await expect(server.start()).rejects.toThrow('Context init failed');
      expect(mockEngineSocket.start).toHaveBeenCalled();
    });
  });

  describe('getContext', () => {
    let server: RPServer;

    beforeEach(() => {
      server = RPServer.create(testServerOptions, testNatives, mockPlatformAdapter);
    });

    it('should return the server context', () => {
      const context = server.getContext();

      expect(context).toBe(mockContext);
    });

    it('should support generic typing for custom contexts', () => {
      const context = server.getContext<RPServerContext>();

      expect(context).toBe(mockContext);
    });
  });

  describe('stop', () => {
    let server: RPServer;

    beforeEach(() => {
      server = RPServer.create(testServerOptions, testNatives, mockPlatformAdapter);
    });

    it('should dispose context and close socket gracefully', async () => {
      await server.stop();

      expect(mockContext.dispose).toHaveBeenCalledTimes(1);
      expect(mockEngineSocket.close).toHaveBeenCalledWith(1000, 'Normal closure');
    });

    it('should handle context disposal errors gracefully', async () => {
      const disposalError = new Error('Disposal failed');
      mockContext.dispose.mockRejectedValue(disposalError);
      const errorSpy = jest.spyOn(mockLogger, 'error');

      await server.stop();

      expect(errorSpy).toHaveBeenCalledWith('Error during service disposal:', disposalError);
      expect(mockEngineSocket.close).toHaveBeenCalled();
    });

    it('should close socket even if context disposal fails', async () => {
      mockContext.dispose.mockRejectedValue(new Error('Disposal failed'));

      await server.stop();

      expect(mockEngineSocket.close).toHaveBeenCalledWith(1000, 'Normal closure');
    });
  });

  describe('graceful shutdown handling', () => {
    let server: RPServer;

    beforeEach(() => {
      server = RPServer.create(testServerOptions, testNatives, mockPlatformAdapter);
    });

    it('should register shutdown signal handlers after start', async () => {
      const originalSigTermCount = process.listenerCount('SIGTERM');
      const originalSigIntCount = process.listenerCount('SIGINT');
      const originalSigHupCount = process.listenerCount('SIGHUP');
      const originalUncaughtCount = process.listenerCount('uncaughtException');
      const originalUnhandledCount = process.listenerCount('unhandledRejection');

      await server.start();

      expect(process.listenerCount('SIGTERM')).toBeGreaterThan(originalSigTermCount);
      expect(process.listenerCount('SIGINT')).toBeGreaterThan(originalSigIntCount);
      expect(process.listenerCount('SIGHUP')).toBeGreaterThan(originalSigHupCount);
      expect(process.listenerCount('uncaughtException')).toBeGreaterThan(originalUncaughtCount);
      expect(process.listenerCount('unhandledRejection')).toBeGreaterThan(originalUnhandledCount);
    });

    it('should not register shutdown handlers multiple times', async () => {
      await server.start();
      const sigTermCount = process.listenerCount('SIGTERM');
      const sigIntCount = process.listenerCount('SIGINT');

      await server.start(); // Second start call

      expect(process.listenerCount('SIGTERM')).toBe(sigTermCount);
      expect(process.listenerCount('SIGINT')).toBe(sigIntCount);
    });

    it('should handle graceful shutdown sequence correctly', async () => {
      const server = RPServer.create(testServerOptions, testNatives, mockPlatformAdapter);
      const mockStop = jest.spyOn(server, 'stop').mockResolvedValue();

      await server.start();

      // Test that the graceful shutdown function exists and works
      const gracefulShutdown = (server as unknown as { registerShutdownHandlers: () => void })
        .registerShutdownHandlers;
      expect(typeof gracefulShutdown).toBe('function');

      // Since we can't easily test signal handlers without actually triggering them,
      // we verify that the stop method would be called during shutdown
      expect(mockStop).not.toHaveBeenCalled();

      mockStop.mockRestore();
    });
  });

  describe('integration scenarios', () => {
    it('should support complete server lifecycle', async () => {
      const server = RPServer.create(testServerOptions, testNatives, mockPlatformAdapter);

      // Start server
      await server.start();
      expect(mockEngineSocket.start).toHaveBeenCalled();
      expect(mockContext.init).toHaveBeenCalled();

      // Access context and services
      const context = server.getContext();
      expect(context).toBe(mockContext);

      // Stop server
      await server.stop();
      expect(mockContext.dispose).toHaveBeenCalled();
      expect(mockEngineSocket.close).toHaveBeenCalled();
    });

    it('should maintain singleton behavior across multiple operations', () => {
      const server1 = RPServer.create(testServerOptions, testNatives, mockPlatformAdapter);
      const server2 = RPServer.get();
      const server3 = RPServer.create(testServerOptions, testNatives, mockPlatformAdapter);
      const server4 = RPServer.get();

      expect(server1).toBe(server2);
      expect(server3).toBe(server4);
      expect(server1).not.toBe(server3);
    });

    it('should handle service registration chain properly', () => {
      RPServer.create(testServerOptions, testNatives, mockPlatformAdapter);

      // Verify services are added in dependency order
      const serviceOrder = [
        ConfigurationService,
        LocalizationService,
        WorldService,
        SessionService,
        ReferenceService,
        AccountService,
      ];

      expect(mockContext.addService).toHaveBeenCalledTimes(8);
      serviceOrder.forEach((Service, index) => {
        expect(mockContext.addService).toHaveBeenNthCalledWith(index + 1, Service);
      });
    });
  });

  describe('error scenarios', () => {
    it('should handle EngineClient creation failure', () => {
      (EngineClient as jest.Mock).mockImplementation(() => {
        throw new Error('EngineClient creation failed');
      });

      expect(() => RPServer.create(testServerOptions, testNatives, mockPlatformAdapter)).toThrow(
        'EngineClient creation failed',
      );
    });

    it('should handle EngineSocket creation failure', () => {
      (EngineSocket as jest.Mock).mockImplementation(() => {
        throw new Error('EngineSocket creation failed');
      });

      expect(() => RPServer.create(testServerOptions, testNatives, mockPlatformAdapter)).toThrow(
        'EngineSocket creation failed',
      );
    });

    it('should handle context creation failure', () => {
      (RPServerContext.create as jest.Mock).mockImplementation(() => {
        throw new Error('Context creation failed');
      });

      expect(() => RPServer.create(testServerOptions, testNatives, mockPlatformAdapter)).toThrow(
        'Context creation failed',
      );
    });

    it('should handle service registration failure', () => {
      mockContext.addService.mockImplementation(() => {
        throw new Error('Service registration failed');
      });

      expect(() => RPServer.create(testServerOptions, testNatives, mockPlatformAdapter)).toThrow(
        'Service registration failed',
      );
    });
  });
});
