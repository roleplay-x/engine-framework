/**
 * Tests for custom events and hooks functionality
 */
import { EngineClient } from '@roleplayx/engine-sdk';

import { RPEventEmitter } from '../../../core/bus/event-emitter';
import { RPHookBus } from '../../../core/bus/hook-bus';
import { MockEngineClient, MockLogger } from '../../../../test/mocks';
import { RPServerContext, RPServerContextOptions } from '../context';
import { CustomServerContextOptions, ServerTypes } from '../types';
import { RPServerService } from '../server-service';
import { RPServerHooks } from '../hooks/hooks';
import { PlatformAdapter } from '../../natives/adapters/platform.adapter';

import { RPServerEvents } from './events';
import { getEventHandlers, OnServer } from './decorators';

// Custom events extending base events
interface GameServerEvents extends RPServerEvents {
  playerJoined: { playerId: string; username: string; timestamp: number };
  playerLeft: { playerId: string; reason: 'disconnect' | 'kick' | 'ban' };
  gameStarted: { gameId: string; mode: 'pvp' | 'pve'; maxPlayers: number };
  gameEnded: { gameId: string; winner: string | null; duration: number };
  scoreUpdated: { playerId: string; score: number; rank: number };
  chatMessage: { playerId: string; message: string; channel: 'global' | 'team' };
}

// Custom hooks extending base hooks
interface GameServerHooks extends RPServerHooks {
  playerJoining: (arg: { playerId: string; username: string }) => boolean | Promise<boolean>;
  gameStarting: (arg: { gameMode: string; playerCount: number }) => boolean | Promise<boolean>;
  scoreChanging: (arg: {
    playerId: string;
    oldScore: number;
    newScore: number;
  }) => boolean | Promise<boolean>;
}

// Racing game events for additional testing
interface RacingServerEvents extends RPServerEvents {
  raceStarted: { raceId: string; trackName: string; participants: string[] };
  raceFinished: {
    raceId: string;
    winner: string;
    positions: Array<{ playerId: string; position: number; time: number }>;
  };
  lapCompleted: { playerId: string; raceId: string; lapNumber: number; lapTime: number };
  vehicleDamaged: { playerId: string; vehicleId: string; damageAmount: number };
  checkpointReached: { playerId: string; checkpointId: string; timestamp: number };
}

// Racing game hooks
interface RacingServerHooks extends RPServerHooks {
  raceStarting: (arg: {
    trackName: string;
    participantCount: number;
  }) => boolean | Promise<boolean>;
  lapValidating: (arg: { playerId: string; lapTime: number }) => boolean | Promise<boolean>;
}

// Custom context options for game server
interface GameServerContextOptions {
  gameConfig: {
    maxPlayers: number;
    mapName: string;
    gameMode: 'pvp' | 'pve' | 'mixed';
  };
  features: {
    chatEnabled: boolean;
    scoreTracking: boolean;
  };

  [key: string]: unknown;
}

// Custom context options for racing server
interface RacingServerContextOptions {
  raceConfig: {
    trackName: string;
    maxLaps: number;
    vehicleType: 'formula1' | 'rally' | 'street';
  };
  settings: {
    damageEnabled: boolean;
    ghostMode: boolean;
  };

  [key: string]: unknown;
}

// Game server context implementation
class GameServerContext extends RPServerContext<
  GameServerContextOptions,
  GameServerEvents,
  GameServerHooks
> {
  public readonly gameConfig: GameServerContextOptions['gameConfig'];
  public readonly features: GameServerContextOptions['features'];

  constructor(
    options: RPServerContextOptions<GameServerEvents, GameServerHooks> & GameServerContextOptions,
  ) {
    super(options);
    this.gameConfig = options.gameConfig;
    this.features = options.features;
  }

  public getMaxPlayers(): number {
    return this.gameConfig.maxPlayers;
  }

  public getGameMode(): string {
    return this.gameConfig.gameMode;
  }
}

// Racing server context implementation
class RacingServerContext extends RPServerContext<
  RacingServerContextOptions,
  RacingServerEvents,
  RacingServerHooks
> {
  public readonly raceConfig: RacingServerContextOptions['raceConfig'];
  public readonly settings: RacingServerContextOptions['settings'];

  constructor(
    options: RPServerContextOptions<RacingServerEvents, RacingServerHooks> &
      RacingServerContextOptions,
  ) {
    super(options);
    this.raceConfig = options.raceConfig;
    this.settings = options.settings;
  }

  public getTrackInfo(): string {
    return `${this.raceConfig.trackName} (${this.raceConfig.maxLaps} laps)`;
  }

  public isDamageEnabled(): boolean {
    return this.settings.damageEnabled;
  }
}

// Define types for GameServerContext
interface GameServerTypes extends ServerTypes {
  events: GameServerEvents;
  hooks: GameServerHooks;
  options: GameServerContextOptions;
}

// Test service with custom events for game server
class GameEventService extends RPServerService<GameServerTypes> {
  private gameContext: GameServerContext;

  constructor(context: GameServerContext) {
    super(context);
    this.gameContext = context;
  }

  public playerJoinedEvents: GameServerEvents['playerJoined'][] = [];
  public gameStartedEvents: GameServerEvents['gameStarted'][] = [];
  public chatMessageEvents: GameServerEvents['chatMessage'][] = [];

  @OnServer<GameServerEvents>('playerJoined')
  public onPlayerJoined(payload: GameServerEvents['playerJoined']): void {
    this.playerJoinedEvents.push(payload);
    this.logger.info(`Player ${payload.username} joined with ID ${payload.playerId}`);
  }

  @OnServer<GameServerEvents>('gameStarted')
  public onGameStarted(payload: GameServerEvents['gameStarted']): void {
    this.gameStartedEvents.push(payload);
    this.logger.info(`Game ${payload.gameId} started in ${payload.mode} mode`);
  }

  @OnServer<GameServerEvents>('chatMessage')
  public onChatMessage(payload: GameServerEvents['chatMessage']): void {
    this.chatMessageEvents.push(payload);
    if (this.gameContext.features.chatEnabled) {
      this.logger.info(`Chat message from ${payload.playerId}: ${payload.message}`);
    }
  }

  public emitPlayerJoined(playerId: string, username: string): void {
    this.eventEmitter.emit('playerJoined', {
      playerId,
      username,
      timestamp: Date.now(),
    });
  }

  public emitGameStarted(gameId: string, mode: 'pvp' | 'pve', maxPlayers: number): void {
    this.eventEmitter.emit('gameStarted', {
      gameId,
      mode,
      maxPlayers,
    });
  }

  public emitChatMessage(playerId: string, message: string, channel: 'global' | 'team'): void {
    this.eventEmitter.emit('chatMessage', {
      playerId,
      message,
      channel,
    });
  }

  public async testPlayerJoiningHook(playerId: string, username: string): Promise<boolean> {
    const result = await this.hookBus.run('playerJoining', { playerId, username });
    return typeof result === 'boolean' ? result : true;
  }

  public getContextInfo(): string {
    return `Game: ${this.gameContext.getGameMode()}, Max Players: ${this.gameContext.getMaxPlayers()}`;
  }
}

// Define types for RacingServerContext
interface RacingServerTypes extends ServerTypes {
  events: RacingServerEvents;
  hooks: RacingServerHooks;
  options: RacingServerContextOptions;
}

// Racing service with custom events for racing server
class RacingEventService extends RPServerService<RacingServerTypes> {
  private racingContext: RacingServerContext;

  constructor(context: RacingServerContext) {
    super(context);
    this.racingContext = context;
  }

  public raceStartedEvents: RacingServerEvents['raceStarted'][] = [];
  public lapCompletedEvents: RacingServerEvents['lapCompleted'][] = [];

  @OnServer<RacingServerEvents>('raceStarted')
  public onRaceStarted(payload: RacingServerEvents['raceStarted']): void {
    this.raceStartedEvents.push(payload);
    this.logger.info(`Race ${payload.raceId} started on ${payload.trackName}`);
  }

  @OnServer<RacingServerEvents>('lapCompleted')
  public onLapCompleted(payload: RacingServerEvents['lapCompleted']): void {
    this.lapCompletedEvents.push(payload);
    this.logger.info(`Player ${payload.playerId} completed lap ${payload.lapNumber}`);
  }

  public emitRaceStarted(raceId: string, trackName: string, participants: string[]): void {
    this.eventEmitter.emit('raceStarted', {
      raceId,
      trackName,
      participants,
    });
  }

  public emitLapCompleted(
    playerId: string,
    raceId: string,
    lapNumber: number,
    lapTime: number,
  ): void {
    this.eventEmitter.emit('lapCompleted', {
      playerId,
      raceId,
      lapNumber,
      lapTime,
    });
  }

  public getTrackInfo(): string {
    return this.racingContext.getTrackInfo();
  }

  public canTakeDamage(): boolean {
    return this.racingContext.isDamageEnabled();
  }
}

// Service that uses base events only (for backward compatibility testing)
class BaseEventService extends RPServerService {
  public playerConnectingEvents: RPServerEvents['playerConnecting'][] = [];

  @OnServer('playerConnecting')
  public onPlayerConnecting(payload: RPServerEvents['playerConnecting']): void {
    this.playerConnectingEvents.push(payload);
    this.logger.info(`Player connecting: ${payload.ipAddress}`);
  }

  public emitPlayerConnecting(ipAddress: string): void {
    this.eventEmitter.emit('playerConnecting', {
      ipAddress,
      playerId: 'test-player-123',
      name: 'TestPlayer',
    });
  }
}

describe('Custom Events and Hooks Support', () => {
  let mockLogger: MockLogger;
  let mockEngineClient: MockEngineClient;
  let mockPlatformAdapter: jest.Mocked<PlatformAdapter>;

  beforeEach(() => {
    mockLogger = new MockLogger();
    mockEngineClient = new MockEngineClient();
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
  });

  describe('Custom Game Server Context', () => {
    let gameEventEmitter: RPEventEmitter<GameServerEvents>;
    let gameHookBus: RPHookBus<GameServerHooks>;
    let gameContext: GameServerContext;
    let gameService: GameEventService;

    beforeEach(() => {
      gameEventEmitter = new RPEventEmitter<GameServerEvents>();
      gameHookBus = new RPHookBus<GameServerHooks>();

      const contextOptions: RPServerContextOptions<GameServerEvents, GameServerHooks> &
        GameServerContextOptions = {
        logger: mockLogger,
        engineClient: mockEngineClient as unknown as EngineClient,
        eventEmitter: gameEventEmitter,
        hookBus: gameHookBus,
        platformAdapter: mockPlatformAdapter,
        gameConfig: {
          maxPlayers: 32,
          mapName: 'TestWorld',
          gameMode: 'pvp',
        },
        features: {
          chatEnabled: true,
          scoreTracking: true,
        },
      };

      gameContext = new GameServerContext(contextOptions);
      gameContext.addService(GameEventService);
      gameService = gameContext.getService(GameEventService);
    });

    it('should create custom context with typed options', () => {
      expect(gameContext).toBeInstanceOf(GameServerContext);
      expect(gameContext).toBeInstanceOf(RPServerContext);
      expect(gameContext.gameConfig.maxPlayers).toBe(32);
      expect(gameContext.gameConfig.mapName).toBe('TestWorld');
      expect(gameContext.gameConfig.gameMode).toBe('pvp');
      expect(gameContext.features.chatEnabled).toBe(true);
      expect(gameContext.features.scoreTracking).toBe(true);
    });

    it('should support custom context methods', () => {
      expect(gameContext.getMaxPlayers()).toBe(32);
      expect(gameContext.getGameMode()).toBe('pvp');
    });

    it('should support custom event types in context creation', () => {
      expect(gameContext.eventEmitter).toBe(gameEventEmitter);
      expect(gameContext.hookBus).toBe(gameHookBus);
      expect(gameService).toBeInstanceOf(GameEventService);
    });

    it('should register custom event handlers using OnServer decorator', () => {
      const handlers = getEventHandlers<GameServerEvents>(gameService);

      expect(handlers).toBeDefined();
      expect(handlers?.length).toBe(3);
      expect(handlers?.find((h) => h.event === 'playerJoined')).toBeDefined();
      expect(handlers?.find((h) => h.event === 'gameStarted')).toBeDefined();
      expect(handlers?.find((h) => h.event === 'chatMessage')).toBeDefined();
    });

    it('should emit and handle custom playerJoined events', () => {
      const payload = {
        playerId: 'player123',
        username: 'TestPlayer',
        timestamp: 1234567890,
      };

      gameService.emitPlayerJoined(payload.playerId, payload.username);

      expect(gameService.playerJoinedEvents).toHaveLength(1);
      expect(gameService.playerJoinedEvents[0]).toMatchObject({
        playerId: payload.playerId,
        username: payload.username,
      });
      expect(gameService.playerJoinedEvents[0].timestamp).toBeGreaterThan(0);
    });

    it('should emit and handle custom gameStarted events', () => {
      const gameId = 'game456';
      const mode = 'pvp';
      const maxPlayers = 32;

      gameService.emitGameStarted(gameId, mode, maxPlayers);

      expect(gameService.gameStartedEvents).toHaveLength(1);
      expect(gameService.gameStartedEvents[0]).toEqual({
        gameId,
        mode,
        maxPlayers,
      });
    });

    it('should emit and handle custom chatMessage events', () => {
      const playerId = 'player789';
      const message = 'Hello world!';
      const channel = 'global';

      gameService.emitChatMessage(playerId, message, channel);

      expect(gameService.chatMessageEvents).toHaveLength(1);
      expect(gameService.chatMessageEvents[0]).toEqual({
        playerId,
        message,
        channel,
      });
    });

    it('should support service accessing custom context properties', () => {
      const contextInfo = gameService.getContextInfo();
      expect(contextInfo).toBe('Game: pvp, Max Players: 32');
    });

    it('should support custom hooks', async () => {
      // Register a hook handler
      gameContext.hookBus.on(
        'playerJoining',
        async (arg: { playerId: string; username: string }) => {
          return arg.username !== 'banned_user';
        },
      );

      // Test hook calls
      const allowedResult = await gameService.testPlayerJoiningHook('player1', 'valid_user');
      const blockedResult = await gameService.testPlayerJoiningHook('player2', 'banned_user');

      expect(allowedResult).toBe(true);
      expect(blockedResult).toBe(false);
    });

    it('should support multiple custom events in sequence', () => {
      // Emit multiple events
      gameService.emitPlayerJoined('player1', 'Alice');
      gameService.emitPlayerJoined('player2', 'Bob');
      gameService.emitGameStarted('game1', 'pve', 20);
      gameService.emitChatMessage('player1', 'Ready to play!', 'global');

      // Verify all events were handled
      expect(gameService.playerJoinedEvents).toHaveLength(2);
      expect(gameService.gameStartedEvents).toHaveLength(1);
      expect(gameService.chatMessageEvents).toHaveLength(1);

      expect(gameService.playerJoinedEvents[0].username).toBe('Alice');
      expect(gameService.playerJoinedEvents[1].username).toBe('Bob');
      expect(gameService.gameStartedEvents[0].mode).toBe('pve');
      expect(gameService.chatMessageEvents[0].message).toBe('Ready to play!');
    });
  });

  describe('Custom Racing Server Context', () => {
    let racingEventEmitter: RPEventEmitter<RacingServerEvents>;
    let racingHookBus: RPHookBus<RacingServerHooks>;
    let racingContext: RacingServerContext;
    let racingService: RacingEventService;

    beforeEach(() => {
      racingEventEmitter = new RPEventEmitter<RacingServerEvents>();
      racingHookBus = new RPHookBus<RacingServerHooks>();

      const contextOptions: RPServerContextOptions<RacingServerEvents, RacingServerHooks> &
        RacingServerContextOptions = {
        logger: mockLogger,
        engineClient: mockEngineClient as unknown as EngineClient,
        eventEmitter: racingEventEmitter,
        hookBus: racingHookBus,
        platformAdapter: mockPlatformAdapter,
        raceConfig: {
          trackName: 'Monaco',
          maxLaps: 10,
          vehicleType: 'formula1',
        },
        settings: {
          damageEnabled: true,
          ghostMode: false,
        },
      };

      racingContext = new RacingServerContext(contextOptions);
      racingContext.addService(RacingEventService);
      racingService = racingContext.getService(RacingEventService);
    });

    it('should create custom racing context with typed options', () => {
      expect(racingContext).toBeInstanceOf(RacingServerContext);
      expect(racingContext).toBeInstanceOf(RPServerContext);
      expect(racingContext.raceConfig.trackName).toBe('Monaco');
      expect(racingContext.raceConfig.maxLaps).toBe(10);
      expect(racingContext.raceConfig.vehicleType).toBe('formula1');
      expect(racingContext.settings.damageEnabled).toBe(true);
      expect(racingContext.settings.ghostMode).toBe(false);
    });

    it('should support custom racing context methods', () => {
      expect(racingContext.getTrackInfo()).toBe('Monaco (10 laps)');
      expect(racingContext.isDamageEnabled()).toBe(true);
    });

    it('should support racing-specific custom events', () => {
      const raceId = 'race001';
      const trackName = 'Monaco';
      const participants = ['player1', 'player2', 'player3'];

      racingService.emitRaceStarted(raceId, trackName, participants);

      expect(racingService.raceStartedEvents).toHaveLength(1);
      expect(racingService.raceStartedEvents[0]).toEqual({
        raceId,
        trackName,
        participants,
      });
    });

    it('should handle lap completion events', () => {
      const playerId = 'player1';
      const raceId = 'race001';
      const lapNumber = 3;
      const lapTime = 87.5;

      racingService.emitLapCompleted(playerId, raceId, lapNumber, lapTime);

      expect(racingService.lapCompletedEvents).toHaveLength(1);
      expect(racingService.lapCompletedEvents[0]).toEqual({
        playerId,
        raceId,
        lapNumber,
        lapTime,
      });
    });

    it('should support service accessing custom racing context properties', () => {
      expect(racingService.getTrackInfo()).toBe('Monaco (10 laps)');
      expect(racingService.canTakeDamage()).toBe(true);
    });

    it('should register racing-specific event handlers', () => {
      const handlers = getEventHandlers<RacingServerEvents>(racingService);

      expect(handlers).toBeDefined();
      expect(handlers?.length).toBe(2);
      expect(handlers?.find((h) => h.event === 'raceStarted')).toBeDefined();
      expect(handlers?.find((h) => h.event === 'lapCompleted')).toBeDefined();
    });
  });

  describe('Backward Compatibility', () => {
    let baseEventEmitter: RPEventEmitter<RPServerEvents>;
    let baseHookBus: RPHookBus<RPServerHooks>;
    let baseContext: RPServerContext<CustomServerContextOptions, RPServerEvents, RPServerHooks>;
    let baseService: BaseEventService;

    beforeEach(() => {
      baseEventEmitter = new RPEventEmitter<RPServerEvents>();
      baseHookBus = new RPHookBus<RPServerHooks>();

      const contextOptions: RPServerContextOptions = {
        logger: mockLogger,
        engineClient: mockEngineClient as unknown as EngineClient,
        eventEmitter: baseEventEmitter,
        hookBus: baseHookBus,
        platformAdapter: mockPlatformAdapter,
      };

      baseContext = new RPServerContext(contextOptions);
      baseContext.addService(BaseEventService);
      baseService = baseContext.getService(BaseEventService);
    });

    it('should work with base event types when no custom types specified', () => {
      expect(baseContext.eventEmitter).toBe(baseEventEmitter);
      expect(baseContext.hookBus).toBe(baseHookBus);
      expect(baseService).toBeInstanceOf(BaseEventService);
    });

    it('should handle base events without custom types', () => {
      const ipAddress = '192.168.1.100';

      baseService.emitPlayerConnecting(ipAddress);

      expect(baseService.playerConnectingEvents).toHaveLength(1);
      expect(baseService.playerConnectingEvents[0]).toEqual({
        ipAddress,
        playerId: 'test-player-123',
        name: 'TestPlayer',
      });
    });

    it('should register base event handlers', () => {
      const handlers = getEventHandlers(baseService);

      expect(handlers).toBeDefined();
      expect(handlers?.length).toBe(1);
      expect(handlers?.[0].event).toBe('playerConnecting');
    });
  });

  describe('OnServer Decorator with Custom Events', () => {
    it('should support generic decorator with custom event types', () => {
      class TestCustomEventService extends RPServerService<GameServerTypes> {
        constructor(context: GameServerContext) {
          super(context);
        }

        public receivedEvents: Array<{ type: string; payload: unknown }> = [];

        @OnServer<GameServerEvents>('scoreUpdated')
        public onScoreUpdated(payload: GameServerEvents['scoreUpdated']): void {
          this.receivedEvents.push({ type: 'scoreUpdated', payload });
        }

        @OnServer<GameServerEvents>('playerLeft')
        public onPlayerLeft(payload: GameServerEvents['playerLeft']): void {
          this.receivedEvents.push({ type: 'playerLeft', payload });
        }
      }

      const gameEventEmitter = new RPEventEmitter<GameServerEvents>();
      const gameHookBus = new RPHookBus<GameServerHooks>();

      const contextOptions: RPServerContextOptions<GameServerEvents, GameServerHooks> &
        GameServerContextOptions = {
        logger: mockLogger,
        engineClient: mockEngineClient as unknown as EngineClient,
        eventEmitter: gameEventEmitter,
        hookBus: gameHookBus,
        platformAdapter: mockPlatformAdapter,
        gameConfig: {
          maxPlayers: 16,
          mapName: 'TestMap',
          gameMode: 'mixed',
        },
        features: {
          chatEnabled: false,
          scoreTracking: true,
        },
      };

      const gameContext = new GameServerContext(contextOptions);
      gameContext.addService(TestCustomEventService);
      const service = gameContext.getService(TestCustomEventService);

      // Test event handlers
      gameContext.eventEmitter.emit('scoreUpdated', {
        playerId: 'player1',
        score: 1500,
        rank: 3,
      });

      gameContext.eventEmitter.emit('playerLeft', {
        playerId: 'player2',
        reason: 'disconnect',
      });

      expect(service.receivedEvents).toHaveLength(2);
      expect(service.receivedEvents[0]).toEqual({
        type: 'scoreUpdated',
        payload: { playerId: 'player1', score: 1500, rank: 3 },
      });
      expect(service.receivedEvents[1]).toEqual({
        type: 'playerLeft',
        payload: { playerId: 'player2', reason: 'disconnect' },
      });
    });

    it('should work without explicit generic type parameter (using default)', () => {
      class DefaultEventService extends RPServerService {
        public receivedEvents: RPServerEvents['playerConnecting'][] = [];

        @OnServer('playerConnecting')
        public onPlayerConnecting(payload: RPServerEvents['playerConnecting']): void {
          this.receivedEvents.push(payload);
        }
      }

      const baseEventEmitter = new RPEventEmitter<RPServerEvents>();
      const baseHookBus = new RPHookBus<RPServerHooks>();

      const contextOptions: RPServerContextOptions = {
        logger: mockLogger,
        engineClient: mockEngineClient as unknown as EngineClient,
        eventEmitter: baseEventEmitter,
        hookBus: baseHookBus,
        platformAdapter: mockPlatformAdapter,
      };

      const baseContext = new RPServerContext(contextOptions);
      baseContext.addService(DefaultEventService);
      const service = baseContext.getService(DefaultEventService);

      baseContext.eventEmitter.emit('playerConnecting', {
        ipAddress: '127.0.0.1',
        playerId: 'test-player-456',
        name: 'TestPlayer456',
      });

      expect(service.receivedEvents).toHaveLength(1);
      expect(service.receivedEvents[0]).toEqual({
        ipAddress: '127.0.0.1',
        playerId: 'test-player-456',
        name: 'TestPlayer456',
      });
    });
  });

  describe('Integration Tests', () => {
    it('should support multiple services with different custom event types', async () => {
      // Create game context
      const gameEventEmitter = new RPEventEmitter<GameServerEvents>();
      const gameHookBus = new RPHookBus<GameServerHooks>();
      const gameContext = new GameServerContext({
        logger: mockLogger,
        engineClient: mockEngineClient as unknown as EngineClient,
        eventEmitter: gameEventEmitter,
        hookBus: gameHookBus,
        platformAdapter: mockPlatformAdapter,
        gameConfig: {
          maxPlayers: 20,
          mapName: 'IntegrationTest',
          gameMode: 'pve',
        },
        features: {
          chatEnabled: true,
          scoreTracking: false,
        },
      });

      // Create racing context
      const racingEventEmitter = new RPEventEmitter<RacingServerEvents>();
      const racingHookBus = new RPHookBus<RacingServerHooks>();
      const racingContext = new RacingServerContext({
        logger: mockLogger,
        engineClient: mockEngineClient as unknown as EngineClient,
        eventEmitter: racingEventEmitter,
        hookBus: racingHookBus,
        platformAdapter: mockPlatformAdapter,
        raceConfig: {
          trackName: 'IntegrationTrack',
          maxLaps: 5,
          vehicleType: 'rally',
        },
        settings: {
          damageEnabled: false,
          ghostMode: true,
        },
      });

      // Add services to respective contexts
      gameContext.addService(GameEventService);
      racingContext.addService(RacingEventService);

      // Initialize contexts
      await gameContext.init();
      await racingContext.init();

      // Get services
      const gameService = gameContext.getService(GameEventService);
      const racingService = racingContext.getService(RacingEventService);

      // Test game events
      gameService.emitPlayerJoined('player1', 'GamePlayer');
      gameService.emitGameStarted('game1', 'pvp', 16);

      // Test racing events
      racingService.emitRaceStarted('race1', 'Silverstone', ['racer1', 'racer2']);
      racingService.emitLapCompleted('racer1', 'race1', 1, 92.3);

      // Verify events were handled correctly
      expect(gameService.playerJoinedEvents).toHaveLength(1);
      expect(gameService.gameStartedEvents).toHaveLength(1);
      expect(racingService.raceStartedEvents).toHaveLength(1);
      expect(racingService.lapCompletedEvents).toHaveLength(1);

      // Verify context-specific functionality
      expect(gameService.getContextInfo()).toBe('Game: pve, Max Players: 20');
      expect(racingService.getTrackInfo()).toBe('IntegrationTrack (5 laps)');
      expect(racingService.canTakeDamage()).toBe(false);

      // Clean up
      await gameContext.dispose();
      await racingContext.dispose();
    });

    it('should handle async event handlers with custom events', async () => {
      class AsyncGameService extends RPServerService<GameServerTypes> {
        constructor(context: GameServerContext) {
          super(context);
        }

        public processedEvents: string[] = [];

        @OnServer<GameServerEvents>('playerJoined')
        public async onPlayerJoined(payload: GameServerEvents['playerJoined']): Promise<void> {
          // Simulate async processing
          await new Promise((resolve) => setTimeout(resolve, 10));
          this.processedEvents.push(`processed-${payload.playerId}`);
        }
      }

      const gameEventEmitter = new RPEventEmitter<GameServerEvents>();
      const gameHookBus = new RPHookBus<GameServerHooks>();
      const gameContext = new GameServerContext({
        logger: mockLogger,
        engineClient: mockEngineClient as unknown as EngineClient,
        eventEmitter: gameEventEmitter,
        hookBus: gameHookBus,
        platformAdapter: mockPlatformAdapter,
        gameConfig: {
          maxPlayers: 8,
          mapName: 'AsyncTest',
          gameMode: 'pvp',
        },
        features: {
          chatEnabled: true,
          scoreTracking: true,
        },
      });

      gameContext.addService(AsyncGameService);
      await gameContext.init();

      const service = gameContext.getService(AsyncGameService);

      // Emit event
      gameContext.eventEmitter.emit('playerJoined', {
        playerId: 'async-player',
        username: 'AsyncUser',
        timestamp: Date.now(),
      });

      // Wait for async processing
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(service.processedEvents).toContain('processed-async-player');
    });
  });
});
