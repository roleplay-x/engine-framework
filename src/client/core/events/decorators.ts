import 'reflect-metadata';

const HANDLERS = Symbol('RP_CLIENT_EVENT_HANDLERS');

/**
 * Decorator for defining client event handlers.
 * 
 * @param event - Event name to listen for
 * @returns Method decorator
 * 
 * @example
 * ```typescript
 * export class MyService extends RPClientService {
 *   @OnClient('playerSpawned')
 *   private onPlayerSpawned(data: any): void {
 *     console.log('Player spawned:', data);
 *   }
 * 
 *   @OnClient('playerDied')
 *   private onPlayerDied(data: any): void {
 *     console.log('Player died:', data);
 *   }
 * }
 * ```
 */
export function OnClient(event: string) {
  return function (target: object, propertyKey: string, _descriptor: PropertyDescriptor) {
    const ctor = target.constructor as unknown;
    const list: Array<{ method: string; event: string }> =
      Reflect.getOwnMetadata(HANDLERS, ctor as object) || [];
    list.push({ method: propertyKey, event });
    Reflect.defineMetadata(HANDLERS, list, ctor as object);
  };
}

/**
 * Decorator for defining server event handlers.
 * 
 * @param event - Server event name to listen for
 * @returns Method decorator
 * 
 * @example
 * ```typescript
 * export class MyService extends RPClientService {
 *   @OnServer('playerJoined')
 *   private onPlayerJoined(data: any): void {
 *     console.log('Player joined:', data);
 *   }
 * }
 * ```
 */
export function OnServer(event: string) {
  return function (target: object, propertyKey: string, _descriptor: PropertyDescriptor) {
    const ctor = target.constructor as unknown;
    const list: Array<{ method: string; event: string }> =
      Reflect.getOwnMetadata(HANDLERS, ctor as object) || [];
    list.push({ method: propertyKey, event: `server:${event}` });
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
 *   private onEntityDamage(victim: number, attacker: number, weaponHash: number, damage: number): void {
 *     console.log(`Entity ${victim} took ${damage} damage from ${attacker}`);
 *   }
 * }
 * ```
 */
export function OnGameEvent(event: string) {
  return function (target: object, propertyKey: string, _descriptor: PropertyDescriptor) {
    const ctor = target.constructor as unknown;
    const list: Array<{ method: string; event: string }> =
      Reflect.getOwnMetadata(HANDLERS, ctor as object) || [];
    list.push({ method: propertyKey, event: `game:${event}` });
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
