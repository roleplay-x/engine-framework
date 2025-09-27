/**
 * Tests for event decorators
 */
import { OnClient, OnServer, OnGameEvent, getEventHandlers } from './decorators';

describe('Event Decorators', () => {
  describe('@OnClient', () => {
    it('should mark method as client event handler', () => {
      class TestService {
        @OnClient('testEvent')
        handleTestEvent(data: any) {
          return data;
        }
      }

      const instance = new TestService();
      const handlers = getEventHandlers(instance);

      expect(handlers).toHaveProperty('testEvent');
      expect(handlers['testEvent']).toContain(instance.handleTestEvent);
    });

    it('should support multiple client event handlers', () => {
      class TestService {
        @OnClient('event1')
        handleEvent1(data: any) {
          return data;
        }

        @OnClient('event2')
        handleEvent2(data: any) {
          return data;
        }
      }

      const instance = new TestService();
      const handlers = getEventHandlers(instance);

      expect(handlers).toHaveProperty('event1');
      expect(handlers).toHaveProperty('event2');
      expect(handlers['event1']).toContain(instance.handleEvent1);
      expect(handlers['event2']).toContain(instance.handleEvent2);
    });

    it('should work with private methods', () => {
      class TestService {
        @OnClient('privateEvent')
        private handlePrivateEvent(data: any) {
          return data;
        }
      }

      const instance = new TestService();
      const handlers = getEventHandlers(instance);

      expect(handlers).toHaveProperty('privateEvent');
      expect(handlers['privateEvent']).toContain(instance['handlePrivateEvent']);
    });
  });

  describe('@OnServer', () => {
    it('should mark method as server event handler with server: prefix', () => {
      class TestService {
        @OnServer('testEvent')
        handleTestEvent(data: any) {
          return data;
        }
      }

      const instance = new TestService();
      const handlers = getEventHandlers(instance);

      expect(handlers).toHaveProperty('server:testEvent');
      expect(handlers['server:testEvent']).toContain(instance.handleTestEvent);
    });

    it('should support multiple server event handlers', () => {
      class TestService {
        @OnServer('event1')
        handleEvent1(data: any) {
          return data;
        }

        @OnServer('event2')
        handleEvent2(data: any) {
          return data;
        }
      }

      const instance = new TestService();
      const handlers = getEventHandlers(instance);

      expect(handlers).toHaveProperty('server:event1');
      expect(handlers).toHaveProperty('server:event2');
      expect(handlers['server:event1']).toContain(instance.handleEvent1);
      expect(handlers['server:event2']).toContain(instance.handleEvent2);
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
        @OnGameEvent('playerSpawn')
        handlePlayerSpawn(playerId: number, position: any) {
          return { playerId, position };
        }

        @OnGameEvent('playerDeath')
        handlePlayerDeath(playerId: number, killerId?: number, weaponHash?: number) {
          return { playerId, killerId, weaponHash };
        }
      }

      const instance = new TestService();
      const handlers = getEventHandlers(instance);

      expect(handlers).toHaveProperty('game:playerSpawn');
      expect(handlers).toHaveProperty('game:playerDeath');
      expect(handlers['game:playerSpawn']).toContain(instance.handlePlayerSpawn);
      expect(handlers['game:playerDeath']).toContain(instance.handlePlayerDeath);
    });
  });

  describe('getEventHandlers', () => {
    it('should return all event handlers from an instance', () => {
      class TestService {
        @OnClient('clientEvent')
        handleClientEvent(data: any) {
          return data;
        }

        @OnServer('serverEvent')
        handleServerEvent(data: any) {
          return data;
        }

        @OnGameEvent('gameEvent')
        handleGameEvent(data: any) {
          return data;
        }

        regularMethod() {
          return 'regular';
        }
      }

      const instance = new TestService();
      const handlers = getEventHandlers(instance);

      expect(handlers).toHaveProperty('clientEvent');
      expect(handlers).toHaveProperty('server:serverEvent');
      expect(handlers).toHaveProperty('game:gameEvent');
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
        @OnClient('baseEvent')
        handleBaseEvent(data: any) {
          return data;
        }
      }

      class DerivedService extends BaseService {
        @OnClient('derivedEvent')
        handleDerivedEvent(data: any) {
          return data;
        }
      }

      const instance = new DerivedService();
      const handlers = getEventHandlers(instance);

      expect(handlers).toHaveProperty('baseEvent');
      expect(handlers).toHaveProperty('derivedEvent');
      expect(handlers['baseEvent']).toContain(instance.handleBaseEvent);
      expect(handlers['derivedEvent']).toContain(instance.handleDerivedEvent);
    });

    it('should handle method overrides correctly', () => {
      class BaseService {
        @OnClient('overriddenEvent')
        handleEvent(data: any) {
          return 'base';
        }
      }

      class DerivedService extends BaseService {
        @OnClient('overriddenEvent')
        handleEvent(data: any) {
          return 'derived';
        }
      }

      const instance = new DerivedService();
      const handlers = getEventHandlers(instance);

      expect(handlers).toHaveProperty('overriddenEvent');
      expect(handlers['overriddenEvent']).toContain(instance.handleEvent);
      expect(handlers['overriddenEvent'][0]()).toBe('derived');
    });
  });

  describe('integration scenarios', () => {
    it('should work with real service class', () => {
      class PlayerService {
        @OnClient('playerReady')
        onPlayerReady(data: any) {
          console.log('Player ready:', data);
        }

        @OnServer('playerData')
        onPlayerData(data: any) {
          console.log('Player data received:', data);
        }

        @OnGameEvent('entityDamage')
        onEntityDamage(victim: number, attacker: number, weaponHash: number, damage: number) {
          console.log('Entity damage:', { victim, attacker, weaponHash, damage });
        }

        @OnGameEvent('playerSpawn')
        onPlayerSpawn(playerId: number, position: any) {
          console.log('Player spawned:', { playerId, position });
        }

        getPlayerHealth() {
          return 100;
        }
      }

      const playerService = new PlayerService();
      const handlers = getEventHandlers(playerService);

      expect(handlers).toHaveProperty('playerReady');
      expect(handlers).toHaveProperty('server:playerData');
      expect(handlers).toHaveProperty('game:entityDamage');
      expect(handlers).toHaveProperty('game:playerSpawn');

      expect(handlers).not.toHaveProperty('getPlayerHealth');

      expect(handlers['playerReady']).toContain(playerService.onPlayerReady);
      expect(handlers['server:playerData']).toContain(playerService.onPlayerData);
      expect(handlers['game:entityDamage']).toContain(playerService.onEntityDamage);
      expect(handlers['game:playerSpawn']).toContain(playerService.onPlayerSpawn);
    });

    it('should handle complex inheritance scenarios', () => {
      class BaseService {
        @OnClient('baseClientEvent')
        handleBaseClientEvent(data: any) {
          return 'base client';
        }

        @OnServer('baseServerEvent')
        handleBaseServerEvent(data: any) {
          return 'base server';
        }
      }

      class MiddleService extends BaseService {
        @OnClient('middleClientEvent')
        handleMiddleClientEvent(data: any) {
          return 'middle client';
        }

        @OnGameEvent('middleGameEvent')
        handleMiddleGameEvent(data: any) {
          return 'middle game';
        }
      }

      class FinalService extends MiddleService {
        @OnClient('finalClientEvent')
        handleFinalClientEvent(data: any) {
          return 'final client';
        }

        @OnServer('finalServerEvent')
        handleFinalServerEvent(data: any) {
          return 'final server';
        }

        @OnGameEvent('finalGameEvent')
        handleFinalGameEvent(data: any) {
          return 'final game';
        }
      }

      const instance = new FinalService();
      const handlers = getEventHandlers(instance);

      expect(handlers).toHaveProperty('baseClientEvent');
      expect(handlers).toHaveProperty('server:baseServerEvent');
      expect(handlers).toHaveProperty('middleClientEvent');
      expect(handlers).toHaveProperty('game:middleGameEvent');
      expect(handlers).toHaveProperty('finalClientEvent');
      expect(handlers).toHaveProperty('server:finalServerEvent');
      expect(handlers).toHaveProperty('game:finalGameEvent');

      expect(handlers['baseClientEvent']).toContain(instance.handleBaseClientEvent);
      expect(handlers['server:baseServerEvent']).toContain(instance.handleBaseServerEvent);
      expect(handlers['middleClientEvent']).toContain(instance.handleMiddleClientEvent);
      expect(handlers['game:middleGameEvent']).toContain(instance.handleMiddleGameEvent);
      expect(handlers['finalClientEvent']).toContain(instance.handleFinalClientEvent);
      expect(handlers['server:finalServerEvent']).toContain(instance.handleFinalServerEvent);
      expect(handlers['game:finalGameEvent']).toContain(instance.handleFinalGameEvent);
    });
  });

  describe('error handling', () => {
    it('should handle invalid event names gracefully', () => {
      class TestService {
        @OnClient('')
        handleEmptyEvent(data: any) {
          return data;
        }

        @OnServer('   ')
        handleWhitespaceEvent(data: any) {
          return data;
        }
      }

      const instance = new TestService();
      const handlers = getEventHandlers(instance);

      expect(handlers).toHaveProperty('');
      expect(handlers).toHaveProperty('server:   ');
    });

    it('should handle duplicate event names gracefully', () => {
      class TestService {
        @OnClient('duplicateEvent')
        handleDuplicateEvent1(data: any) {
          return 'first';
        }

        @OnClient('duplicateEvent')
        handleDuplicateEvent2(data: any) {
          return 'second';
        }
      }

      const instance = new TestService();
      const handlers = getEventHandlers(instance);

      expect(handlers).toHaveProperty('duplicateEvent');
      expect(handlers['duplicateEvent']).toHaveLength(2);
      expect(handlers['duplicateEvent']).toContain(instance.handleDuplicateEvent1);
      expect(handlers['duplicateEvent']).toContain(instance.handleDuplicateEvent2);
    });
  });
});