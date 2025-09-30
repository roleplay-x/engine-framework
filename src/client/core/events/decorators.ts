import 'reflect-metadata';
import { RPServerToClientEvents, RPClientToServerEvents, RPClientEvents } from '../../../shared/types';
import { GameEventName, GameEventTypes } from '../../natives/events/game-events';

const HANDLERS = Symbol('RP_CLIENT_EVENT_HANDLERS');

/**
 * Decorator for defining client event handlers with type safety.
 *
 * @param event - Event name to listen for
 * @returns Method decorator
 *
 * @example
 * ```typescript
 * export class MyService extends RPClientService {
 *   @OnClient('player:spawned')
 *   private onPlayerSpawned(data: RPClientEvents['player:spawned']): void {
 *     console.log('Player spawned:', data);
 *   }
 *
 *   @OnClient('player:died')
 *   private onPlayerDied(data: RPClientEvents['player:died']): void {
 *     console.log('Player died:', data);
 *   }
 * }
 * ```
 */
export function OnClient<
  Events extends RPClientEvents = RPClientEvents,
  K extends keyof Events = keyof Events,
>(event: K) {
  return function (target: object, propertyKey: string, _descriptor: PropertyDescriptor) {
    const ctor = target.constructor as unknown;
    const list: Array<{ method: string; event: keyof Events }> =
      Reflect.getOwnMetadata(HANDLERS, ctor as object) || [];
    list.push({ method: propertyKey, event });
    Reflect.defineMetadata(HANDLERS, list, ctor as object);
  };
}

/**
 * Decorator for defining server event handlers with type safety.
 *
 * @param event - Server event name to listen for
 * @returns Method decorator
 *
 * @example
 * ```typescript
 * export class MyService extends RPClientService {
 *   @OnServer('player:ready')
 *   private onPlayerReady(data: RPServerToClientEvents['player:ready']): void {
 *     console.log('Player ready:', data);
 *   }
 *
 *   @OnServer('health:set')
 *   private onHealthSet(data: RPServerToClientEvents['health:set']): void {
 *     console.log('Health set:', data);
 *   }
 * }
 * ```
 */
export function OnServer<
  Events extends RPServerToClientEvents = RPServerToClientEvents,
  K extends keyof Events = keyof Events,
>(event: K) {
  return function (target: object, propertyKey: string, _descriptor: PropertyDescriptor) {
    const ctor = target.constructor as unknown;
    const list: Array<{ method: string; event: string }> =
      Reflect.getOwnMetadata(HANDLERS, ctor as object) || [];
    list.push({ method: propertyKey, event: `server:${String(event)}` });
    Reflect.defineMetadata(HANDLERS, list, ctor as object);
  };
}

/**
 * Decorator for defining game event handlers with type safety.
 *
 * @param event - Game event name to listen for
 * @returns Method decorator
 *
 * @example
 * ```typescript
 * export class MyService extends RPClientService {
 *   @OnGameEvent('entityDamage')
 *   private onEntityDamage(...args: GameEventTypes['entityDamage']): void {
 *     const [victim, attacker, weaponHash, damage] = args;
 *     console.log(`Entity ${victim} took ${damage} damage from ${attacker}`);
 *   }
 * }
 * ```
 */
export function OnGameEvent<
  Events extends GameEventTypes = GameEventTypes,
  K extends keyof Events = keyof Events,
>(event: K) {
  return function (target: object, propertyKey: string, _descriptor: PropertyDescriptor) {
    const ctor = target.constructor as unknown;
    const list: Array<{ method: string; event: string }> =
      Reflect.getOwnMetadata(HANDLERS, ctor as object) || [];
    list.push({ method: propertyKey, event: `game:${String(event)}` });
    Reflect.defineMetadata(HANDLERS, list, ctor as object);
  };
}

/**
 * Gets all event handlers from a service instance.
 *
 * @param instance - Service instance
 * @returns Object containing event handlers mapped by event name
 */
export function getEventHandlers(instance: any): Record<string, ((...args: any[]) => void)[]> {
  const handlers: Record<string, ((...args: any[]) => void)[]> = {};

  let currentCtor = instance.constructor;
  while (currentCtor && currentCtor !== Object) {
    const list: Array<{ method: string; event: string }> =
      Reflect.getOwnMetadata(HANDLERS, currentCtor as object) || [];

    for (const { method, event } of list) {
      if (typeof instance[method] === 'function') {
        if (!handlers[event]) {
          handlers[event] = [];
        }
        handlers[event].push(instance[method]);
      }
    }

    currentCtor = Object.getPrototypeOf(currentCtor);
  }

  return handlers;
}
