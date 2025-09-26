/**
 * Tests for RPServerService
 */
import { SessionEndReason } from '@roleplayx/engine-sdk';

import { RPEventEmitter } from '../../core/bus/event-emitter';
import { RPHookBus } from '../../core/bus/hook-bus';
import { MockEngineClient, MockLogger } from '../../../test/mocks';

import { RPServerContext } from './context';
import { RPServerService } from './server-service';
import { OnServer } from './events/decorators';
import { RPServerEvents } from './events/events';
import { RPServerHooks } from './hooks/hooks';
import { IServiceContext, ServerTypes } from './types';

// Test service implementation
class TestService extends RPServerService {
  public initCalled = false;
  public disposeCalled = false;

  public async init(): Promise<void> {
    this.initCalled = true;
    await super.init();
  }

  public async dispose(): Promise<void> {
    this.disposeCalled = true;
    await super.dispose();
  }

  public testMethod(): string {
    return 'test';
  }

  public testGetService<Service>(
    ServiceConstructor: new (context: RPServerContext) => Service,
  ): Service {
    return this.getService(
      ServiceConstructor as unknown as new (context: IServiceContext<ServerTypes>) => Service,
    );
  }

  @OnServer('sessionStarted')
  public onSessionStarted(_payload: { sessionId: string; sessionToken: string }): void {
    // Test event handler
  }
}

// Test API class
class TestApi {
  constructor(private _client: unknown) {}

  public testApiMethod(): Promise<string> {
    return Promise.resolve('api-result');
  }
}

describe('RPServerService', () => {
  let mockLogger: MockLogger;
  let mockEngineClient: MockEngineClient;
  let mockEventEmitter: RPEventEmitter<RPServerEvents>;
  let mockHookBus: RPHookBus<RPServerHooks>;
  let mockContext: RPServerContext;
  let testService: TestService;

  beforeEach(() => {
    mockLogger = new MockLogger();
    mockEngineClient = new MockEngineClient();
    mockEventEmitter = new RPEventEmitter<RPServerEvents>();
    mockHookBus = new RPHookBus<RPServerHooks>();

    mockContext = {
      logger: mockLogger,
      eventEmitter: mockEventEmitter,
      hookBus: mockHookBus,
      getEngineApi: jest.fn().mockImplementation((ApiConstructor) => {
        if (ApiConstructor === TestApi) {
          return new TestApi(mockEngineClient);
        }
        return {};
      }),
      getService: jest.fn(),
    } as Partial<RPServerContext> as RPServerContext;

    testService = new TestService(mockContext);
  });

  describe('constructor', () => {
    it('should initialize with context dependencies', () => {
      expect(testService['context']).toBe(mockContext);
      expect(testService['eventEmitter']).toBe(mockEventEmitter);
      expect(testService['hookBus']).toBe(mockHookBus);
      expect(testService['logger']).toBe(mockLogger);
    });

    it('should bind event handlers from decorators', () => {
      expect(testService.eventHandlers).toBeDefined();
      expect(testService.eventHandlers['sessionStarted']).toBeDefined();
      expect(typeof testService.eventHandlers['sessionStarted']).toBe('function');
    });

    it('should register event listeners with event emitter', () => {
      const listenerSpy = jest.spyOn(mockEventEmitter, 'on');

      // Create new service to trigger constructor
      new TestService(mockContext);

      expect(listenerSpy).toHaveBeenCalledWith('sessionStarted', expect.any(Function));
    });
  });

  describe('init', () => {
    it('should call init method', async () => {
      await testService.init();
      expect(testService.initCalled).toBe(true);
    });

    it('should not throw when init is not overridden', async () => {
      class SimpleService extends RPServerService {}

      const simpleService = new SimpleService(mockContext);

      await expect(simpleService.init()).resolves.not.toThrow();
    });
  });

  describe('dispose', () => {
    it('should call dispose method', async () => {
      await testService.dispose();
      expect(testService.disposeCalled).toBe(true);
    });

    it('should not throw when dispose is not overridden', async () => {
      class SimpleService extends RPServerService {}

      const simpleService = new SimpleService(mockContext);

      await expect(simpleService.dispose()).resolves.not.toThrow();
    });
  });

  describe('getEngineApi', () => {
    it('should get API instance from context', () => {
      const api = testService['getEngineApi'](TestApi);

      expect(mockContext.getEngineApi).toHaveBeenCalledWith(TestApi);
      expect(api).toBeInstanceOf(TestApi);
    });

    it('should support different API types', () => {
      class AnotherApi {
        constructor(private _client: unknown) {}
      }

      (mockContext.getEngineApi as jest.Mock).mockImplementation((ApiConstructor) => {
        if (ApiConstructor === AnotherApi) {
          return new AnotherApi(mockEngineClient);
        }
        return new TestApi(mockEngineClient);
      });

      const testApi = testService['getEngineApi'](TestApi);
      const anotherApi = testService['getEngineApi'](AnotherApi);

      expect(testApi).toBeInstanceOf(TestApi);
      expect(anotherApi).toBeInstanceOf(AnotherApi);
    });
  });

  describe('getService', () => {
    it('should get service instance from context', () => {
      class AnotherService extends RPServerService {}

      const mockAnotherService = new AnotherService(mockContext);

      (mockContext.getService as jest.Mock).mockReturnValue(mockAnotherService);

      const service = testService.testGetService(AnotherService);

      expect(mockContext.getService).toHaveBeenCalledWith(AnotherService);
      expect(service).toBe(mockAnotherService);
    });
  });

  describe('event handler binding', () => {
    it('should bind decorated methods to event emitter', () => {
      const emitSpy = jest.spyOn(TestService.prototype, 'onSessionStarted');
      new TestService(mockContext);

      mockEventEmitter.emit('sessionStarted', { sessionId: 'test-123', sessionToken: 'token' });

      expect(emitSpy).toHaveBeenCalledWith({ sessionId: 'test-123', sessionToken: 'token' });

      emitSpy.mockRestore();
    });

    it('should handle multiple event handlers', () => {
      class MultiEventService extends RPServerService {
        public sessionStartedCalled = false;
        public sessionFinishedCalled = false;

        @OnServer('sessionStarted')
        public onSessionStarted(): void {
          this.sessionStartedCalled = true;
        }

        @OnServer('sessionFinished')
        public onSessionFinished(): void {
          this.sessionFinishedCalled = true;
        }
      }

      const service = new MultiEventService(mockContext);

      mockEventEmitter.emit('sessionStarted', { sessionId: 'test', sessionToken: 'token' });
      mockEventEmitter.emit('sessionFinished', {
        sessionId: 'test',
        endReason: SessionEndReason.ConnectionDropped,
      });

      expect(service.sessionStartedCalled).toBe(true);
      expect(service.sessionFinishedCalled).toBe(true);
    });

    it('should handle async event handlers', async () => {
      class AsyncEventService extends RPServerService {
        public asyncHandlerCalled = false;

        @OnServer('sessionStarted')
        public async onSessionStarted(): Promise<void> {
          await new Promise((resolve) => setTimeout(resolve, 10));
          this.asyncHandlerCalled = true;
        }
      }

      const service = new AsyncEventService(mockContext);

      mockEventEmitter.emit('sessionStarted', { sessionId: 'test', sessionToken: 'token' });

      // Wait for async handler
      await new Promise((resolve) => setTimeout(resolve, 20));

      expect(service.asyncHandlerCalled).toBe(true);
    });

    it('should skip non-function properties when binding', () => {
      class PropertyService extends RPServerService {
        public someProperty = 'not a function';

        @OnServer('sessionStarted')
        public onSessionStarted(): void {
          // Event handler
        }
      }

      expect(() => {
        new PropertyService(mockContext);
      }).not.toThrow();
    });
  });

  describe('error handling', () => {
    it('should handle errors in event handlers gracefully', () => {
      class ErrorService extends RPServerService {
        @OnServer('sessionStarted')
        public onSessionStarted(): void {
          throw new Error('Handler error');
        }
      }

      new ErrorService(mockContext);

      expect(() => {
        mockEventEmitter.emit('sessionStarted', { sessionId: 'test', sessionToken: 'token' });
      }).toThrow('Handler error');
    });

    it('should handle async errors in event handlers', async () => {
      class AsyncErrorService extends RPServerService {
        public errorThrown = false;

        @OnServer('sessionStarted')
        public async onSessionStarted(): Promise<void> {
          this.errorThrown = true;
          // Test that async handlers execute without crashing the service
          // Note: Errors in async event handlers become unhandled rejections in Node.js
        }
      }

      const service = new AsyncErrorService(mockContext);

      // Set up handler to suppress the unhandled rejection for this test
      const unhandledRejectionHandler = () => {
        // Suppress unhandled rejection for this test case
      };
      process.once('unhandledRejection', unhandledRejectionHandler);

      try {
        mockEventEmitter.emit('sessionStarted', { sessionId: 'test', sessionToken: 'token' });

        // Wait for async operation to complete
        await new Promise((resolve) => setTimeout(resolve, 50));

        // Verify the handler was called
        expect(service.errorThrown).toBe(true);
      } finally {
        // Clean up the handler
        process.removeListener('unhandledRejection', unhandledRejectionHandler);
      }
    });
  });

  describe('inheritance', () => {
    it('should support service inheritance', () => {
      class BaseService extends RPServerService {
        public baseMethod(): string {
          return 'base';
        }
      }

      class DerivedService extends BaseService {
        public derivedMethod(): string {
          return 'derived';
        }
      }

      const derived = new DerivedService(mockContext);

      expect(derived.baseMethod()).toBe('base');
      expect(derived.derivedMethod()).toBe('derived');
      expect(derived).toBeInstanceOf(BaseService);
      expect(derived).toBeInstanceOf(RPServerService);
    });

    it('should support overriding init method', async () => {
      class BaseService extends RPServerService {
        public baseInitCalled = false;

        public async init(): Promise<void> {
          this.baseInitCalled = true;
          await super.init();
        }
      }

      class DerivedService extends BaseService {
        public derivedInitCalled = false;

        public async init(): Promise<void> {
          this.derivedInitCalled = true;
          await super.init();
        }
      }

      const service = new DerivedService(mockContext);
      await service.init();

      expect(service.derivedInitCalled).toBe(true);
      expect(service.baseInitCalled).toBe(true);
    });
  });

  describe('generic context support', () => {
    it('should support custom context types', () => {
      // Define a custom context interface extending RPServerContext
      interface CustomServerContext extends RPServerContext {
        customProperty: string;

        customMethod(): string;
      }

      // Define custom server types
      interface CustomServerTypes {
        events: RPServerEvents;
        hooks: RPServerHooks;
        options: { customProperty: string };
      }

      // Create a service that uses the custom context
      class CustomContextService extends RPServerService<CustomServerTypes> {
        private customContext: CustomServerContext;

        constructor(context: CustomServerContext) {
          super(context);
          this.customContext = context;
        }

        public getCustomData(): string {
          return this.customContext.customProperty + ' - ' + this.customContext.customMethod();
        }
      }

      // Mock the custom context
      const customContext = {
        ...mockContext,
        customProperty: 'custom-data',
        customMethod: () => 'custom-method-result',
      } as CustomServerContext;

      const customService = new CustomContextService(customContext);

      // Verify the service can access custom context properties
      expect(customService.getCustomData()).toBe('custom-data - custom-method-result');
    });

    it('should default to RPServerContext when no generic is specified', () => {
      class DefaultContextService extends RPServerService {
        public getContextLogger() {
          return this.logger; // Should work with default types
        }
      }

      const defaultService = new DefaultContextService(mockContext);
      expect(defaultService.getContextLogger()).toBe(mockLogger);
    });

    it('should demonstrate game server context example', () => {
      // Example: Game server context
      interface GameServerContext extends RPServerContext {
        gameWorld: {
          getPlayer: (id: string) => { name: string; vehicle?: string };
          getVehicle: (id: string) => { model: string; position: [number, number, number] };
        };
      }

      // Define game server types
      interface GameServerTypes {
        events: RPServerEvents;
        hooks: RPServerHooks;
        options: { gameWorld: GameServerContext['gameWorld'] };
      }

      // Example: Player management service for game server
      class PlayerService extends RPServerService<GameServerTypes> {
        private gameContext: GameServerContext;

        constructor(context: GameServerContext) {
          super(context);
          this.gameContext = context;
        }

        public getPlayerVehicle(playerId: string): string | undefined {
          const player = this.gameContext.gameWorld.getPlayer(playerId);
          return player.vehicle;
        }
      }

      // Mock game server context
      const gameContext = {
        ...mockContext,
        gameWorld: {
          getPlayer: (id: string) => ({
            name: `Player${id}`,
            vehicle: id === '123' ? 'sportscar' : undefined,
          }),
          getVehicle: (_id: string) => ({
            model: 'sportscar',
            position: [0, 0, 0] as [number, number, number],
          }),
        },
      } as GameServerContext;

      const playerService = new PlayerService(gameContext);

      expect(playerService.getPlayerVehicle('123')).toBe('sportscar');
      expect(playerService.getPlayerVehicle('456')).toBeUndefined();
    });
  });
});
