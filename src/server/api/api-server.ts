import 'reflect-metadata';
import Fastify, { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import cors from '@fastify/cors';

import { RPServerContext } from '../core/context';
import { RPLogger } from '../../core/logger';

import {
  ApiController,
  ApiControllerCtor,
  ApiServerConfig,
  AuthorizedRequest,
  ControllerMetadata,
  METADATA_KEYS,
  RouteMetadata,
} from './types';
import { createErrorHandler } from './middleware/error-handler';
import { validateApiKey, validateSessionToken } from './middleware/auth';
import { getAuthorizationMetadata, getParamMetadata, ParamType } from './decorators';

/**
 * API Server that manages HTTP endpoints using Fastify and decorators
 */
export class ApiServer<C = RPServerContext> {
  private readonly fastify: FastifyInstance;
  private readonly controllers: Map<ApiControllerCtor<C>, ApiController<C>> = new Map();
  private readonly context: C;
  private readonly config: ApiServerConfig;
  private readonly logger: RPLogger;

  constructor(context: C, config: ApiServerConfig) {
    this.context = context;
    this.config = config;
    this.logger = (context as RPServerContext).logger;

    this.fastify = Fastify({
      logger: false, // We use our own logger
    });

    this.fastify.setErrorHandler(createErrorHandler(context as RPServerContext));

    this.fastify.register(cors, {
      origin: config.cors?.origin ?? '*',
      methods: config.cors?.methods ?? ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      credentials: config.cors?.credentials ?? true,
      allowedHeaders: config.cors?.allowedHeaders ?? '*',
    });
  }

  /**
   * Registers a controller with the API server
   */
  public registerController(ControllerCtor: ApiControllerCtor<C>): this {
    const controllerMetadata: ControllerMetadata | undefined = Reflect.getMetadata(
      METADATA_KEYS.CONTROLLER,
      ControllerCtor,
    );

    if (!controllerMetadata) {
      throw new Error(`${ControllerCtor.name} is not decorated with @Controller`);
    }

    const controller = new ControllerCtor(this.context);
    this.controllers.set(ControllerCtor, controller);

    const routes: RouteMetadata[] =
      Reflect.getMetadata(METADATA_KEYS.ROUTES, Object.getPrototypeOf(controller)) || [];
    for (const route of routes) {
      const fullPath = this.joinPaths(controllerMetadata.path, route.path);
      const methodName = Reflect.getMetadata(
        `route:${route.method}:${route.path}`,
        Object.getPrototypeOf(controller),
      ) as string;

      if (!methodName) {
        this.logger.warn(`No method found for route ${route.method} ${fullPath}`);
        continue;
      }

      const handler = (controller as unknown as Record<string, unknown>)[methodName] as (
        ...args: unknown[]
      ) => unknown;
      if (typeof handler !== 'function') {
        this.logger.warn(`Method ${methodName} is not a function on controller`);
        continue;
      }

      const authMetadata = getAuthorizationMetadata(Object.getPrototypeOf(controller), methodName);
      this.fastify.route({
        method: route.method,
        url: fullPath,
        handler: async (request: FastifyRequest, reply: FastifyReply) => {
          const authorizedRequest = request as AuthorizedRequest;

          if (authMetadata?.apiKey) {
            await validateApiKey(request, this.config.gamemodeApiKeyHash);
          }

          if (authMetadata?.sessionToken) {
            await validateSessionToken(
              authorizedRequest,
              this.context as RPServerContext,
              authMetadata.sessionToken.scope,
              authMetadata.sessionToken.accessPolicy,
            );
          }

          const paramMetadata = getParamMetadata(Object.getPrototypeOf(controller), methodName);
          const args: unknown[] = [];

          for (const param of paramMetadata.sort((a, b) => a.index - b.index)) {
            switch (param.type) {
              case ParamType.BODY:
                args[param.index] = request.body;
                break;
              case ParamType.QUERY:
                args[param.index] = param.property
                  ? (request.query as Record<string, unknown>)[param.property]
                  : request.query;
                break;
              case ParamType.PARAMS:
                args[param.index] = param.property
                  ? (request.params as Record<string, unknown>)[param.property]
                  : request.params;
                break;
              case ParamType.HEADERS:
                args[param.index] = param.property
                  ? request.headers[param.property.toLowerCase()]
                  : request.headers;
                break;
              case ParamType.REQUEST:
                args[param.index] = authorizedRequest;
                break;
              case ParamType.REPLY:
                args[param.index] = reply;
                break;
            }
          }

          const result = await handler.call(controller, ...args);

          if (route.statusCode) {
            reply.status(route.statusCode);
          }

          return result;
        },
      });

      this.logger.info(`Registered route: ${route.method} ${fullPath}`);
    }

    return this;
  }

  /**
   * Starts the API server
   */
  public async start(): Promise<void> {
    const port = this.config.port ?? 3000;
    const host = this.config.host || '0.0.0.0';

    await this.fastify.listen({ port, host });
    this.logger.info(`API server listening on ${host}:${port}`);
  }

  /**
   * Stops the API server
   */
  public async stop(): Promise<void> {
    for (const controller of this.controllers.values()) {
      if (controller.dispose) {
        try {
          await controller.dispose();
        } catch (error) {
          this.logger.error(`Error disposing controller:`, error);
        }
      }
    }

    await this.fastify.close();
    this.logger.info('API server stopped');
  }

  /**
   * Gets the Fastify instance (for advanced configuration)
   */
  public getFastify(): FastifyInstance {
    return this.fastify;
  }

  /**
   * Joins paths ensuring proper slashes
   */
  private joinPaths(base: string, path: string): string {
    if (!base) return path || '/';
    if (!path || path === '/') return base || '/';

    const cleanBase = base.endsWith('/') ? base.slice(0, -1) : base;
    const cleanPath = path.startsWith('/') ? path : `/${path}`;

    return `${cleanBase}${cleanPath}`;
  }
}
