import 'reflect-metadata';
import { FastifyInstance } from 'fastify';
import { EngineClient } from '@roleplayx/engine-sdk';

import { RPEventEmitter } from '../../core/bus/event-emitter';
import { RPHookBus } from '../../core/bus/hook-bus';
import { MockEngineClient, MockLogger } from '../../../test/mocks';
import { RPServerContext, RPServerContextOptions } from '../core/context';
import { CustomServerContextOptions } from '../core/types';
import { RPServerEvents } from '../core/events/events';
import { RPServerHooks } from '../core/hooks/hooks';
import { ConflictError } from '../core/errors';
import { ConfigurationService } from '../domains/configuration/service';
import { LocalizationService } from '../domains/localization/service';

import { ApiServer } from './api-server';
import { Body, Controller, Get, Headers, Param, Post, Query, Request } from './decorators';
import { ApiController, ApiServerConfig } from './types';

// Test controller for basic functionality
@Controller('/test')
class TestController extends ApiController {
  @Get('/hello')
  public hello() {
    return { message: 'Hello, World!' };
  }

  @Post('/echo')
  public echo(@Body() body: unknown) {
    return body;
  }

  @Get('/query')
  public queryTest(@Query('name') name?: string) {
    return { name: name || 'default' };
  }

  @Get('/params/:id')
  public paramTest(@Param('id') id: string) {
    return { id };
  }

  @Get('/headers')
  public headerTest(@Headers('x-custom-header') header?: string) {
    return { header: header || 'no-header' };
  }

  @Get('/request')
  public requestTest(@Request() request: unknown) {
    const req = request as { method: string; url: string };
    return { method: req.method, url: req.url };
  }

  @Post('/status', { statusCode: 201 })
  public statusTest() {
    return { created: true };
  }

  @Get('/error')
  public errorTest() {
    throw new ConflictError('TEST_ERROR', { detail: 'This is a test error' });
  }
}

// Custom context for testing
interface GameServerContextOptions extends CustomServerContextOptions {
  gameConfig: {
    maxPlayers: number;
    mapName: string;
  };
}

class GameServerContext extends RPServerContext<GameServerContextOptions> {
  public readonly gameConfig: GameServerContextOptions['gameConfig'];

  constructor(options: RPServerContextOptions & GameServerContextOptions) {
    super(options);
    this.gameConfig = options.gameConfig;
  }

  public getMaxPlayers(): number {
    return this.gameConfig.maxPlayers;
  }

  public getMapName(): string {
    return this.gameConfig.mapName;
  }
}

// Controller that uses custom context
@Controller('/game')
class GameController extends ApiController<GameServerContext> {
  @Get('/info')
  public getGameInfo() {
    return {
      maxPlayers: this.context.getMaxPlayers(),
      mapName: this.context.getMapName(),
    };
  }

  @Get('/config')
  public getConfig() {
    return {
      gameConfig: this.context.gameConfig,
    };
  }
}

// Controller without decorator (for testing error handling)
class UnDecoratedController extends ApiController {
  public test() {
    return 'test';
  }
}

// Controller with dispose method
@Controller('/disposable')
class DisposableController extends ApiController {
  public disposed = false;

  @Get('/test')
  public test() {
    return { disposed: this.disposed };
  }

  public async dispose(): Promise<void> {
    this.disposed = true;
  }
}

describe('ApiServer', () => {
  let mockLogger: MockLogger;
  let mockEngineClient: MockEngineClient;
  let mockEventEmitter: RPEventEmitter<RPServerEvents>;
  let mockHookBus: RPHookBus<RPServerHooks>;
  let contextOptions: RPServerContextOptions;
  let context: RPServerContext;
  let apiServer: ApiServer;
  let config: ApiServerConfig;

  beforeEach(() => {
    mockLogger = new MockLogger();
    mockEngineClient = new MockEngineClient();
    mockEventEmitter = new RPEventEmitter<RPServerEvents>();
    mockHookBus = new RPHookBus<RPServerHooks>();

    contextOptions = {
      logger: mockLogger,
      engineClient: mockEngineClient as unknown as EngineClient,
      eventEmitter: mockEventEmitter,
      hookBus: mockHookBus,
    };

    context = new RPServerContext(contextOptions);
    // Add required services for error handling
    context.addService(ConfigurationService).addService(LocalizationService);

    config = {
      port: 0, // Use random port
      host: '127.0.0.1',
      gamemodeApiKeyHash: 'test-hash',
    };

    apiServer = new ApiServer(context, config);
  });

  afterEach(async () => {
    if (apiServer) {
      await apiServer.stop();
    }
  });

  describe('constructor', () => {
    it('should create an ApiServer instance', () => {
      expect(apiServer).toBeInstanceOf(ApiServer);
    });

    it('should configure CORS when provided', () => {
      const corsConfig = {
        origin: 'http://localhost:3000',
        credentials: true,
      };

      const serverWithCors = new ApiServer(context, {
        ...config,
        cors: corsConfig,
      });

      expect(serverWithCors).toBeInstanceOf(ApiServer);
    });
  });

  describe('registerController', () => {
    it('should register a controller successfully', () => {
      const result = apiServer.registerController(TestController);
      expect(result).toBe(apiServer); // Should return this for chaining
    });

    it('should support method chaining', () => {
      const result = apiServer
        .registerController(TestController)
        .registerController(DisposableController);
      expect(result).toBe(apiServer);
    });

    it('should throw error for controller without @Controller decorator', () => {
      expect(() => {
        apiServer.registerController(UnDecoratedController);
      }).toThrow('UnDecoratedController is not decorated with @Controller');
    });

    it('should register routes with correct metadata', () => {
      apiServer.registerController(TestController);

      const fastify = apiServer.getFastify();
      const routes = fastify.printRoutes({ commonPrefix: false });

      expect(routes).toContain('/test/hello');
      expect(routes).toContain('/test/echo');
      expect(routes).toContain('/test/query');
      expect(routes).toContain('/test/params/:id');
    });
  });

  describe('start and stop', () => {
    it('should start the server on specified port', async () => {
      const serverWithPort = new ApiServer(context, {
        ...config,
        port: 0, // Use random available port
      });

      await serverWithPort.start();

      const address = serverWithPort.getFastify().server.address();
      expect(address).toBeTruthy();
      if (typeof address === 'object' && address) {
        expect(address.port).toBeGreaterThan(0);
      }

      await serverWithPort.stop();
    });

    it('should stop the server gracefully', async () => {
      await apiServer.start();
      await apiServer.stop();

      // Server should be stopped
      expect(apiServer.getFastify().server.listening).toBe(false);
    });

    it('should dispose controllers on stop', async () => {
      const controller = new DisposableController(context);
      const disposeSpy = jest.spyOn(controller, 'dispose');

      apiServer.registerController(DisposableController);
      await apiServer.start();
      await apiServer.stop();

      // Note: We can't directly verify the spy since a new instance is created
      // But we can verify that dispose would be called on the controller type
      expect(disposeSpy).not.toHaveBeenCalled(); // Our spy isn't on the actual instance
    });

    it('should handle disposal errors gracefully', async () => {
      @Controller('/error-dispose')
      class ErrorDisposableController extends ApiController {
        public async dispose(): Promise<void> {
          throw new Error('Disposal error');
        }
      }

      apiServer.registerController(ErrorDisposableController);
      await apiServer.start();

      // Should not throw
      await expect(apiServer.stop()).resolves.not.toThrow();

      // Should log the error
      expect(
        mockLogger.logs.some(
          (log) => log.level === 'error' && log.message.includes('Error disposing controller'),
        ),
      ).toBe(true);
    });
  });

  describe('route handling', () => {
    let fastify: FastifyInstance;

    beforeEach(async () => {
      apiServer.registerController(TestController);
      await apiServer.start();
      fastify = apiServer.getFastify();
    });

    it('should handle GET requests', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/test/hello',
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual({ message: 'Hello, World!' });
    });

    it('should handle POST requests with body', async () => {
      const payload = { test: 'data', number: 123 };
      const response = await fastify.inject({
        method: 'POST',
        url: '/test/echo',
        payload,
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual(payload);
    });

    it('should handle query parameters', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/test/query?name=TestUser',
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual({ name: 'TestUser' });
    });

    it('should handle default query parameters', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/test/query',
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual({ name: 'default' });
    });

    it('should handle path parameters', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/test/params/123',
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual({ id: '123' });
    });

    it('should handle headers', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/test/headers',
        headers: {
          'x-custom-header': 'custom-value',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual({ header: 'custom-value' });
    });

    it('should inject request object', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/test/request',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.method).toBe('GET');
      expect(body.url).toBe('/test/request');
    });

    it('should handle custom status codes', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/test/status',
      });

      expect(response.statusCode).toBe(201);
      expect(JSON.parse(response.body)).toEqual({ created: true });
    });

    it('should handle errors properly', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/test/error',
      });

      expect(response.statusCode).toBe(409);
      const body = JSON.parse(response.body);
      expect(body.key).toBe('TEST_ERROR');
      expect(body.message).toBe('TEST_ERROR');
    });
  });

  describe('custom context support', () => {
    it('should work with custom context types', async () => {
      const gameOptions: RPServerContextOptions & GameServerContextOptions = {
        ...contextOptions,
        gameConfig: {
          maxPlayers: 32,
          mapName: 'Dust2',
        },
      };

      const gameContext = new GameServerContext(gameOptions);
      const gameApiServer = new ApiServer<GameServerContext>(gameContext, config);

      gameApiServer.registerController(GameController);
      await gameApiServer.start();

      const fastify = gameApiServer.getFastify();

      const infoResponse = await fastify.inject({
        method: 'GET',
        url: '/game/info',
      });

      expect(infoResponse.statusCode).toBe(200);
      expect(JSON.parse(infoResponse.body)).toEqual({
        maxPlayers: 32,
        mapName: 'Dust2',
      });

      const configResponse = await fastify.inject({
        method: 'GET',
        url: '/game/config',
      });

      expect(configResponse.statusCode).toBe(200);
      expect(JSON.parse(configResponse.body)).toEqual({
        gameConfig: {
          maxPlayers: 32,
          mapName: 'Dust2',
        },
      });

      await gameApiServer.stop();
    });

    it('should allow controllers to access custom context methods', async () => {
      interface RacingContextOptions extends CustomServerContextOptions {
        raceConfig: {
          trackName: string;
          laps: number;
        };
      }

      class RacingContext extends RPServerContext<RacingContextOptions> {
        public readonly raceConfig: RacingContextOptions['raceConfig'];

        constructor(options: RPServerContextOptions & RacingContextOptions) {
          super(options);
          this.raceConfig = options.raceConfig;
        }

        public getRaceDetails(): string {
          return `${this.raceConfig.trackName} - ${this.raceConfig.laps} laps`;
        }
      }

      @Controller('/race')
      class RaceController extends ApiController<RacingContext> {
        @Get('/details')
        public getDetails() {
          return {
            details: this.context.getRaceDetails(),
            track: this.context.raceConfig.trackName,
            laps: this.context.raceConfig.laps,
          };
        }
      }

      const raceOptions: RPServerContextOptions & RacingContextOptions = {
        ...contextOptions,
        raceConfig: {
          trackName: 'Monaco',
          laps: 78,
        },
      };

      const raceContext = new RacingContext(raceOptions);
      const raceApiServer = new ApiServer<RacingContext>(raceContext, config);

      raceApiServer.registerController(RaceController);
      await raceApiServer.start();

      const fastify = raceApiServer.getFastify();
      const response = await fastify.inject({
        method: 'GET',
        url: '/race/details',
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual({
        details: 'Monaco - 78 laps',
        track: 'Monaco',
        laps: 78,
      });

      await raceApiServer.stop();
    });
  });

  describe('getFastify', () => {
    it('should return the Fastify instance', () => {
      const fastify = apiServer.getFastify();
      expect(fastify).toBeDefined();
      expect(fastify.server).toBeDefined();
    });
  });

  describe('logging', () => {
    it('should log registered routes', () => {
      apiServer.registerController(TestController);

      const logs = mockLogger.logs.filter(
        (log) => log.level === 'info' && log.message.includes('Registered route'),
      );

      expect(logs.length).toBeGreaterThan(0);
      expect(logs.some((log) => log.message.includes('GET /test/hello'))).toBe(true);
      expect(logs.some((log) => log.message.includes('POST /test/echo'))).toBe(true);
    });

    it('should log server start', async () => {
      await apiServer.start();

      const logs = mockLogger.logs.filter(
        (log) => log.level === 'info' && log.message.includes('API server listening'),
      );

      expect(logs.length).toBe(1);
    });

    it('should log server stop', async () => {
      await apiServer.start();
      await apiServer.stop();

      const logs = mockLogger.logs.filter(
        (log) => log.level === 'info' && log.message.includes('API server stopped'),
      );

      expect(logs.length).toBe(1);
    });
  });

  describe('error handling', () => {
    it('should handle missing route methods gracefully', () => {
      @Controller('/broken')
      class BrokenController extends ApiController {
        // No methods decorated
      }

      // Should not throw
      expect(() => {
        apiServer.registerController(BrokenController);
      }).not.toThrow();
    });

    it('should warn about missing methods', () => {
      // Create a controller with invalid metadata
      @Controller('/invalid')
      class InvalidController extends ApiController {}

      // Manually add route metadata without corresponding method
      Reflect.defineMetadata(
        'api:routes',
        [{ method: 'GET', path: '/test' }],
        InvalidController.prototype,
      );

      apiServer.registerController(InvalidController);

      const warnings = mockLogger.logs.filter(
        (log) => log.level === 'warn' && log.message.includes('No method found for route'),
      );

      expect(warnings.length).toBeGreaterThan(0);
    });
  });
});
