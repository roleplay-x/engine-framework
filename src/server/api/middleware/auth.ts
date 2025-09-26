import { createHash } from 'crypto';

import { FastifyRequest } from 'fastify';
import { AccessPolicy } from '@roleplayx/engine-sdk';

import { AuthorizedRequest, EndpointScope } from '../types';
import { SessionService } from '../../domains/session/service';
import { generateSessionTokenHash } from '../../domains/session/models/session';
import { RPServerContext } from '../../core/context';
import { ForbiddenError, NotFoundError, UnauthorizedError } from '../../core/errors';

/**
 * Validates API key from x-api-key header
 */
export async function validateApiKey(
  request: FastifyRequest,
  gamemodeApiKeyHash?: string,
): Promise<void> {
  if (!gamemodeApiKeyHash) {
    throw new UnauthorizedError('API_KEY_NOT_CONFIGURED', {});
  }

  const apiKey = request.headers['x-api-key'] as string;
  if (!apiKey) {
    throw new UnauthorizedError('API_KEY_MISSING', {});
  }

  const hash = createHash('sha256').update(apiKey).digest('hex');
  if (hash !== gamemodeApiKeyHash) {
    throw new UnauthorizedError('INVALID_API_KEY', {});
  }
}

/**
 * Validates session token from Basic Auth header
 */
export async function validateSessionToken<C extends RPServerContext>(
  request: AuthorizedRequest,
  context: C,
  scope: EndpointScope,
  accessPolicy?: AccessPolicy,
): Promise<void> {
  const authorization = request.headers.authorization;
  if (!authorization || !authorization.startsWith('Basic ')) {
    throw new UnauthorizedError('SESSION_TOKEN_MISSING', {});
  }

  const credentials = Buffer.from(authorization.slice(6), 'base64').toString('ascii');
  const [sessionId, sessionToken] = credentials.split(':');

  if (!sessionId || !sessionToken) {
    throw new UnauthorizedError('INVALID_SESSION_TOKEN_FORMAT', {});
  }

  const sessionService = context.getService(SessionService);
  const session = sessionService.getSession(sessionId);

  if (!session) {
    throw new NotFoundError('SESSION_NOT_FOUND', { id: sessionId });
  }

  const tokenHash = generateSessionTokenHash(sessionId, sessionToken);
  if (session.tokenHash !== tokenHash) {
    throw new UnauthorizedError('INVALID_SESSION_TOKEN', {});
  }

  if (scope === EndpointScope.ACCOUNT && !session.account) {
    throw new ForbiddenError('SESSION_HAS_NOT_AUTHORIZED', {});
  }

  if (scope === EndpointScope.CHARACTER && !session.character) {
    throw new ForbiddenError('SESSION_IS_NOT_LINKED_TO_A_CHARACTER', {});
  }

  if (accessPolicy) {
    context.getService(SessionService).validateAccessPolicy(sessionId, accessPolicy);
  }

  request.sessionId = sessionId;
  request.accountId = session.account?.id;
  request.characterId = session.character?.id;
}
