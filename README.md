# RolePlayX Engine Framework

A TypeScript framework for building custom game servers on the RolePlayX Engine platform. This framework provides
the foundation for creating immersive roleplay experiences with type-safe event handling, service architecture, and
seamless engine integration.

**Note**: This framework is designed to be integrated into existing game environments and cannot be used standalone.

## Architecture Overview

The framework is built around a modular, event-driven architecture with the following core components:

### Core Components

- **RPServer**: The main server orchestrator that manages the entire application lifecycle
- **RPServerContext**: Dependency injection container providing service management and infrastructure access
- **Event System**: Type-safe event emitting and handling with custom event support
- **Hook System**: Middleware-style hooks for intercepting and modifying application flow
- **Service Layer**: Domain-specific business logic organized into services
- **API Layer**: RESTful HTTP endpoints with automatic validation and error handling

### Framework Structure

```
src/
├── core/                 # Core infrastructure
│   ├── bus/             # Event emitter and hook bus
│   └── logger/          # Logging utilities
├── server/              # Server components
│   ├── core/            # Server context and services
│   ├── domains/         # Business logic services
│   ├── api/             # HTTP API endpoints
│   └── socket/          # WebSocket communication
```

## Installation

```bash
npm install @roleplayx/engine-framework
```

## Basic Integration

### 1. Create Your Game Server

```typescript
import {RPServer, RPServerNatives, RPServerOptions} from '@roleplayx/engine-framework';

// Server configuration
const serverOptions: RPServerOptions = {
    serverId: 'your-server-id',
    apiUrl: 'https://api.eu-central-nova.roleplayx.com',
    socketUrl: 'wss://socket.eu-central-nova.roleplayx.com',
    apiKeyId: 'your-api-key-id',
    apiKeySecret: 'your-api-secret',
    timeout: 10000,
    api: {
        port: 8080,
        host: '0.0.0.0',
        gamemodeApiKeyHash: 'your-gamemode-api-key-hash'
    }
};

// Server natives (optional integrations)
const natives: RPServerNatives = {
    // Add custom natives if needed
};

// Create and start server
const server = RPServer.create(serverOptions, natives);
await server.start();
```

### 2. Create Custom Services

```typescript
import {RPServerService, OnServer, RPSessionStarted} from '@roleplayx/engine-framework';

export class VehicleService extends RPServerService {
    private vehicles = new Map();

    @OnServer('sessionAuthorized')
    async onSessionAuthorized(event: { sessionId: string; account: { id: string } }) {
        const vehicles = await this.getPlayerVehicles(event.account.id);
        vehicles.forEach(vehicle => this.spawnVehicle(vehicle));
    }

    public spawnVehicle(vehicleData) {
        this.vehicles.set(vehicleData.id, vehicleData);
        this.logger.info(`Spawned vehicle ${vehicleData.model}`);
    }

    private async getPlayerVehicles(accountId: string) {
        return [];
    }
}
```

## Custom Types Integration

The framework supports full type safety for custom events, hooks, and context options. Here's how to extend the base
types for a roleplay server:

### 1. Define Custom Events

```typescript
import {RPServerEvents} from '@roleplayx/engine-framework';

// Extend base events with your custom events
interface RoleplayServerEvents extends RPServerEvents {
    // Player events
    playerSpawned: { playerId: string; position: { x: number; y: number; z: number } };
    playerDied: { playerId: string; killerId?: string; weapon: string };

    // Vehicle events
    vehiclePurchased: { playerId: string; vehicleId: string; model: string; price: number };
    vehicleDestroyed: { vehicleId: string; playerId: string };

    // Economy events
    moneyTransfer: { fromId: string; toId: string; amount: number; reason: string };
    jobCompleted: { playerId: string; jobType: string; payment: number };

    // Property events
    propertyPurchased: { playerId: string; propertyId: string; price: number };
    propertyEntered: { playerId: string; propertyId: string; owner: string };
}
```

### 2. Define Custom Hooks

```typescript
import {RPServerHooks} from '@roleplayx/engine-framework';

// Extend base hooks with your middleware hooks
interface RoleplayServerHooks extends RPServerHooks {
    // Player lifecycle hooks
    beforePlayerSpawn: (payload: {
        playerId: string;
        position: { x: number; y: number; z: number };
    }) => boolean | Promise<boolean>;

    afterPlayerDeath: (payload: {
        playerId: string;
        killerId?: string;
        weapon: string;
    }) => void | Promise<void>;

    // Economy validation hooks
    beforeMoneyTransfer: (payload: {
        fromId: string;
        toId: string;
        amount: number;
    }) => boolean | Promise<boolean>;

    // Job system hooks
    beforeJobPayout: (payload: {
        playerId: string;
        jobType: string;
        basePayment: number;
    }) => number | Promise<number>; // Can modify the payment amount
}
```

### 3. Define Custom Context Options

```typescript
// Define your server's custom configuration
interface RoleplayServerOptions {
    gameplay: {
        maxPlayers: number;
        enablePvP: boolean;
        respawnTime: number;
        startingMoney: number;
    };
    economy: {
        salaryInterval: number;
        taxRate: number;
        jobMultipliers: Record<string, number>;
    };
    world: {
        weatherCycle: boolean;
        timeCycle: boolean;
        defaultSpawn: { x: number; y: number; z: number };
    };

    // Index signature for extensibility
    [key: string]: unknown;
}
```

### 4. Create Custom Context

```typescript
import {RPServerContext, RPServerContextOptions} from '@roleplayx/engine-framework';

class RoleplayServerContext extends RPServerContext<
    RoleplayServerOptions,
    RoleplayServerEvents,
    RoleplayServerHooks
> {
    public readonly gameplay: RoleplayServerOptions['gameplay'];
    public readonly economy: RoleplayServerOptions['economy'];
    public readonly world: RoleplayServerOptions['world'];

    constructor(
        options: RPServerContextOptions<RoleplayServerEvents, RoleplayServerHooks> & RoleplayServerOptions
    ) {
        super(options);
        this.gameplay = options.gameplay;
        this.economy = options.economy;
        this.world = options.world;
    }

    // Custom helper methods
    public getMaxPlayers(): number {
        return this.gameplay.maxPlayers;
    }

    public calculateJobPayout(baseAmount: number, jobType: string): number {
        const multiplier = this.economy.jobMultipliers[jobType] || 1;
        const afterTax = baseAmount * (1 - this.economy.taxRate);
        return afterTax * multiplier;
    }

    public isPvPEnabled(): boolean {
        return this.gameplay.enablePvP;
    }
}
```

### 5. Create Typed Services

```typescript
import {RPServerService} from '@roleplayx/engine-framework';

// Define server types for type safety
interface RoleplayServerTypes {
    events: RoleplayServerEvents;
    hooks: RoleplayServerHooks;
    options: RoleplayServerOptions;
}

export class PlayerService extends RPServerService<RoleplayServerTypes> {
    private roleplayContext: RoleplayServerContext;

    constructor(context: RoleplayServerContext) {
        super(context);
        this.roleplayContext = context;
    }

    @OnServer<RoleplayServerEvents>('playerSpawned')
    public async onPlayerSpawned(payload: RoleplayServerEvents['playerSpawned']): Promise<void> {
        const maxPlayers = this.roleplayContext.getMaxPlayers();
        this.logger.info(`Player spawned (${this.getOnlineCount()}/${maxPlayers})`);

        // Give starting money to new players
        const startingMoney = this.roleplayContext.gameplay.startingMoney;
        await this.givePlayerMoney(payload.playerId, startingMoney);
    }

    public async processPlayerDeath(playerId: string, weapon: string, killerId?: string): Promise<void> {
        // Execute before hook - can prevent death
        const allowDeath = await this.hookBus.run('beforePlayerDeath', {
            playerId,
            killerId,
            weapon
        });

        if (allowDeath === false) {
            this.logger.info(`Player death prevented by hook: ${playerId}`);
            return;
        }

        // Emit the death event
        this.eventEmitter.emit('playerDied', {playerId, killerId, weapon});

        // Execute after hook for cleanup/notifications
        await this.hookBus.run('afterPlayerDeath', {playerId, killerId, weapon});

        // Schedule respawn
        const respawnTime = this.roleplayContext.gameplay.respawnTime;
        setTimeout(() => this.respawnPlayer(playerId), respawnTime * 1000);
    }

    private async givePlayerMoney(playerId: string, amount: number): Promise<void> {
        // Your money giving logic
    }

    private async respawnPlayer(playerId: string): Promise<void> {
        const spawnPos = this.roleplayContext.world.defaultSpawn;
        this.eventEmitter.emit('playerSpawned', {playerId, position: spawnPos});
    }

    private getOnlineCount(): number {
        // Your online player count logic
        return 0;
    }
}
```

### 6. Initialize Your Custom Server

```typescript
// Create server with custom context
const customOptions: RoleplayServerOptions = {
    gameplay: {
        maxPlayers: 200,
        enablePvP: true,
        respawnTime: 30,
        startingMoney: 5000
    },
    economy: {
        salaryInterval: 300, // 5 minutes
        taxRate: 0.15, // 15% tax
        jobMultipliers: {
            police: 1.5,
            medic: 1.3,
            taxi: 1.0,
            mechanic: 1.2
        }
    },
    world: {
        weatherCycle: true,
        timeCycle: true,
        defaultSpawn: {x: -1037.0, y: -2737.0, z: 20.0}
    }
};

const customNatives: RPServerNatives<RoleplayServerOptions, RoleplayServerEvents, RoleplayServerHooks> = {
    customContext: {
        type: RoleplayServerContext,
        options: customOptions
    }
};

// Create server with custom types
const server = RPServer.create(serverOptions, customNatives);
const context = server.getContext<RoleplayServerContext>();

// Register your custom services
context
    .addService(PlayerService)
    .addService(VehicleService)
    .addService(EconomyService);

await server.start();
```

## Hook System Usage

The hook system allows you to intercept and modify the application flow:

```typescript
export class AntiCheatService extends RPServerService<RoleplayServerTypes> {
    async init() {
        // Register hooks to validate actions
        this.hookBus.on('beforeMoneyTransfer', this.validateMoneyTransfer.bind(this));
        this.hookBus.on('beforeJobPayout', this.calculateBonuses.bind(this));
    }

    private async validateMoneyTransfer(payload: {
        fromId: string;
        toId: string;
        amount: number;
    }): Promise<boolean> {
        // Validate the money transfer
        if (payload.amount <= 0 || payload.amount > 1000000) {
            this.logger.warn(`Suspicious money transfer blocked: ${payload.amount}`);
            return false; // Block the transfer
        }
        return true; // Allow the transfer
    }

    private async calculateBonuses(payload: {
        playerId: string;
        jobType: string;
        basePayment: number;
    }): Promise<number> {
        // Apply bonuses based on player performance
        const bonus = await this.getPlayerPerformanceBonus(payload.playerId);
        return payload.basePayment + bonus;
    }

    private async getPlayerPerformanceBonus(playerId: string): Promise<number> {
        // Your bonus calculation logic
        return 100;
    }
}
```

## Session Management

The framework provides built-in session management. Here's an example using the SessionService:

```typescript
import {SessionService} from '@roleplayx/engine-framework';

export class AuthenticationService extends RPServerService {
    @OnServer('sessionAuthorized')
    async onSessionAuthorized(event: { sessionId: string; account: { id: string; username: string } }) {
        this.logger.info(`Player authenticated: ${event.account.username} (${event.account.id})`);
        await this.loadPlayerData(event.account.id);
    }

    private async loadPlayerData(accountId: string) {
        // Load player data from your database
        const playerData = await this.getPlayerData(accountId);
        // Initialize player in your game world
    }

    private async getPlayerData(accountId: string) {
        // Your database query logic
        return {id: accountId, level: 1};
    }
}
```

## Built-in Events

The framework provides numerous built-in events that you can listen to. For a complete list of available events and
their payloads, see:

📄 **[RPServerEvents Interface](src/server/core/events/events.ts)** - Complete event definitions with TypeScript types

## Built-in Hooks

The framework provides built-in hooks for intercepting application flow. For the current list of available hooks and
their signatures, see:

📄 **[RPServerHooks Interface](src/server/core/hooks/hooks.ts)** - Complete hook definitions with TypeScript types

## API Controllers

Create RESTful endpoints using API controllers:

```typescript
import {ApiController, ApiRoute} from '@roleplayx/engine-framework';

export class GameController extends ApiController {
    @ApiRoute('POST', '/game/start')
    async startGame(request, reply) {
        // Your game start logic
        return {gameId: 'game-123', status: 'started'};
    }

    @ApiRoute('GET', '/game/status/:gameId')
    async getGameStatus(request, reply) {
        const {gameId} = request.params;
        // Your status check logic
        return {gameId, status: 'in-progress'};
    }
}

// Register the controller
server.registerController(GameController);
```

## Development

```bash
npm run build    # Build the project
npm run lint     # Run linting
npm run test     # Run tests
```

## Documentation

For detailed API documentation and advanced examples, visit our [documentation site](https://docs.roleplayx.com).

## Support

- GitHub Issues: [Report bugs and issues](https://github.com/roleplay-x/engine-framework/issues)

## License

MIT License - see LICENSE file for details.