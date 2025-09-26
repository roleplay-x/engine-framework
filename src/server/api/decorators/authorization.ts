import 'reflect-metadata';
import { AccessPolicy } from '@roleplayx/engine-sdk';

import { EndpointScope, AuthorizationMetadata, METADATA_KEYS } from '../types';

/**
 * Decorator to require API key authentication for an endpoint
 * The API key should be provided in the x-api-key header
 */
export function ApiKey(): MethodDecorator {
  return (target: object, propertyKey: string | symbol, _descriptor: PropertyDescriptor) => {
    const existing: AuthorizationMetadata =
      Reflect.getMetadata(METADATA_KEYS.AUTHORIZATION, target, propertyKey) || {};

    existing.apiKey = { required: true };

    Reflect.defineMetadata(METADATA_KEYS.AUTHORIZATION, existing, target, propertyKey);
  };
}

/**
 * Decorator to require session token authentication for an endpoint
 * The session token should be provided as Basic Auth (username = sessionId, password = sessionToken)
 *
 * @param scope - The required scope level for the session
 * @param accessPolicy - Optional access policy that must be present on the account/character
 */
export function SessionToken(
  scope: EndpointScope = EndpointScope.SERVER,
  accessPolicy?: AccessPolicy,
): MethodDecorator {
  return (target: object, propertyKey: string | symbol, _descriptor: PropertyDescriptor) => {
    const existing: AuthorizationMetadata =
      Reflect.getMetadata(METADATA_KEYS.AUTHORIZATION, target, propertyKey) || {};

    existing.sessionToken = {
      scope,
      accessPolicy,
    };

    Reflect.defineMetadata(METADATA_KEYS.AUTHORIZATION, existing, target, propertyKey);
  };
}

/**
 * Gets authorization metadata for a method
 */
export function getAuthorizationMetadata(
  target: object,
  propertyKey: string | symbol,
): AuthorizationMetadata | undefined {
  return Reflect.getMetadata(METADATA_KEYS.AUTHORIZATION, target, propertyKey);
}
