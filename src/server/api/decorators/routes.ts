import 'reflect-metadata';
import { HttpMethod, RouteMetadata, METADATA_KEYS } from '../types';

/**
 * Creates a route decorator for the specified HTTP method
 */
function createMethodDecorator(method: HttpMethod) {
  return (path = '', options?: Omit<RouteMetadata, 'method' | 'path'>): MethodDecorator => {
    return (target: object, propertyKey: string | symbol, _descriptor: PropertyDescriptor) => {
      const routes: RouteMetadata[] = Reflect.getMetadata(METADATA_KEYS.ROUTES, target) || [];

      const route: RouteMetadata = {
        method,
        path,
        ...options,
      };

      routes.push({ ...route, path, method });
      Reflect.defineMetadata(METADATA_KEYS.ROUTES, routes, target);

      // Store the method name for this route
      Reflect.defineMetadata(`route:${method}:${path}`, propertyKey, target);
    };
  };
}

/**
 * GET route decorator
 */
export const Get = createMethodDecorator('GET');

/**
 * POST route decorator
 */
export const Post = createMethodDecorator('POST');

/**
 * PUT route decorator
 */
export const Put = createMethodDecorator('PUT');

/**
 * DELETE route decorator
 */
export const Delete = createMethodDecorator('DELETE');

/**
 * PATCH route decorator
 */
export const Patch = createMethodDecorator('PATCH');

/**
 * HEAD route decorator
 */
export const Head = createMethodDecorator('HEAD');

/**
 * OPTIONS route decorator
 */
export const Options = createMethodDecorator('OPTIONS');
