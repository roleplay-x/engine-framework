import 'reflect-metadata';

/**
 * Parameter types that can be injected
 */
export enum ParamType {
  BODY = 'body',
  QUERY = 'query',
  PARAMS = 'params',
  HEADERS = 'headers',
  REQUEST = 'request',
  REPLY = 'reply',
}

/**
 * Metadata for a parameter
 */
export interface ParamMetadata {
  type: ParamType;
  index: number;
  property?: string;
}

const PARAM_METADATA_KEY = 'api:params';

/**
 * Creates a parameter decorator
 */
function createParamDecorator(type: ParamType, property?: string): ParameterDecorator {
  return (target: object, propertyKey: string | symbol | undefined, parameterIndex: number) => {
    if (!propertyKey) return;

    const existingParams: ParamMetadata[] =
      Reflect.getMetadata(PARAM_METADATA_KEY, target, propertyKey) || [];

    existingParams.push({
      type,
      index: parameterIndex,
      property,
    });

    Reflect.defineMetadata(PARAM_METADATA_KEY, existingParams, target, propertyKey);
  };
}

/**
 * Injects the request body
 */
export function Body(): ParameterDecorator {
  return createParamDecorator(ParamType.BODY);
}

/**
 * Injects a query parameter or all query parameters
 * @param property - Optional property name to extract from query
 */
export function Query(property?: string): ParameterDecorator {
  return createParamDecorator(ParamType.QUERY, property);
}

/**
 * Injects a route parameter or all route parameters
 * @param property - Optional property name to extract from params
 */
export function Param(property?: string): ParameterDecorator {
  return createParamDecorator(ParamType.PARAMS, property);
}

/**
 * Injects a header value or all headers
 * @param property - Optional header name to extract
 */
export function Headers(property?: string): ParameterDecorator {
  return createParamDecorator(ParamType.HEADERS, property);
}

/**
 * Injects the Fastify request object
 */
export function Request(): ParameterDecorator {
  return createParamDecorator(ParamType.REQUEST);
}

/**
 * Injects the Fastify reply object
 */
export function Reply(): ParameterDecorator {
  return createParamDecorator(ParamType.REPLY);
}

/**
 * Gets parameter metadata for a method
 */
export function getParamMetadata(target: object, propertyKey: string | symbol): ParamMetadata[] {
  return Reflect.getMetadata(PARAM_METADATA_KEY, target, propertyKey) || [];
}
