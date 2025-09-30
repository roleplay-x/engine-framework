import 'reflect-metadata';
import { RPServerEvents } from './events';
import { RPClientToServerEvents } from '../../../shared/types';
import { PlayerId } from '../../domains/session/models/session';

const HANDLERS = Symbol('RP_SERVER_EVENT_HANDLERS');
const CLIENT_HANDLERS = Symbol('RP_CLIENT_EVENT_HANDLERS');

export function OnServer<
  Events extends RPServerEvents = RPServerEvents,
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
 * Decorator for defining client event handlers on the server side with type safety.
 * These events are sent from client to server and handled by the adapter.
 * The first parameter will always be the playerId, followed by the event data.
 *
 * @param event - Client event name to listen for
 * @returns Method decorator
 *
 * @example
 * ```typescript
 * export class MyService extends RPServerService {
 *   @OnClient('player:ready')
 *   private onPlayerReady(playerId: PlayerId, data: RPClientToServerEvents['player:ready']): void {
 *     console.log('Player ready from client:', playerId, data);
 *   }
 *
 *   @OnClient('player:spawned')
 *   private onPlayerSpawned(playerId: PlayerId, data: RPClientToServerEvents['player:spawned']): void {
 *     console.log('Player spawned from client:', playerId, data);
 *   }
 * }
 * ```
 */
export function OnClient<
  Events extends RPClientToServerEvents = RPClientToServerEvents,
  K extends keyof Events = keyof Events,
>(event: K) {
  return function (target: object, propertyKey: string, _descriptor: PropertyDescriptor) {
    const ctor = target.constructor as unknown;
    const list: Array<{ method: string; event: keyof Events }> =
      Reflect.getOwnMetadata(CLIENT_HANDLERS, ctor as object) || [];
    list.push({ method: propertyKey, event });
    Reflect.defineMetadata(CLIENT_HANDLERS, list, ctor as object);
  };
}

export function getEventHandlers<Events extends RPServerEvents = RPServerEvents>(
  instance: Record<string, unknown>,
) {
  const handlers: Array<{ method: string; event: keyof Events }> = [];
  let currentProto = instance.constructor;

  while (currentProto && currentProto !== Function.prototype) {
    const protoHandlers = Reflect.getOwnMetadata(HANDLERS, currentProto) as
      | Array<{ method: string; event: keyof Events }>
      | undefined;

    if (protoHandlers) {
      handlers.push(...protoHandlers);
    }

    currentProto = Object.getPrototypeOf(currentProto);
  }

  return handlers.length > 0 ? handlers : undefined;
}

/**
 * Gets all client event handlers from a service instance.
 * These handlers are for events sent from client to server.
 *
 * @param instance - Service instance
 * @returns Array of client event handlers or undefined if none found
 */
export function getClientEventHandlers<Events extends RPClientToServerEvents = RPClientToServerEvents>(
  instance: Record<string, unknown>,
) {
  const handlers: Array<{ method: string; event: keyof Events }> = [];
  let currentProto = instance.constructor;

  while (currentProto && currentProto !== Function.prototype) {
    const protoHandlers = Reflect.getOwnMetadata(CLIENT_HANDLERS, currentProto) as
      | Array<{ method: string; event: keyof Events }>
      | undefined;

    if (protoHandlers) {
      handlers.push(...protoHandlers);
    }

    currentProto = Object.getPrototypeOf(currentProto);
  }

  return handlers.length > 0 ? handlers : undefined;
}
