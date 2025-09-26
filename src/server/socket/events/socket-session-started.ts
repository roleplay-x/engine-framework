import { SessionId } from '../../domains/session/models/session';

import { SocketEvent } from './socket-event';

export interface SocketSessionStarted extends SocketEvent {
  id: SessionId;
  ipAddress: string;
  hash: string;
}
