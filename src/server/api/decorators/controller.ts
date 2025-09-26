import 'reflect-metadata';
import { ControllerMetadata, METADATA_KEYS } from '../types';

/**
 * Decorator to mark a class as an API controller
 * @param path - Base path for all routes in this controller
 * @param options - Additional controller options
 */
export function Controller(
  path: string,
  options?: Omit<ControllerMetadata, 'path'>,
): ClassDecorator {
  return (target) => {
    const metadata: ControllerMetadata = {
      path,
      ...options,
    };
    Reflect.defineMetadata(METADATA_KEYS.CONTROLLER, metadata, target);
  };
}
