/**
 * Tests for RPServerContext
 */
import { EngineClient } from '@roleplayx/engine-sdk';

import { RPEventEmitter } from '../../core/bus/event-emitter';
import { RPHookBus } from '../../core/bus/hook-bus';
import { MockEngineClient, MockLogger } from '../../../test/mocks';

import { RPServerContext, RPServerContextOptions } from './context';
import { CustomServerContextOptions, ServerTypes } from './types';
import { RPServerService } from './server-service';
import { RPServerEvents } from './events/events';
import { RPServerHooks } from './hooks/hooks';

// Test service implementations
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
}

class AnotherTestService extends RPServerService {
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
}

class ThrowingInitService extends RPServerService {
  public async init(): Promise<void> {
    throw new Error('Init error');
  }
}

class ThrowingDisposeService extends RPServerService {
  public async dispose(): Promise<void> {
    throw new Error('Dispose error');
  }
}

// Test API classes
class TestApi {
  constructor(private _client: unknown) {}

  public testApiMethod(): Promise<string> {
    return Promise.resolve('api-result');
  }
}

class AnotherTestApi {
  constructor(private _client: unknown) {}

  public anotherApiMethod(): Promise<number> {
    return Promise.resolve(42);
  }
}

// Custom context implementation for testing
class CustomServerContext extends RPServerContext {
  public customProperty = 'custom';

  public getCustomProperty(): string {
    return this.customProperty;
  }
}

// Advanced custom context with typed options
interface GameServerContextOptions extends Record<string, unknown> {
  gameConfig: {
    maxPlayers: number;
    mapName: string;
  };
  features: {
    pvpEnabled: boolean;
    economySystem: boolean;
  };
}

class GameServerContext extends RPServerContext<GameServerContextOptions> {
  public readonly gameConfig: GameServerContextOptions['gameConfig'];
  public readonly features: GameServerContextOptions['features'];

  constructor(options: RPServerContextOptions & GameServerContextOptions) {
    super(options);
    this.gameConfig = options.gameConfig;
    this.features = options.features;
  }

  public getMaxPlayers(): number {
    return this.gameConfig.maxPlayers;
  }

  public isPvpEnabled(): boolean {
    return this.features.pvpEnabled;
  }

  public getMapInfo(): string {
    return `Map: ${this.gameConfig.mapName}, Max Players: ${this.gameConfig.maxPlayers}`;
  }
}

// Racing game context example
interface RacingContextOptions extends Record<string, unknown> {
  trackConfig: {
    name: string;
    laps: number;
    weatherCondition: 'sunny' | 'rainy' | 'foggy';
  };
  vehicleSettings: {
    damageEnabled: boolean;
    maxSpeed: number;
  };
}

class RacingServerContext extends RPServerContext<RacingContextOptions> {
  public readonly trackConfig: RacingContextOptions['trackConfig'];
  public readonly vehicleSettings: RacingContextOptions['vehicleSettings'];

  constructor(options: RPServerContextOptions & RacingContextOptions) {
    super(options);
    this.trackConfig = options.trackConfig;
    this.vehicleSettings = options.vehicleSettings;
  }

  public getRaceInfo(): string {
    return `Track: ${this.trackConfig.name}, Laps: ${this.trackConfig.laps}, Weather: ${this.trackConfig.weatherCondition}`;
  }

  public getVehicleSettings(): RacingContextOptions['vehicleSettings'] {
    return this.vehicleSettings;
  }
}

describe('RPServerContext', () => {
  let mockLogger: MockLogger;
  let mockEngineClient: MockEngineClient;
  let mockEventEmitter: RPEventEmitter<RPServerEvents>;
  let mockHookBus: RPHookBus<RPServerHooks>;
  let contextOptions: RPServerContextOptions;
  let context: RPServerContext;

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

    context = new RPServerContext(
      contextOptions as RPServerContextOptions & CustomServerContextOptions,
    );
  });

  describe('constructor', () => {
    it('should initialize with provided options', () => {
      expect(context.logger).toBe(mockLogger);
      expect(context.eventEmitter).toBe(mockEventEmitter);
      expect(context.hookBus).toBe(mockHookBus);
      expect(context['engineClient']).toBe(mockEngineClient);
    });

    it('should start with uninitialized state', () => {
      expect(context['initialized']).toBe(false);
      expect(context['services'].size).toBe(0);
      expect(context['apis'].size).toBe(0);
    });
  });

  describe('static create factory method', () => {
    it('should create context with default constructor', () => {
      const createdContext = RPServerContext.create(
        RPServerContext,
        contextOptions as RPServerContextOptions & CustomServerContextOptions,
      );

      expect(createdContext).toBeInstanceOf(RPServerContext);
      expect(createdContext.logger).toBe(mockLogger);
      expect(createdContext.eventEmitter).toBe(mockEventEmitter);
    });

    it('should create context with custom constructor', () => {
      const customContext = RPServerContext.create(
        CustomServerContext,
        contextOptions as RPServerContextOptions & CustomServerContextOptions,
      );

      expect(customContext).toBeInstanceOf(CustomServerContext);
      expect(customContext).toBeInstanceOf(RPServerContext);
      expect((customContext as CustomServerContext).getCustomProperty()).toBe('custom');
      expect(customContext.logger).toBe(mockLogger);
    });

    it('should support custom context extensions', () => {
      class ExtendedContext extends RPServerContext {
        public specialMethod(): string {
          return 'special';
        }
      }

      const extendedContext = RPServerContext.create(
        ExtendedContext,
        contextOptions as RPServerContextOptions & CustomServerContextOptions,
      );

      expect(extendedContext).toBeInstanceOf(ExtendedContext);
      expect((extendedContext as ExtendedContext).specialMethod()).toBe('special');
    });
  });

  describe('getEngineApi', () => {
    it('should create and cache API instances', () => {
      const api1 = context.getEngineApi(TestApi);
      const api2 = context.getEngineApi(TestApi);

      expect(api1).toBeInstanceOf(TestApi);
      expect(api2).toBe(api1); // Same instance (cached)
      expect(context['apis'].size).toBe(1);
    });

    it('should create different instances for different API types', () => {
      const testApi = context.getEngineApi(TestApi);
      const anotherApi = context.getEngineApi(AnotherTestApi);

      expect(testApi).toBeInstanceOf(TestApi);
      expect(anotherApi).toBeInstanceOf(AnotherTestApi);
      expect(testApi).not.toBe(anotherApi);
      expect(context['apis'].size).toBe(2);
    });

    it('should pass engine client to API constructors', () => {
      const api = context.getEngineApi(TestApi);

      expect(api).toBeInstanceOf(TestApi);
      expect(api['_client']).toBe(mockEngineClient);
    });

    it('should support multiple API retrievals', () => {
      const api1 = context.getEngineApi(TestApi);
      const api2 = context.getEngineApi(AnotherTestApi);
      const api3 = context.getEngineApi(TestApi); // Should be cached

      expect(api1).toBeInstanceOf(TestApi);
      expect(api2).toBeInstanceOf(AnotherTestApi);
      expect(api3).toBe(api1);
      expect(context['apis'].size).toBe(2);
    });
  });

  describe('addService', () => {
    it('should register services successfully', () => {
      const result = context.addService(TestService);

      expect(result).toBe(context); // Returns this for chaining
      expect(context['services'].size).toBe(2);
      expect(context['services'].has(TestService)).toBe(true);
    });

    it('should support method chaining', () => {
      const result = context.addService(TestService).addService(AnotherTestService);

      expect(result).toBe(context);
      expect(context['services'].size).toBe(3);
    });

    it('should create service instances with context injection', () => {
      context.addService(TestService);

      const service = context['services'].get(TestService) as TestService;
      expect(service).toBeInstanceOf(TestService);
      expect(service['context']).toBe(context);
    });

    it('should throw error when adding service after initialization', async () => {
      await context.init();

      expect(() => {
        context.addService(TestService);
      }).toThrow('Cannot add service after server start.');
    });

    it('should allow adding same service type multiple times before init', () => {
      context.addService(TestService);

      expect(() => {
        context.addService(TestService);
      }).not.toThrow();

      expect(context['services'].size).toBe(2);
    });
  });

  describe('getService', () => {
    beforeEach(() => {
      context.addService(TestService);
      context.addService(AnotherTestService);
    });

    it('should retrieve registered services', () => {
      const service = context.getService(TestService);

      expect(service).toBeInstanceOf(TestService);
      expect(service).toBe(context['services'].get(TestService));
    });

    it('should return same instance for multiple calls', () => {
      const service1 = context.getService(TestService);
      const service2 = context.getService(TestService);

      expect(service1).toBe(service2);
    });

    it('should return different instances for different service types', () => {
      const testService = context.getService(TestService);
      const anotherService = context.getService(AnotherTestService);

      expect(testService).toBeInstanceOf(TestService);
      expect(anotherService).toBeInstanceOf(AnotherTestService);
      expect(testService).not.toBe(anotherService);
    });

    it('should throw error for unregistered services', () => {
      class UnregisteredService extends RPServerService {}

      expect(() => {
        context.getService(UnregisteredService);
      }).toThrow('Service UnregisteredService not registered in the context.');
    });
  });

  describe('init', () => {
    it('should initialize all registered services', async () => {
      context.addService(TestService);
      context.addService(AnotherTestService);

      await context.init();

      const testService = context.getService(TestService) as TestService;
      const anotherService = context.getService(AnotherTestService) as AnotherTestService;

      expect(testService.initCalled).toBe(true);
      expect(anotherService.initCalled).toBe(true);
      expect(context['initialized']).toBe(true);
    });

    it('should only initialize once', async () => {
      const service = new TestService(context);
      jest.spyOn(service, 'init');
      context['services'].set(TestService, service);

      await context.init();
      await context.init(); // Second call

      expect(service.init).toHaveBeenCalledTimes(1);
    });

    it('should handle services without registered services', async () => {
      await context.init();

      expect(context['initialized']).toBe(true);
    });

    it('should initialize services in registration order', async () => {
      const initOrder: string[] = [];

      class FirstService extends RPServerService {
        public async init(): Promise<void> {
          initOrder.push('first');
          await super.init();
        }
      }

      class SecondService extends RPServerService {
        public async init(): Promise<void> {
          initOrder.push('second');
          await super.init();
        }
      }

      context.addService(FirstService);
      context.addService(SecondService);

      await context.init();

      expect(initOrder).toEqual(['first', 'second']);
    });

    it('should propagate initialization errors', async () => {
      context.addService(ThrowingInitService);

      await expect(context.init()).rejects.toThrow('Init error');
      expect(context['initialized']).toBe(true); // Still marked as initialized
    });
  });

  describe('dispose', () => {
    beforeEach(async () => {
      context.addService(TestService);
      context.addService(AnotherTestService);
      await context.init();
    });

    it('should dispose all services in reverse order', async () => {
      const disposeOrder: string[] = [];

      class FirstService extends RPServerService {
        public async dispose(): Promise<void> {
          disposeOrder.push('first');
          await super.dispose();
        }
      }

      class SecondService extends RPServerService {
        public async dispose(): Promise<void> {
          disposeOrder.push('second');
          await super.dispose();
        }
      }

      const localContext = new RPServerContext(
        contextOptions as RPServerContextOptions & CustomServerContextOptions,
      );
      localContext.addService(FirstService);
      localContext.addService(SecondService);
      await localContext.init();

      await localContext.dispose();

      expect(disposeOrder).toEqual(['second', 'first']); // Reverse order
    });

    it('should call dispose on all registered services', async () => {
      await context.dispose();

      const testService = context.getService(TestService) as TestService;
      const anotherService = context.getService(AnotherTestService) as AnotherTestService;

      expect(testService.disposeCalled).toBe(true);
      expect(anotherService.disposeCalled).toBe(true);
      expect(context['initialized']).toBe(false);
    });

    it('should handle disposal errors gracefully and log them', async () => {
      const localContext = new RPServerContext(
        contextOptions as RPServerContextOptions & CustomServerContextOptions,
      );
      localContext.addService(ThrowingDisposeService);
      localContext.addService(TestService);
      await localContext.init();

      await localContext.dispose();

      expect(
        mockLogger.logs.some(
          (log) =>
            log.level === 'error' &&
            log.message.includes('Error disposing service ThrowingDisposeService'),
        ),
      ).toBe(true);

      // Should still dispose other services
      const testService = localContext.getService(TestService) as TestService;
      expect(testService.disposeCalled).toBe(true);
      expect(localContext['initialized']).toBe(false);
    });

    it('should do nothing if context is not initialized', async () => {
      const uninitializedContext = new RPServerContext(
        contextOptions as RPServerContextOptions & CustomServerContextOptions,
      );
      uninitializedContext.addService(TestService);

      await uninitializedContext.dispose();

      const service = uninitializedContext.getService(TestService) as TestService;
      expect(service.disposeCalled).toBe(false);
    });

    it('should handle empty services list', async () => {
      const emptyContext = new RPServerContext(
        contextOptions as RPServerContextOptions & CustomServerContextOptions,
      );
      await emptyContext.init();

      await expect(emptyContext.dispose()).resolves.not.toThrow();
      expect(emptyContext['initialized']).toBe(false);
    });
  });

  describe('integration', () => {
    it('should support full lifecycle with multiple services and APIs', async () => {
      // Register services
      context.addService(TestService).addService(AnotherTestService);

      // Initialize context
      await context.init();

      // Get services
      const testService = context.getService(TestService) as TestService;
      const anotherService = context.getService(AnotherTestService) as AnotherTestService;

      // Get APIs
      const testApi = context.getEngineApi(TestApi);
      const anotherApi = context.getEngineApi(AnotherTestApi);

      // Verify everything works
      expect(testService.initCalled).toBe(true);
      expect(anotherService.initCalled).toBe(true);
      expect(testService.testMethod()).toBe('test');
      expect(await testApi.testApiMethod()).toBe('api-result');
      expect(await anotherApi.anotherApiMethod()).toBe(42);

      // Dispose
      await context.dispose();

      expect(testService.disposeCalled).toBe(true);
      expect(anotherService.disposeCalled).toBe(true);
      expect(context['initialized']).toBe(false);
    });

    it('should handle complex service dependencies', async () => {
      class DependentService extends RPServerService {
        public initCalled = false;

        public async init(): Promise<void> {
          // Use another service during init
          const testService = this.getService(TestService);
          expect(testService).toBeInstanceOf(TestService);
          this.initCalled = true;
          await super.init();
        }
      }

      context.addService(TestService);
      context.addService(DependentService);

      await context.init();

      const dependentService = context.getService(DependentService) as DependentService;
      expect(dependentService.initCalled).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should handle service constructor errors', () => {
      class BadService extends RPServerService {
        constructor(context: RPServerContext) {
          super(context);
          throw new Error('Constructor error');
        }
      }

      expect(() => {
        context.addService(BadService);
      }).toThrow('Constructor error');
    });

    it('should maintain context state after service errors', async () => {
      context.addService(TestService);
      context.addService(ThrowingInitService);

      await expect(context.init()).rejects.toThrow('Init error');

      // Context should still be marked as initialized
      expect(context['initialized']).toBe(true);

      // Working service should still be available
      const testService = context.getService(TestService) as TestService;
      expect(testService.initCalled).toBe(true);
    });
  });

  describe('custom context options support', () => {
    describe('GameServerContext with typed options', () => {
      it('should create context with custom options', () => {
        const gameOptions: RPServerContextOptions & GameServerContextOptions = {
          ...contextOptions,
          gameConfig: {
            maxPlayers: 32,
            mapName: 'CityCenter',
          },
          features: {
            pvpEnabled: true,
            economySystem: false,
          },
        };

        const gameContext = new GameServerContext(gameOptions);

        expect(gameContext).toBeInstanceOf(GameServerContext);
        expect(gameContext).toBeInstanceOf(RPServerContext);
        expect(gameContext.gameConfig.maxPlayers).toBe(32);
        expect(gameContext.gameConfig.mapName).toBe('CityCenter');
        expect(gameContext.features.pvpEnabled).toBe(true);
        expect(gameContext.features.economySystem).toBe(false);
      });

      it('should provide typed access to custom options', () => {
        const gameOptions: RPServerContextOptions & GameServerContextOptions = {
          ...contextOptions,
          gameConfig: {
            maxPlayers: 16,
            mapName: 'Desert',
          },
          features: {
            pvpEnabled: false,
            economySystem: true,
          },
        };

        const gameContext = new GameServerContext(gameOptions);

        expect(gameContext.getMaxPlayers()).toBe(16);
        expect(gameContext.isPvpEnabled()).toBe(false);
        expect(gameContext.getMapInfo()).toBe('Map: Desert, Max Players: 16');
      });

      it('should work with static create factory method', () => {
        const gameOptions: RPServerContextOptions & GameServerContextOptions = {
          ...contextOptions,
          gameConfig: {
            maxPlayers: 64,
            mapName: 'Metropolis',
          },
          features: {
            pvpEnabled: true,
            economySystem: true,
          },
        };

        const gameContext = RPServerContext.create(GameServerContext, gameOptions);

        expect(gameContext).toBeInstanceOf(GameServerContext);
        expect((gameContext as unknown as GameServerContext).getMaxPlayers()).toBe(64);
        expect((gameContext as unknown as GameServerContext).isPvpEnabled()).toBe(true);
        expect((gameContext as unknown as GameServerContext).getMapInfo()).toBe(
          'Map: Metropolis, Max Players: 64',
        );
      });
    });

    describe('RacingServerContext with complex options', () => {
      it('should create racing context with track and vehicle settings', () => {
        const racingOptions: RPServerContextOptions & RacingContextOptions = {
          ...contextOptions,
          trackConfig: {
            name: 'Monaco Circuit',
            laps: 10,
            weatherCondition: 'rainy',
          },
          vehicleSettings: {
            damageEnabled: true,
            maxSpeed: 250,
          },
        };

        const racingContext = new RacingServerContext(racingOptions);

        expect(racingContext.trackConfig.name).toBe('Monaco Circuit');
        expect(racingContext.trackConfig.laps).toBe(10);
        expect(racingContext.trackConfig.weatherCondition).toBe('rainy');
        expect(racingContext.vehicleSettings.damageEnabled).toBe(true);
        expect(racingContext.vehicleSettings.maxSpeed).toBe(250);
      });

      it('should provide custom methods for racing context', () => {
        const racingOptions: RPServerContextOptions & RacingContextOptions = {
          ...contextOptions,
          trackConfig: {
            name: 'Silverstone',
            laps: 15,
            weatherCondition: 'sunny',
          },
          vehicleSettings: {
            damageEnabled: false,
            maxSpeed: 300,
          },
        };

        const racingContext = new RacingServerContext(racingOptions);

        expect(racingContext.getRaceInfo()).toBe('Track: Silverstone, Laps: 15, Weather: sunny');
        expect(racingContext.getVehicleSettings()).toEqual({
          damageEnabled: false,
          maxSpeed: 300,
        });
      });
    });

    describe('services with custom contexts', () => {
      it('should allow services to use custom context types', () => {
        interface GameManagementTypes {
          events: RPServerEvents;
          hooks: RPServerHooks;
          options: GameServerContextOptions;
        }

        class GameManagementService extends RPServerService<GameManagementTypes> {
          private gameContext: GameServerContext;

          constructor(context: GameServerContext) {
            super(context);
            this.gameContext = context;
          }

          public getServerCapacity(): string {
            return `Server can handle ${this.gameContext.getMaxPlayers()} players on ${this.gameContext.gameConfig.mapName}`;
          }

          public canEnablePvp(): boolean {
            return this.gameContext.isPvpEnabled();
          }
        }

        const gameOptions: RPServerContextOptions & GameServerContextOptions = {
          ...contextOptions,
          gameConfig: {
            maxPlayers: 50,
            mapName: 'Islands',
          },
          features: {
            pvpEnabled: true,
            economySystem: true,
          },
        };

        const gameContext = new GameServerContext(gameOptions);
        gameContext.addService(GameManagementService);

        const gameService = gameContext.getService(GameManagementService);

        expect(gameService.getServerCapacity()).toBe('Server can handle 50 players on Islands');
        expect(gameService.canEnablePvp()).toBe(true);
      });

      it('should support racing services with racing context', () => {
        interface RaceManagementTypes {
          events: RPServerEvents;
          hooks: RPServerHooks;
          options: RacingContextOptions;
        }

        class RaceManagementService extends RPServerService<RaceManagementTypes> {
          private racingContext: RacingServerContext;

          constructor(context: RacingServerContext) {
            super(context);
            this.racingContext = context;
          }

          public getRaceDetails(): string {
            return this.racingContext.getRaceInfo();
          }

          public isVehicleDamageEnabled(): boolean {
            return this.racingContext.getVehicleSettings().damageEnabled;
          }

          public getMaxSpeed(): number {
            return this.racingContext.getVehicleSettings().maxSpeed;
          }
        }

        const racingOptions: RPServerContextOptions & RacingContextOptions = {
          ...contextOptions,
          trackConfig: {
            name: 'Nürburgring',
            laps: 3,
            weatherCondition: 'foggy',
          },
          vehicleSettings: {
            damageEnabled: true,
            maxSpeed: 280,
          },
        };

        const racingContext = new RacingServerContext(racingOptions);
        racingContext.addService(RaceManagementService);

        const raceService = racingContext.getService(RaceManagementService);

        expect(raceService.getRaceDetails()).toBe('Track: Nürburgring, Laps: 3, Weather: foggy');
        expect(raceService.isVehicleDamageEnabled()).toBe(true);
        expect(raceService.getMaxSpeed()).toBe(280);
      });
    });

    describe('integration with server creation', () => {
      it('should demonstrate full integration flow', async () => {
        // This test shows how the custom context would be used in practice
        interface GameServerTypes {
          events: RPServerEvents;
          hooks: RPServerHooks;
          options: GameServerContextOptions;
        }

        class IntegratedGameService extends RPServerService<GameServerTypes> {
          private gameContext: GameServerContext;

          constructor(context: GameServerContext) {
            super(context);
            this.gameContext = context;
          }

          public async init(): Promise<void> {
            await super.init();
            this.logger.info(`Initializing game server for ${this.gameContext.gameConfig.mapName}`);
          }

          public getGameStatus(): object {
            return {
              map: this.gameContext.gameConfig.mapName,
              maxPlayers: this.gameContext.getMaxPlayers(),
              pvpEnabled: this.gameContext.isPvpEnabled(),
              economyEnabled: this.gameContext.features.economySystem,
            };
          }
        }

        const gameOptions: RPServerContextOptions & GameServerContextOptions = {
          ...contextOptions,
          gameConfig: {
            maxPlayers: 40,
            mapName: 'TestWorld',
          },
          features: {
            pvpEnabled: false,
            economySystem: true,
          },
        };

        const gameContext = new GameServerContext(gameOptions);
        gameContext.addService(IntegratedGameService);

        await gameContext.init();

        const gameService = gameContext.getService(IntegratedGameService);
        const status = gameService.getGameStatus();

        expect(status).toEqual({
          map: 'TestWorld',
          maxPlayers: 40,
          pvpEnabled: false,
          economyEnabled: true,
        });

        await gameContext.dispose();
      });
    });
  });

  describe('abstract service support', () => {
    interface CustomServerTypes {
      events: RPServerEvents;
      hooks: RPServerHooks;
      options: CustomServerContextOptions;
    }

    // Abstract service for testing
    abstract class AbstractService<T extends ServerTypes = ServerTypes> extends RPServerService<T> {
      abstract getValue(): string;

      abstract processData(data: string): Promise<string>;
    }

    // Concrete implementation
    class ConcreteService extends AbstractService<CustomServerTypes> {
      getValue(): string {
        return 'concrete-value';
      }

      async processData(data: string): Promise<string> {
        return `processed: ${data}`;
      }
    }

    // Another concrete implementation
    class AlternativeService extends AbstractService {
      getValue(): string {
        return 'alternative-value';
      }

      async processData(data: string): Promise<string> {
        return `alternative: ${data}`;
      }
    }

    // Service that depends on abstract service
    class DependentService extends RPServerService {
      public async performOperation(): Promise<string> {
        const abstractService = this.getService(AbstractService);
        const value = abstractService.getValue();
        const processed = await abstractService.processData(value);
        return processed;
      }

      public getAbstractServiceInstance(): AbstractService {
        return this.getService(AbstractService);
      }
    }

    it('should register concrete implementation of abstract service', () => {
      expect(() => {
        context.addService(ConcreteService);
      }).not.toThrow();

      expect(context['services'].has(ConcreteService)).toBe(true);
    });

    it('should retrieve concrete service via abstract class reference', () => {
      context.addService(ConcreteService);

      const service = context.getService(AbstractService);

      expect(service).toBeInstanceOf(ConcreteService);
      expect(service.getValue()).toBe('concrete-value');
    });

    it('should retrieve concrete service via concrete class reference', () => {
      context.addService(ConcreteService);

      const service = context.getService(ConcreteService);

      expect(service).toBeInstanceOf(ConcreteService);
      expect(service.getValue()).toBe('concrete-value');
    });

    it('should allow other services to use abstract service references', async () => {
      context.addService(ConcreteService);
      context.addService(DependentService);

      const dependent = context.getService(DependentService) as DependentService;
      const result = await dependent.performOperation();

      expect(result).toBe('processed: concrete-value');
    });

    it('should return same instance when accessed via abstract or concrete reference', () => {
      context.addService(ConcreteService);

      const abstractRef = context.getService(AbstractService);
      const concreteRef = context.getService(ConcreteService);

      expect(abstractRef).toBe(concreteRef);
    });

    it('should throw error when abstract service is not registered', () => {
      context.addService(DependentService);
      const dependent = context.getService(DependentService) as DependentService;

      expect(() => {
        dependent.getAbstractServiceInstance();
      }).toThrow('Service AbstractService not registered in the context.');
    });

    it('should use first registered implementation for abstract reference', () => {
      context.addService(ConcreteService);
      context.addService(AlternativeService); // This won't override abstract reference

      // Abstract reference should get first registered implementation
      const abstractService = context.getService(AbstractService);
      expect(abstractService).toBeInstanceOf(ConcreteService);
      expect(abstractService.getValue()).toBe('concrete-value');

      // But both concrete services are accessible via their concrete types
      const concreteService = context.getService(ConcreteService);
      const alternativeService = context.getService(AlternativeService);

      expect(concreteService.getValue()).toBe('concrete-value');
      expect(alternativeService.getValue()).toBe('alternative-value');
    });

    it('should work with initialization lifecycle', async () => {
      class InitializableConcreteService extends AbstractService {
        public initialized = false;

        public async init(): Promise<void> {
          await super.init();
          this.initialized = true;
        }

        getValue(): string {
          return this.initialized ? 'initialized-value' : 'not-initialized';
        }

        async processData(data: string): Promise<string> {
          return data;
        }
      }

      context.addService(InitializableConcreteService);

      const serviceBeforeInit = context.getService(AbstractService) as InitializableConcreteService;
      expect(serviceBeforeInit.getValue()).toBe('not-initialized');

      await context.init();

      const serviceAfterInit = context.getService(AbstractService) as InitializableConcreteService;
      expect(serviceAfterInit.getValue()).toBe('initialized-value');
      expect(serviceAfterInit.initialized).toBe(true);
    });

    it('should support multiple abstract services in the same context', () => {
      abstract class AnotherAbstractService extends RPServerService {
        abstract getNumber(): number;
      }

      class AnotherConcreteService extends AnotherAbstractService {
        getNumber(): number {
          return 42;
        }
      }

      context.addService(ConcreteService);
      context.addService(AnotherConcreteService);

      const firstAbstract = context.getService(AbstractService);
      const secondAbstract = context.getService(AnotherAbstractService);

      expect(firstAbstract).toBeInstanceOf(ConcreteService);
      expect(secondAbstract).toBeInstanceOf(AnotherConcreteService);
      expect(firstAbstract.getValue()).toBe('concrete-value');
      expect(secondAbstract.getNumber()).toBe(42);
    });

    it('should handle complex inheritance chains', () => {
      abstract class BaseAbstractService extends RPServerService {
        abstract getBase(): string;
      }

      abstract class ExtendedAbstractService extends BaseAbstractService {
        abstract getExtended(): string;
      }

      class FinalConcreteService extends ExtendedAbstractService {
        getBase(): string {
          return 'base';
        }

        getExtended(): string {
          return 'extended';
        }
      }

      context.addService(FinalConcreteService);

      // Should be accessible via immediate parent abstract class
      const extendedRef = context.getService(ExtendedAbstractService);
      expect(extendedRef).toBeInstanceOf(FinalConcreteService);
      expect(extendedRef.getExtended()).toBe('extended');

      // Should be accessible via concrete class
      const concreteRef = context.getService(FinalConcreteService);
      expect(concreteRef).toBeInstanceOf(FinalConcreteService);
      expect(concreteRef.getBase()).toBe('base');
    });

    it('should work with real-world scenario like Discord service', () => {
      // Simulating the actual Discord service scenario
      abstract class DiscordService extends RPServerService {
        abstract getDiscordUserId(sessionId: string): string | undefined;
      }

      class RPDiscordService extends DiscordService {
        private sessionDiscordMap = new Map<string, string>([
          ['session1', 'discord_user_123'],
          ['session2', 'discord_user_456'],
        ]);

        getDiscordUserId(sessionId: string): string | undefined {
          return this.sessionDiscordMap.get(sessionId);
        }
      }

      class AccountService extends RPServerService {
        public authenticateWithDiscord(sessionId: string): string | null {
          const discordService = this.getService(DiscordService);
          const discordUserId = discordService.getDiscordUserId(sessionId);

          if (!discordUserId) {
            return null;
          }

          return `authenticated_${discordUserId}`;
        }
      }

      context.addService(RPDiscordService);
      context.addService(AccountService);

      const accountService = context.getService(AccountService) as AccountService;

      expect(accountService.authenticateWithDiscord('session1')).toBe(
        'authenticated_discord_user_123',
      );
      expect(accountService.authenticateWithDiscord('session2')).toBe(
        'authenticated_discord_user_456',
      );
      expect(accountService.authenticateWithDiscord('session3')).toBeNull();
    });
  });
});
