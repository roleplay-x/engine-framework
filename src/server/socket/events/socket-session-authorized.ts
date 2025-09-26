import { SessionId } from '../../domains/session/models/session';

import { SocketEvent } from './socket-event';

export interface SocketSessionAuthorized extends SocketEvent {
  id: SessionId;
  ipAddress: string;
  accountId: string;
  signInMethod: string;
  authorizedDate: number;
  hash: string;
}
