import { SessionId } from '../../domains/session/models/session';

import { SocketEvent } from './socket-event';

export interface SocketSessionUpdated extends SocketEvent {
  id: SessionId;
  hash: string;
  timestamp: number;
}
