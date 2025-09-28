/**
 * Tests for PlayerService
 */
import { MockLogger } from '../../../../test/mocks';

import { PlayerService } from './service';
import { ClientPlatformAdapter } from '../../natives/adapters/platform.adapter';
import { RPClientContext } from '../../core';

describe('PlayerService', () => {
  let mockLogger: MockLogger;
  let mockPlatformAdapter: jest.Mocked<ClientPlatformAdapter>;
  let playerService: PlayerService;
  let mockContext: jest.Mocked<RPClientContext>;

  beforeEach(() => {
    mockLogger = new MockLogger();
    mockPlatformAdapter = {
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
    } as unknown as jest.Mocked<ClientPlatformAdapter>;

    mockContext = {
      logger: {
        info: jest.fn(),
        debug: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        trace: jest.fn(),
      },
      platformAdapter: mockPlatformAdapter,
    } as unknown as jest.Mocked<RPClientContext>;

    playerService = new PlayerService(mockContext);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with logger, platform adapter, and event service', () => {
      expect(playerService).toBeInstanceOf(PlayerService);
    });

    it('should initialize player health to 100', () => {
      expect(playerService['playerHealth']).toBe(100);
    });
  });

  describe('getPlayerHealth', () => {
    it('should return current player health', () => {
      const health = playerService.getPlayerHealth();
      expect(health).toBe(100);
    });
  });

  describe('setPlayerHealth', () => {
    it('should update player health and call platform adapter', () => {
      playerService.setPlayerHealth(75);

      expect(playerService['playerHealth']).toBe(75);
      expect(mockPlatformAdapter.player.setPlayerHealth).toHaveBeenCalledWith(75);
    });

    it('should clamp health to valid range', () => {
      playerService.setPlayerHealth(150);
      expect(playerService['playerHealth']).toBe(100);

      playerService.setPlayerHealth(-10);
      expect(playerService['playerHealth']).toBe(0);
    });
  });

  describe('getPlayerId', () => {
    it('should delegate to platform adapter', () => {
      const playerId = playerService.getPlayerId();
      expect(mockPlatformAdapter.player.getPlayerId).toHaveBeenCalled();
      expect(playerId).toBe('player_123');
    });
  });

  describe('getPlayerPed', () => {
    it('should delegate to platform adapter', () => {
      const ped = playerService.getPlayerPed();
      expect(mockPlatformAdapter.player.getPlayerPed).toHaveBeenCalled();
      expect(ped).toBe(1);
    });
  });

  describe('setPlayerModel', () => {
    it('should delegate to platform adapter', async () => {
      await playerService.setPlayerModel('player_zero');
      expect(mockPlatformAdapter.player.setPlayerModel).toHaveBeenCalledWith('player_zero');
    });
  });

  describe('setPlayerControl', () => {
    it('should delegate to platform adapter', () => {
      playerService.setPlayerControl(true, 1);
      expect(mockPlatformAdapter.player.setPlayerControl).toHaveBeenCalledWith(true, 1);
    });
  });

  describe('setPlayerInvincible', () => {
    it('should delegate to platform adapter', () => {
      playerService.setPlayerInvincible(true);
      expect(mockPlatformAdapter.player.setPlayerInvincible).toHaveBeenCalledWith(true);
    });
  });

  describe('clearPlayerTasks', () => {
    it('should delegate to platform adapter', () => {
      playerService.clearPlayerTasks();
      expect(mockPlatformAdapter.player.clearPlayerTasks).toHaveBeenCalled();
    });
  });

  describe('clearPlayerWeapons', () => {
    it('should delegate to platform adapter', () => {
      playerService.clearPlayerWeapons();
      expect(mockPlatformAdapter.player.clearPlayerWeapons).toHaveBeenCalled();
    });
  });

  describe('clearPlayerWantedLevel', () => {
    it('should delegate to platform adapter', () => {
      playerService.clearPlayerWantedLevel();
      expect(mockPlatformAdapter.player.clearPlayerWantedLevel).toHaveBeenCalled();
    });
  });

  describe('isPlayerDead', () => {
    it('should delegate to platform adapter', () => {
      const isDead = playerService.isPlayerDead();
      expect(mockPlatformAdapter.player.isPlayerDead).toHaveBeenCalled();
      expect(isDead).toBe(false);
    });
  });

  describe('setEntityPosition', () => {
    it('should delegate to platform adapter', () => {
      const position = { x: 100, y: 200, z: 300 };
      playerService.setEntityPosition(1, position, true);
      expect(mockPlatformAdapter.player.setEntityPosition).toHaveBeenCalledWith(1, position, true);
    });
  });

  describe('setEntityHeading', () => {
    it('should delegate to platform adapter', () => {
      playerService.setEntityHeading(1, 90);
      expect(mockPlatformAdapter.player.setEntityHeading).toHaveBeenCalledWith(1, 90);
    });
  });

  describe('setEntityVisible', () => {
    it('should delegate to platform adapter', () => {
      playerService.setEntityVisible(1, false);
      expect(mockPlatformAdapter.player.setEntityVisible).toHaveBeenCalledWith(1, false);
    });
  });

  describe('setEntityCollision', () => {
    it('should delegate to platform adapter', () => {
      playerService.setEntityCollision(1, false, true);
      expect(mockPlatformAdapter.player.setEntityCollision).toHaveBeenCalledWith(1, false, true);
    });
  });

  describe('freezeEntityPosition', () => {
    it('should delegate to platform adapter', () => {
      playerService.freezeEntityPosition(1, true);
      expect(mockPlatformAdapter.player.freezeEntityPosition).toHaveBeenCalledWith(1, true);
    });
  });

  describe('getEntityCoords', () => {
    it('should delegate to platform adapter', () => {
      const coords = playerService.getEntityCoords(1);
      expect(mockPlatformAdapter.player.getEntityCoords).toHaveBeenCalledWith(1);
      expect(coords).toEqual({ x: 0, y: 0, z: 0 });
    });
  });

  describe('isEntityVisible', () => {
    it('should delegate to platform adapter', () => {
      const isVisible = playerService.isEntityVisible(1);
      expect(mockPlatformAdapter.player.isEntityVisible).toHaveBeenCalledWith(1);
      expect(isVisible).toBe(true);
    });
  });

  describe('isEntityDead', () => {
    it('should delegate to platform adapter', () => {
      const isDead = playerService.isEntityDead(1);
      expect(mockPlatformAdapter.player.isEntityDead).toHaveBeenCalledWith(1);
      expect(isDead).toBe(false);
    });
  });

  describe('isEntityPositionFrozen', () => {
    it('should delegate to platform adapter', () => {
      const isFrozen = playerService.isEntityPositionFrozen(1);
      expect(mockPlatformAdapter.player.isEntityPositionFrozen).toHaveBeenCalledWith(1);
      expect(isFrozen).toBe(false);
    });
  });

  describe('getPlayerFromServerId', () => {
    it('should delegate to platform adapter', () => {
      const playerId = playerService.getPlayerFromServerId('123');
      expect(mockPlatformAdapter.player.getPlayerFromServerId).toHaveBeenCalledWith('123');
      expect(playerId).toBe(1);
    });
  });

  describe('resurrectLocalPlayer', () => {
    it('should delegate to platform adapter', () => {
      const position = { x: 100, y: 200, z: 300 };
      playerService.resurrectLocalPlayer(position, 90);
      expect(mockPlatformAdapter.player.resurrectLocalPlayer).toHaveBeenCalledWith(position, 90);
    });
  });

  describe('event handlers', () => {
    describe('onPlayerSpawn', () => {
      it('should handle player spawn event', () => {
        const playerId = 123;
        const position = { x: 100, y: 200, z: 300 };

        (playerService as any).onPlayerSpawned({ id: playerId, position });

        expect(mockContext.logger.info).toHaveBeenCalledWith('Player spawned:', {
          id: playerId,
          position,
        });
      });
    });

    describe('onPlayerDeath', () => {
      it('should handle player death event', () => {
        const playerId = 123;
        const killerId = 456;
        const weaponHash = 789;

        (playerService as any).onPlayerDied({ playerId, killerId, weaponHash });

        expect(mockContext.logger.info).toHaveBeenCalledWith('Player died:', {
          playerId,
          killerId,
          weaponHash,
        });
      });

      it('should handle player death without killer', () => {
        const playerId = 123;

        (playerService as any).onPlayerDied({ playerId });

        expect(mockContext.logger.info).toHaveBeenCalledWith('Player died:', { playerId });
      });
    });
  });

  describe('integration scenarios', () => {
    it('should handle complete player lifecycle', async () => {
      await playerService.setPlayerModel('player_zero');
      expect(mockPlatformAdapter.player.setPlayerModel).toHaveBeenCalledWith('player_zero');

      playerService.setPlayerHealth(75);
      expect(playerService.getPlayerHealth()).toBe(75);

      (playerService as any).onPlayerDied({ playerId: 123, killerId: 456, weaponHash: 789 });
      expect(mockContext.logger.info).toHaveBeenCalledWith('Player died:', {
        playerId: 123,
        killerId: 456,
        weaponHash: 789,
      });
    });
  });

  describe('error handling', () => {
    it('should handle platform adapter errors gracefully', async () => {
      const error = new Error('Platform adapter error');
      (mockPlatformAdapter.player.setPlayerModel as jest.Mock).mockRejectedValue(error);

      await expect(playerService.setPlayerModel('player_zero')).rejects.toThrow(
        'Platform adapter error',
      );
    });

    it('should handle health clamping errors gracefully', () => {
      playerService.setPlayerHealth(-50);
      expect(playerService['playerHealth']).toBe(0);

      playerService.setPlayerHealth(150);
      expect(playerService['playerHealth']).toBe(100);
    });
  });
});
