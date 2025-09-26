/**
 * Tests for RPServer Custom Types Integration - Real implementation without mocks
 */
import { EngineClient } from '@roleplayx/engine-sdk';

import { RPEventEmitter } from '../core/bus/event-emitter';
import { RPHookBus } from '../core/bus/hook-bus';
import { MockLogger } from '../../test/mocks';

import { RPServerContext, RPServerContextOptions } from './core/context';
import { RPServerService } from './core/server-service';
import { OnServer } from './core/events/decorators';
import { RPServerEvents } from './core/events/events';
import { RPServerHooks } from './core/hooks/hooks';

// Mock only EngineClient for these tests
jest.mock('@roleplayx/engine-sdk');

// Define custom event types extending base events
interface GameServerEvents extends RPServerEvents {
  playerJoined: { playerId: string; username: string; level: number };
  playerLeft: { playerId: string; reason: 'disconnect' | 'kick' | 'quit' };
  gameStarted: { gameId: string; mode: 'pvp' | 'pve'; playerCount: number };
  scoreUpdated: { playerId: string; score: number; rank: number };
  matchFinished: { gameId: string; winnerId: string; duration: number };
}

// Define custom hook types extending base hooks
interface GameServerHooks extends RPServerHooks {
  beforePlayerJoin: (payload: {
    playerId: string;
    playerData: { level: number; vip: boolean };
  }) => boolean | Promise<boolean>;
  afterPlayerJoin: (payload: { playerId: string; success: boolean }) => void | Promise<void>;
  beforeGameStart: (payload: { gameId: string; playerIds: string[] }) => boolean | Promise<boolean>;
  afterGameStart: (payload: { gameId: string; startTime: number }) => void | Promise<void>;
  beforeMatchEnd: (payload: { gameId: string; winnerCandidates: string[] }) => void | Promise<void>;
}

// Define custom context options
interface GameServerOptions {
  gameConfig: {
    maxPlayers: number;
    mapRotation: string[];
    gameMode: 'ranked' | 'casual';
  };
  features: {
    antiCheat: boolean;
    voiceChat: boolean;
    spectatorMode: boolean;
  };
  economy: {
    startingCredits: number;
    killReward: number;
    winReward: number;
  };

  [key: string]: unknown;
}

// Define server types
interface GameServerTypes {
  events: GameServerEvents;
  hooks: GameServerHooks;
  options: GameServerOptions;
}

// Custom context class
class GameServerContext extends RPServerContext<
  GameServerOptions,
  GameServerEvents,
  GameServerHooks
> {
  public readonly gameConfig: GameServerOptions['gameConfig'];
  public readonly features: GameServerOptions['features'];
  public readonly economy: GameServerOptions['economy'];

  constructor(
    options: RPServerContextOptions<GameServerEvents, GameServerHooks> & GameServerOptions,
  ) {
    super(options);
    this.gameConfig = options.gameConfig;
    this.features = options.features;
    this.economy = options.economy;
  }

  public getMaxPlayers(): number {
    return this.gameConfig.maxPlayers;
  }

  public isAntiCheatEnabled(): boolean {
    return this.features.antiCheat;
  }

  public calculateReward(type: 'kill' | 'win'): number {
    return type === 'kill' ? this.economy.killReward : this.economy.winReward;
  }

  public getGameModeConfig(): string {
    return `${this.gameConfig.gameMode} with ${this.gameConfig.maxPlayers} players`;
  }
}

// Custom service using the game server types
class GameManagementService extends RPServerService<GameServerTypes> {
  private gameContext: GameServerContext;
  public playerJoinEvents: GameServerEvents['playerJoined'][] = [];
  public gameStartEvents: GameServerEvents['gameStarted'][] = [];
  public hookResults: Array<{ hook: string; payload: Record<string, unknown> }> = [];

  constructor(context: GameServerContext) {
    super(context);
    this.gameContext = context;
  }

  @OnServer<GameServerEvents>('playerJoined')
  public onPlayerJoined(payload: GameServerEvents['playerJoined']): void {
    this.playerJoinEvents.push(payload);

    // Use custom context methods
    const maxPlayers = this.gameContext.getMaxPlayers();
    const antiCheatEnabled = this.gameContext.isAntiCheatEnabled();

    this.logger.info(
      `Player ${payload.username} joined (${this.playerJoinEvents.length}/${maxPlayers}, AC: ${antiCheatEnabled})`,
    );
  }

  @OnServer<GameServerEvents>('gameStarted')
  public onGameStarted(payload: GameServerEvents['gameStarted']): void {
    this.gameStartEvents.push(payload);

    const modeConfig = this.gameContext.getGameModeConfig();
    this.logger.info(`Game ${payload.gameId} started: ${modeConfig}`);
  }

  public async processPlayerJoin(
    playerId: string,
    playerData: { level: number; vip: boolean },
  ): Promise<boolean> {
    // Execute before hook
    const beforeResult = await this.hookBus.run('beforePlayerJoin', {
      playerId,
      playerData,
    });

    this.hookResults.push({ hook: 'beforePlayerJoin', payload: { playerId, playerData } });

    const success = beforeResult !== false;

    if (success) {
      // Emit custom event
      this.eventEmitter.emit('playerJoined', {
        playerId,
        username: `Player_${playerId}`,
        level: playerData.level,
      });

      // Execute after hook
      await this.hookBus.run('afterPlayerJoin', { playerId, success });
      this.hookResults.push({ hook: 'afterPlayerJoin', payload: { playerId, success } });
    }

    return success;
  }

  public async startGame(gameId: string, playerIds: string[]): Promise<void> {
    // Before game start hook
    await this.hookBus.run('beforeGameStart', { gameId, playerIds });
    this.hookResults.push({ hook: 'beforeGameStart', payload: { gameId, playerIds } });

    const startTime = Date.now();

    // Emit game started event
    this.eventEmitter.emit('gameStarted', {
      gameId,
      mode: this.gameContext.gameConfig.gameMode === 'ranked' ? 'pvp' : 'pve',
      playerCount: playerIds.length,
    });

    // After game start hook
    await this.hookBus.run('afterGameStart', { gameId, startTime });
    this.hookResults.push({ hook: 'afterGameStart', payload: { gameId, startTime } });
  }

  public calculatePlayerReward(type: 'kill' | 'win'): number {
    return this.gameContext.calculateReward(type);
  }

  public getContextInfo(): {
    maxPlayers: number;
    antiCheat: boolean;
    gameMode: string;
    startingCredits: number;
  } {
    return {
      maxPlayers: this.gameContext.getMaxPlayers(),
      antiCheat: this.gameContext.isAntiCheatEnabled(),
      gameMode: this.gameContext.gameConfig.gameMode,
      startingCredits: this.gameContext.economy.startingCredits,
    };
  }
}

describe('RPServer Custom Types Integration', () => {
  let mockLogger: MockLogger;
  let mockEngineClient: jest.Mocked<EngineClient>;

  beforeEach(() => {
    mockLogger = new MockLogger();
    mockEngineClient = {
      getEngineApi: jest.fn(),
    } as unknown as jest.Mocked<EngineClient>;

    (EngineClient as jest.Mock).mockImplementation(() => mockEngineClient);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should support custom context with typed options', () => {
    const customOptions: GameServerOptions = {
      gameConfig: {
        maxPlayers: 64,
        mapRotation: ['dust2', 'mirage', 'inferno'],
        gameMode: 'ranked',
      },
      features: {
        antiCheat: true,
        voiceChat: true,
        spectatorMode: false,
      },
      economy: {
        startingCredits: 1000,
        killReward: 300,
        winReward: 2500,
      },
    };

    const gameContext = new GameServerContext({
      engineClient: mockEngineClient,
      eventEmitter: new RPEventEmitter<GameServerEvents>(),
      hookBus: new RPHookBus<GameServerHooks>(),
      logger: mockLogger,
      ...customOptions,
    });

    expect(gameContext.getMaxPlayers()).toBe(64);
    expect(gameContext.isAntiCheatEnabled()).toBe(true);
    expect(gameContext.calculateReward('kill')).toBe(300);
    expect(gameContext.calculateReward('win')).toBe(2500);
    expect(gameContext.getGameModeConfig()).toBe('ranked with 64 players');
  });

  it('should support custom service with typed events and hooks', async () => {
    const customOptions: GameServerOptions = {
      gameConfig: {
        maxPlayers: 32,
        mapRotation: ['cache', 'overpass'],
        gameMode: 'casual',
      },
      features: {
        antiCheat: false,
        voiceChat: false,
        spectatorMode: true,
      },
      economy: {
        startingCredits: 500,
        killReward: 100,
        winReward: 1000,
      },
    };

    const gameContext = new GameServerContext({
      engineClient: mockEngineClient,
      eventEmitter: new RPEventEmitter<GameServerEvents>(),
      hookBus: new RPHookBus<GameServerHooks>(),
      logger: mockLogger,
      ...customOptions,
    });

    gameContext.addService(GameManagementService);
    await gameContext.init();

    const gameService = gameContext.getService(GameManagementService);

    // Test custom context access
    const contextInfo = gameService.getContextInfo();
    expect(contextInfo.maxPlayers).toBe(32);
    expect(contextInfo.antiCheat).toBe(false);
    expect(contextInfo.gameMode).toBe('casual');
    expect(contextInfo.startingCredits).toBe(500);

    // Test reward calculation
    expect(gameService.calculatePlayerReward('kill')).toBe(100);
    expect(gameService.calculatePlayerReward('win')).toBe(1000);
  });

  it('should handle custom events with type safety', async () => {
    const customOptions: GameServerOptions = {
      gameConfig: { maxPlayers: 16, mapRotation: ['dust2'], gameMode: 'ranked' },
      features: { antiCheat: true, voiceChat: true, spectatorMode: true },
      economy: { startingCredits: 2000, killReward: 500, winReward: 3000 },
    };

    const eventEmitter = new RPEventEmitter<GameServerEvents>();
    const gameContext = new GameServerContext({
      engineClient: mockEngineClient,
      eventEmitter,
      hookBus: new RPHookBus<GameServerHooks>(),
      logger: mockLogger,
      ...customOptions,
    });

    gameContext.addService(GameManagementService);
    await gameContext.init();

    const gameService = gameContext.getService(GameManagementService);

    // Emit custom events and verify they are handled with type safety
    eventEmitter.emit('playerJoined', {
      playerId: 'player1',
      username: 'TestPlayer',
      level: 25,
    });

    eventEmitter.emit('gameStarted', {
      gameId: 'game123',
      mode: 'pvp',
      playerCount: 8,
    });

    // Wait for event handlers to process
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Verify events were handled
    expect(gameService.playerJoinEvents).toHaveLength(1);
    expect(gameService.playerJoinEvents[0]).toEqual({
      playerId: 'player1',
      username: 'TestPlayer',
      level: 25,
    });

    expect(gameService.gameStartEvents).toHaveLength(1);
    expect(gameService.gameStartEvents[0]).toEqual({
      gameId: 'game123',
      mode: 'pvp',
      playerCount: 8,
    });
  });

  it('should handle custom hooks with type safety', async () => {
    const customOptions: GameServerOptions = {
      gameConfig: { maxPlayers: 8, mapRotation: ['mirage'], gameMode: 'casual' },
      features: { antiCheat: false, voiceChat: false, spectatorMode: false },
      economy: { startingCredits: 800, killReward: 200, winReward: 1500 },
    };

    const hookBus = new RPHookBus<GameServerHooks>();
    const gameContext = new GameServerContext({
      engineClient: mockEngineClient,
      eventEmitter: new RPEventEmitter<GameServerEvents>(),
      hookBus,
      logger: mockLogger,
      ...customOptions,
    });

    gameContext.addService(GameManagementService);
    await gameContext.init();

    const gameService = gameContext.getService(GameManagementService);

    // Add hook handlers with type safety
    const beforePlayerJoinHandler: GameServerHooks['beforePlayerJoin'] = (payload) => {
      expect(payload.playerId).toBeDefined();
      expect(payload.playerData.level).toBeGreaterThan(0);
      expect(typeof payload.playerData.vip).toBe('boolean');
      return payload.playerData.level >= 10; // Only allow players level 10+
    };

    const beforeGameStartHandler: GameServerHooks['beforeGameStart'] = (payload) => {
      expect(payload.gameId).toBeDefined();
      expect(Array.isArray(payload.playerIds)).toBe(true);
      return payload.playerIds.length >= 2; // Need at least 2 players
    };

    hookBus.on('beforePlayerJoin', beforePlayerJoinHandler);
    hookBus.on('beforeGameStart', beforeGameStartHandler);

    // Test player join with custom hooks
    const joinResult1 = await gameService.processPlayerJoin('lowLevel', { level: 5, vip: false });
    expect(joinResult1).toBe(false); // Should fail due to level < 10

    const joinResult2 = await gameService.processPlayerJoin('highLevel', {
      level: 25,
      vip: true,
    });
    expect(joinResult2).toBe(true); // Should succeed

    // Test game start with custom hooks
    await gameService.startGame('testGame', ['player1', 'player2', 'player3']);

    // Verify hook execution
    expect(gameService.hookResults.length).toBeGreaterThan(0);
    const beforeJoinHooks = gameService.hookResults.filter((r) => r.hook === 'beforePlayerJoin');
    expect(beforeJoinHooks).toHaveLength(2);

    const beforeGameStartHooks = gameService.hookResults.filter(
      (r) => r.hook === 'beforeGameStart',
    );
    expect(beforeGameStartHooks).toHaveLength(1);
  });

  it('should maintain type safety across service interactions', async () => {
    const customOptions: GameServerOptions = {
      gameConfig: {
        maxPlayers: 50,
        mapRotation: ['cache', 'overpass', 'cobble'],
        gameMode: 'ranked',
      },
      features: { antiCheat: true, voiceChat: true, spectatorMode: true },
      economy: { startingCredits: 1500, killReward: 400, winReward: 2000 },
    };

    const eventEmitter = new RPEventEmitter<GameServerEvents>();
    const hookBus = new RPHookBus<GameServerHooks>();

    const gameContext = new GameServerContext({
      engineClient: mockEngineClient,
      eventEmitter,
      hookBus,
      logger: mockLogger,
      ...customOptions,
    });

    gameContext.addService(GameManagementService);
    await gameContext.init();

    const gameService = gameContext.getService(GameManagementService);

    // Verify all types work together without any type assertions
    const contextInfo = gameService.getContextInfo();
    expect(contextInfo.maxPlayers).toBe(50);
    expect(contextInfo.gameMode).toBe('ranked');

    // Test event emission with full type checking
    eventEmitter.emit('scoreUpdated', {
      playerId: 'pro_player',
      score: 1500,
      rank: 1,
    });

    eventEmitter.emit('matchFinished', {
      gameId: 'championship_final',
      winnerId: 'pro_player',
      duration: 45000, // 45 seconds
    });

    // Test hook execution with complex payloads
    // Add a handler for beforeMatchEnd hook first
    hookBus.on('beforeMatchEnd', () => {
      // Mock handler that returns void
    });

    const hookResult = await hookBus.run('beforeMatchEnd', {
      gameId: 'championship_final',
      winnerCandidates: ['pro_player', 'rookie_player'],
    });

    // Hook result should return the original payload when handler returns void
    expect(hookResult).toEqual({
      gameId: 'championship_final',
      winnerCandidates: ['pro_player', 'rookie_player'],
    });

    // Verify service can access all custom context properties without type issues
    expect(gameService.calculatePlayerReward('kill')).toBe(400);
    expect(gameService.calculatePlayerReward('win')).toBe(2000);
    expect(gameContext.gameConfig.mapRotation).toContain('cache');
    expect(gameContext.features.spectatorMode).toBe(true);
  });
});
