import { HealthService } from './service';
import { MockLogger } from '../../../../test/mocks';
import { ClientPlatformAdapter } from '../../natives/adapters';
import { RPClientContext } from '../../core/context';
import { RPHookBus } from '../../../core/bus/hook-bus';
import { RPClientHooks } from '../../core/hooks/hooks';
import { EventService } from '../event/service';

// Mock platform adapter
const mockPlatformAdapter = {
  player: {
    getPlayerPed: jest.fn().mockReturnValue(1),
    getPlayerHealth: jest.fn().mockReturnValue(100),
    setPlayerHealth: jest.fn(),
    isPlayerDead: jest.fn().mockReturnValue(false),
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
  core: {
    wait: jest.fn().mockResolvedValue(undefined),
    getGameTimer: jest.fn().mockReturnValue(1000),
    getHashKey: jest.fn().mockReturnValue(12345),
  },
  camera: {
    getGameplayCamCoords: jest.fn().mockReturnValue({ x: 0, y: 0, z: 0 }),
    getGameplayCamRot: jest.fn().mockReturnValue({ x: 0, y: 0, z: 0 }),
  },
} as unknown as jest.Mocked<ClientPlatformAdapter>;

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
} as unknown as jest.Mocked<EventService>;

// Mock context
const mockContext = {
  logger: new MockLogger(),
  hookBus: new RPHookBus<RPClientHooks>(),
  platformAdapter: mockPlatformAdapter,
  getService: jest.fn().mockReturnValue(mockEventService),
} as unknown as RPClientContext<any, RPClientHooks>;

describe('HealthService', () => {
  let healthService: HealthService;

  beforeEach(() => {
    jest.clearAllMocks();
    healthService = new HealthService(mockContext);
  });

  describe('initialization', () => {
    it('should initialize with correct initial health', async () => {
      (mockPlatformAdapter.player.getPlayerHealth as jest.Mock).mockReturnValue(150);

      await healthService.init();

      expect(mockPlatformAdapter.player.getPlayerHealth).toHaveBeenCalled();
      expect(healthService.getLastHealth()).toBe(150);
    });

    it('should set initialized flag after init', async () => {
      await healthService.init();
      expect(healthService['isInitialized']).toBe(true);
    });
  });

  describe('disposal', () => {
    it('should dispose correctly', async () => {
      await healthService.init();
      await healthService.dispose();

      expect(healthService['isInitialized']).toBe(false);
    });
  });

  describe('entity damage handling', () => {
    beforeEach(async () => {
      await healthService.init();
    });

    it('should process damage for local player', () => {
      const playerPed = 1;
      const attacker = 2;
      const weaponHash = 12345;
      const damage = 25;

      // Set initial health to 100
      healthService['lastHealth'] = 100;

      (mockPlatformAdapter.player.getPlayerPed as jest.Mock).mockReturnValue(playerPed);
      (mockPlatformAdapter.player.getPlayerHealth as jest.Mock).mockReturnValue(75); // Health after damage

      healthService['onEntityDamage'](playerPed, attacker, weaponHash, damage);

      expect(mockEventService.emitToServer).toHaveBeenCalledWith('playerDamage', {
        attackerId: attacker,
        damageAmount: 25, // 100 - 75 = 25
        weaponHash,
        isFatal: false,
        timestamp: expect.any(Number),
      });
    });

    it('should not process damage for other entities', () => {
      const otherPed = 2;
      const attacker = 3;
      const weaponHash = 12345;
      const damage = 25;

      (mockPlatformAdapter.player.getPlayerPed as jest.Mock).mockReturnValue(1);

      healthService['onEntityDamage'](otherPed, attacker, weaponHash, damage);

      expect(mockEventService.emitToServer).not.toHaveBeenCalled();
    });

    it('should handle fatal damage correctly', () => {
      const playerPed = 1;
      const attacker = 2;
      const weaponHash = 12345;
      const damage = 100;

      // Set initial health to 100
      healthService['lastHealth'] = 100;

      (mockPlatformAdapter.player.getPlayerPed as jest.Mock).mockReturnValue(playerPed);
      (mockPlatformAdapter.player.getPlayerHealth as jest.Mock).mockReturnValue(0); // Health after fatal damage

      healthService['onEntityDamage'](playerPed, attacker, weaponHash, damage);

      expect(mockEventService.emitToServer).toHaveBeenCalledWith('playerDamage', {
        attackerId: attacker,
        damageAmount: 100, // 100 - 0 = 100
        weaponHash,
        isFatal: true,
        timestamp: expect.any(Number),
      });
    });

    it('should not process damage if not initialized', () => {
      healthService['isInitialized'] = false;

      healthService['onEntityDamage'](1, 2, 12345, 25);

      expect(mockEventService.emitToServer).not.toHaveBeenCalled();
    });
  });

  describe('health set handling', () => {
    beforeEach(async () => {
      await healthService.init();
    });

    it('should set player health when receiving server event', () => {
      const newHealth = 200;

      healthService['onHealthSet'](newHealth);

      expect(mockPlatformAdapter.player.setPlayerHealth).toHaveBeenCalledWith(newHealth);
      expect(healthService.getLastHealth()).toBe(newHealth);
    });

    it('should not set health if not initialized', () => {
      healthService['isInitialized'] = false;

      healthService['onHealthSet'](200);

      expect(mockPlatformAdapter.player.setPlayerHealth).not.toHaveBeenCalled();
    });
  });

  describe('health validation handling', () => {
    beforeEach(async () => {
      await healthService.init();
    });

    it('should correct health when mismatch detected', () => {
      const expectedHealth = 150;
      const currentHealth = 100;

      (mockPlatformAdapter.player.getPlayerHealth as jest.Mock).mockReturnValue(currentHealth);

      healthService['onHealthValidate'](expectedHealth);

      expect(mockPlatformAdapter.player.setPlayerHealth).toHaveBeenCalledWith(expectedHealth);
      expect(healthService.getLastHealth()).toBe(expectedHealth);
    });

    it('should not correct health when values match', () => {
      const expectedHealth = 150;
      const currentHealth = 150;

      (mockPlatformAdapter.player.getPlayerHealth as jest.Mock).mockReturnValue(currentHealth);

      healthService['onHealthValidate'](expectedHealth);

      expect(mockPlatformAdapter.player.setPlayerHealth).not.toHaveBeenCalled();
    });

    it('should not validate health if not initialized', () => {
      // Clear previous calls
      jest.clearAllMocks();

      // Create a new service instance that's not initialized
      const uninitializedService = new HealthService(mockContext);
      uninitializedService['isInitialized'] = false;

      uninitializedService['onHealthValidate'](150);

      expect(mockPlatformAdapter.player.getPlayerHealth).not.toHaveBeenCalled();
    });
  });

  describe('utility methods', () => {
    beforeEach(async () => {
      await healthService.init();
    });

    it('should get current health', () => {
      const currentHealth = 125;
      (mockPlatformAdapter.player.getPlayerHealth as jest.Mock).mockReturnValue(currentHealth);

      const result = healthService.getCurrentHealth();

      expect(result).toBe(currentHealth);
    });

    it('should get last health', () => {
      const lastHealth = 100;
      healthService['lastHealth'] = lastHealth;

      const result = healthService.getLastHealth();

      expect(result).toBe(lastHealth);
    });

    it('should check if player is dead', () => {
      (mockPlatformAdapter.player.isPlayerDead as jest.Mock).mockReturnValue(true);

      const result = healthService.isPlayerDead();

      expect(result).toBe(true);
    });

    it('should manually set player health', () => {
      const newHealth = 200;

      healthService.setPlayerHealth(newHealth);

      expect(mockPlatformAdapter.player.setPlayerHealth).toHaveBeenCalledWith(newHealth);
      expect(healthService.getLastHealth()).toBe(newHealth);
    });

    it('should request health validation from server', () => {
      const currentHealth = 150;
      (mockPlatformAdapter.player.getPlayerHealth as jest.Mock).mockReturnValue(currentHealth);

      healthService.requestHealthValidation();

      expect(mockEventService.emitToServer).toHaveBeenCalledWith('player:health:validate', {
        currentHealth,
        timestamp: expect.any(Number),
      });
    });
  });

  describe('error handling', () => {
    beforeEach(async () => {
      await healthService.init();
    });

    it('should handle errors in damage processing gracefully', () => {
      const playerPed = 1;
      const attacker = 2;
      const weaponHash = 12345;
      const damage = 25;

      (mockPlatformAdapter.player.getPlayerPed as jest.Mock).mockReturnValue(playerPed);
      (mockPlatformAdapter.player.getPlayerHealth as jest.Mock).mockImplementation(() => {
        throw new Error('Platform error');
      });

      // Should not throw - the service should handle the error internally
      expect(() => {
        healthService['onEntityDamage'](playerPed, attacker, weaponHash, damage);
      }).not.toThrow();
    });
  });
});
