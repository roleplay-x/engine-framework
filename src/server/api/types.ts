import { FastifyRequest } from 'fastify';
import { AccessPolicy } from '@roleplayx/engine-sdk';

import { RPServerContext } from '../core/context';

/** HTTP methods supported by the API */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';

/** Scope levels for endpoint authorization */
export enum EndpointScope {
  /** No account/character link required */
  SERVER = 'SERVER',
  /** Session must be linked to an account */
  ACCOUNT = 'ACCOUNT',
  /** Session must be linked to a character */
  CHARACTER = 'CHARACTER',
}

/** Metadata for a controller class */
export interface ControllerMetadata {
  /** Base path for all routes in this controller */
  path: string;
}

/** Metadata for a route method */
export interface RouteMetadata {
  /** HTTP method for the route */
  method: HttpMethod;
  /** Path for the route (relative to controller path) */
  path: string;
  /** Response status code */
  statusCode?: number;
}

/** Metadata for API key authorization */
export interface ApiKeyAuthMetadata {
  /** Whether this endpoint requires API key authorization */
  required: boolean;
}

/** Metadata for session token authorization */
export interface SessionTokenAuthMetadata {
  /** Required scope for the session */
  scope: EndpointScope;
  /** Optional access policy that must be present on the account/character */
  accessPolicy?: AccessPolicy;
}

/** Combined authorization metadata */
export interface AuthorizationMetadata {
  apiKey?: ApiKeyAuthMetadata;
  sessionToken?: SessionTokenAuthMetadata;
}

/** Base class for API controllers */
export abstract class ApiController<C = RPServerContext> {
  constructor(protected readonly context: C) {}

  /** Dispose the controller (called on shutdown) */
  dispose?(): Promise<void>;
}

/** Constructor type for API controllers */
export type ApiControllerCtor<C = RPServerContext> = new (context: C) => ApiController<C>;

/** Extended request with session information */
export interface AuthorizedRequest extends FastifyRequest {
  /** Session ID if authenticated via session token */
  sessionId?: string;
  /** Account ID if session is linked to an account */
  accountId?: string;
  /** Character ID if session is linked to a character */
  characterId?: string;
}

/** API server configuration */
export interface ApiServerConfig {
  /** Port to listen on */
  port?: number;
  /** Host to bind to */
  host?: string;
  /** Optional SHA256 hash of the API key for authentication */
  gamemodeApiKeyHash: string;
  /** CORS configuration */
  cors?: {
    origin?: string | string[] | boolean;
    credentials?: boolean;
    methods?: string[];
    allowedHeaders?: string[];
  };
}

/** Metadata storage keys */
export const METADATA_KEYS = {
  CONTROLLER: 'api:controller',
  ROUTES: 'api:routes',
  PARAMS: 'api:params',
  AUTHORIZATION: 'api:authorization',
} as const;
