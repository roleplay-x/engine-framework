import 'reflect-metadata';
import { RPServerEvents } from './events';

const HANDLERS = Symbol('RP_SERVER_EVENT_HANDLERS');

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
