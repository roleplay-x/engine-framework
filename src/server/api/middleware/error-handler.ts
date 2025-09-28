import { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { EngineError } from '@roleplayx/engine-sdk';

import { GamemodeServerError } from '../../core/errors';
import { RPServerContext } from '../../core/context';
import { LocalizationService } from '../../domains/localization/service';

/**
 * Creates an error handler with access to the server context for localization
 * @param context - The server context for accessing services
 * @returns The error handler function
 */
export function createErrorHandler<C extends RPServerContext>(context: C) {
  return async function errorHandler(
    error: FastifyError | Error,
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    if (error instanceof EngineError) {
      context.logger.error(
        `[EngineError] Http request failed for [${request.method}] ${request.url}`,
        error,
      );
      reply.status(error.statusCode).send({
        key: error.key,
        message: error.message,
        params: error.params,
      });
      return;
    }

    if (error instanceof GamemodeServerError) {
      const acceptLanguage = request.headers['accept-language'];
      const locale = acceptLanguage ? acceptLanguage.split(',')[0].split(';')[0].trim() : undefined;

      const localizationService = context.getService(LocalizationService);
      const translatedErrorMessage = localizationService.translateError(
        error.key,
        error.params,
        locale,
      );

      const message =
        error.message && translatedErrorMessage === error.key
          ? error.message
          : translatedErrorMessage;

      reply.status(error.statusCode).send({
        key: error.key,
        message: message,
        params: error.params,
      });
      return;
    }

    // Handle validation errors
    if ('validation' in error && error.validation) {
      reply.status(400).send({
        key: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        params: {
          details: JSON.stringify(error.validation),
        },
      });
      return;
    }

    // Handle other Fastify errors
    if ('statusCode' in error && typeof error.statusCode === 'number') {
      reply.status(error.statusCode).send({
        key: 'HTTP_ERROR',
        message: error.message,
        params: {},
      });
      return;
    }

    reply.status(500).send({
      key: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred',
      params: {
        message: error.message,
      },
    });
  };
}
