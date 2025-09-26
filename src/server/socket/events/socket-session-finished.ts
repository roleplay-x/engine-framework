import { SessionEndReason } from '@roleplayx/engine-sdk';

import { SessionId } from '../../domains/session/models/session';

import { SocketEvent } from './socket-event';

export interface SocketSessionFinished extends SocketEvent {
  id: SessionId;
  ipAddress: string;
  accountId?: string;
  characterId?: string;
  signInMethod?: string;
  authorizedDate?: number;
  characterLinkedDate?: number;
  lastHeartbeatDate?: number;
  endDate?: number;
  endReason: SessionEndReason;
  endReasonText?: string;
  hash: string;
}
