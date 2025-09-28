/**
 * Tests for event decorators
 */
import { OnClient, OnServer, OnGameEvent, getEventHandlers } from './decorators';

describe('Event Decorators', () => {
  describe('@OnClient', () => {
    it('should mark method as client event handler', () => {
      class TestService {
        @OnClient('player:spawned')
        handleTestEvent(data: any) {
          return data;
        }
      }

      const instance = new TestService();
      const handlers = getEventHandlers(instance);

      expect(handlers).toHaveProperty('player:spawned');
      expect(handlers['player:spawned']).toContain(instance.handleTestEvent);
    });

    it('should support multiple client event handlers', () => {
      class TestService {
        @OnClient('player:died')
        handleEvent1(data: any) {
          return data;
        }

        @OnClient('player:healthChanged')
        handleEvent2(data: any) {
          return data;
        }
      }

      const instance = new TestService();
      const handlers = getEventHandlers(instance);

      expect(handlers).toHaveProperty('player:died');
      expect(handlers).toHaveProperty('player:healthChanged');
      expect(handlers['player:died']).toContain(instance.handleEvent1);
      expect(handlers['player:healthChanged']).toContain(instance.handleEvent2);
    });

    it('should work with private methods', () => {
      class TestService {
        @OnClient('camera:set')
        private handlePrivateEvent(data: any) {
          return data;
        }
      }

      const instance = new TestService();
      const handlers = getEventHandlers(instance);

      expect(handlers).toHaveProperty('camera:set');
      expect(handlers['camera:set']).toContain(instance['handlePrivateEvent']);
    });
  });

  describe('@OnServer', () => {
    it('should mark method as server event handler with server: prefix', () => {
      class TestService {
        @OnServer('health:set')
        handleTestEvent(data: any) {
          return data;
        }
      }

      const instance = new TestService();
      const handlers = getEventHandlers(instance);

      expect(handlers).toHaveProperty('server:health:set');
      expect(handlers['server:health:set']).toContain(instance.handleTestEvent);
    });

    it('should support multiple server event handlers', () => {
      class TestService {
        @OnServer('health:validate')
        handleEvent1(data: any) {
          return data;
        }

        @OnServer('spawn:execute')
        handleEvent2(data: any) {
          return data;
        }
      }

      const instance = new TestService();
      const handlers = getEventHandlers(instance);

      expect(handlers).toHaveProperty('server:health:validate');
      expect(handlers).toHaveProperty('server:spawn:execute');
      expect(handlers['server:health:validate']).toContain(instance.handleEvent1);
      expect(handlers['server:spawn:execute']).toContain(instance.handleEvent2);
    });
  });

  describe('@OnGameEvent', () => {
    it('should mark method as game event handler with game: prefix', () => {
      class TestService {
        @OnGameEvent('entityDamage')
        handleEntityDamage(victim: number, attacker: number, weaponHash: number, damage: number) {
          return { victim, attacker, weaponHash, damage };
        }
      }

      const instance = new TestService();
      const handlers = getEventHandlers(instance);

      expect(handlers).toHaveProperty('game:entityDamage');
      expect(handlers['game:entityDamage']).toContain(instance.handleEntityDamage);
    });

    it('should support multiple game event handlers', () => {
      class TestService {
        @OnGameEvent('entityDamage')
        handleEntityDamage(victim: number, attacker: number, weaponHash: number, damage: number) {
          return { victim, attacker, weaponHash, damage };
        }
      }

      const instance = new TestService();
      const handlers = getEventHandlers(instance);

      expect(handlers).toHaveProperty('game:entityDamage');
      expect(handlers['game:entityDamage']).toContain(instance.handleEntityDamage);
    });
  });

  describe('getEventHandlers', () => {
    it('should return all event handlers from an instance', () => {
      class TestService {
        @OnClient('spawn:execute')
        handleClientEvent(data: any) {
          return data;
        }

        @OnServer('spawn:failed')
        handleServerEvent(data: any) {
          return data;
        }

        @OnGameEvent('entityDamage')
        handleGameEvent(data: any) {
          return data;
        }

        regularMethod() {
          return 'regular';
        }
      }

      const instance = new TestService();
      const handlers = getEventHandlers(instance);

      expect(handlers).toHaveProperty('spawn:execute');
      expect(handlers).toHaveProperty('server:spawn:failed');
      expect(handlers).toHaveProperty('game:entityDamage');
      expect(handlers).not.toHaveProperty('regularMethod');
    });

    it('should return empty object for instance with no event handlers', () => {
      class TestService {
        regularMethod() {
          return 'regular';
        }
      }

      const instance = new TestService();
      const handlers = getEventHandlers(instance);

      expect(handlers).toEqual({});
    });

    it('should handle inheritance correctly', () => {
      class BaseService {
        @OnClient('camera:release')
        handleBaseEvent(data: any) {
          return data;
        }
      }

      class DerivedService extends BaseService {
        @OnClient('camera:set')
        handleDerivedEvent(data: any) {
          return data;
        }
      }

      const instance = new DerivedService();
      const handlers = getEventHandlers(instance);

      expect(handlers).toHaveProperty('camera:release');
      expect(handlers).toHaveProperty('camera:set');
      expect(handlers['camera:release']).toContain(instance.handleBaseEvent);
      expect(handlers['camera:set']).toContain(instance.handleDerivedEvent);
    });

    it('should handle method overrides correctly', () => {
      class BaseService {
        @OnClient('camera:set')
        handleEvent(data: any) {
          return 'base';
        }
      }

      class DerivedService extends BaseService {
        @OnClient('camera:release')
        handleEvent(data: any) {
          return 'derived';
        }
      }

      const instance = new DerivedService();
      const handlers = getEventHandlers(instance);

      expect(handlers).toHaveProperty('camera:release');
      expect(handlers['camera:release']).toContain(instance.handleEvent);
      expect(handlers['camera:release'][0]()).toBe('derived');
    });
  });

  describe('integration scenarios', () => {
    it('should work with real service class', () => {
      class PlayerService {
        @OnClient('player:ready')
        onPlayerReady(data: any) {
          console.log('Player ready:', data);
        }

        @OnServer('playerJoined')
        onPlayerData(data: any) {
          console.log('Player data received:', data);
        }

        @OnGameEvent('entityDamage')
        onEntityDamage(victim: number, attacker: number, weaponHash: number, damage: number) {
          console.log('Entity damage:', { victim, attacker, weaponHash, damage });
        }

        @OnGameEvent('entityDamage')
        onEntityDamage2(victim: number, attacker: number, weaponHash: number, damage: number) {
          console.log('Entity damage:', { victim, attacker, weaponHash, damage });
        }

        getPlayerHealth() {
          return 100;
        }
      }

      const playerService = new PlayerService();
      const handlers = getEventHandlers(playerService);

      expect(handlers).toHaveProperty('player:ready');
      expect(handlers).toHaveProperty('server:playerJoined');
      expect(handlers).toHaveProperty('game:entityDamage');

      expect(handlers).not.toHaveProperty('getPlayerHealth');

      expect(handlers['player:ready']).toContain(playerService.onPlayerReady);
      expect(handlers['server:playerJoined']).toContain(playerService.onPlayerData);
      expect(handlers['game:entityDamage']).toContain(playerService.onEntityDamage);
    });

    it('should handle complex inheritance scenarios', () => {
      class BaseService {
        @OnClient('player:firstInitCompleted')
        handleBaseClientEvent(data: any) {
          return 'base client';
        }

        @OnServer('playerLeft')
        handleBaseServerEvent(data: any) {
          return 'base server';
        }
      }

      class MiddleService extends BaseService {
        @OnClient('spawn:failed')
        handleMiddleClientEvent(data: any) {
          return 'middle client';
        }

        @OnGameEvent('entityDamage')
        handleMiddleGameEvent(data: any) {
          return 'middle game';
        }
      }

      class FinalService extends MiddleService {
        @OnClient('player:initialize')
        handleFinalClientEvent(data: any) {
          return 'final client';
        }

        @OnServer('camera:set')
        handleFinalServerEvent(data: any) {
          return 'final server';
        }

        @OnGameEvent('entityDamage')
        handleFinalGameEvent(data: any) {
          return 'final game';
        }
      }

      const instance = new FinalService();
      const handlers = getEventHandlers(instance);

      expect(handlers).toHaveProperty('player:firstInitCompleted');
      expect(handlers).toHaveProperty('server:playerLeft');
      expect(handlers).toHaveProperty('spawn:failed');
      expect(handlers).toHaveProperty('game:entityDamage');
      expect(handlers).toHaveProperty('player:initialize');
      expect(handlers).toHaveProperty('server:camera:set');
      expect(handlers).toHaveProperty('game:entityDamage');

      expect(handlers['player:firstInitCompleted']).toContain(instance.handleBaseClientEvent);
      expect(handlers['server:playerLeft']).toContain(instance.handleBaseServerEvent);
      expect(handlers['spawn:failed']).toContain(instance.handleMiddleClientEvent);
      expect(handlers['game:entityDamage']).toContain(instance.handleMiddleGameEvent);
      expect(handlers['player:initialize']).toContain(instance.handleFinalClientEvent);
      expect(handlers['server:camera:set']).toContain(instance.handleFinalServerEvent);
      expect(handlers['game:entityDamage']).toContain(instance.handleFinalGameEvent);
    });
  });

  describe('error handling', () => {
    it('should handle invalid event names gracefully', () => {
      class TestService {
        @OnClient('player:spawned')
        handleEmptyEvent(data: any) {
          return data;
        }

        @OnServer('camera:release')
        handleWhitespaceEvent(data: any) {
          return data;
        }
      }

      const instance = new TestService();
      const handlers = getEventHandlers(instance);

      expect(handlers).toHaveProperty('player:spawned');
      expect(handlers).toHaveProperty('server:camera:release');
    });

    it('should handle duplicate event names gracefully', () => {
      class TestService {
        @OnClient('player:died')
        handleDuplicateEvent1(data: any) {
          return 'first';
        }

        @OnClient('player:died')
        handleDuplicateEvent2(data: any) {
          return 'second';
        }
      }

      const instance = new TestService();
      const handlers = getEventHandlers(instance);

      expect(handlers).toHaveProperty('player:died');
      expect(handlers['player:died']).toHaveLength(2);
      expect(handlers['player:died']).toContain(instance.handleDuplicateEvent1);
      expect(handlers['player:died']).toContain(instance.handleDuplicateEvent2);
    });
  });
});
