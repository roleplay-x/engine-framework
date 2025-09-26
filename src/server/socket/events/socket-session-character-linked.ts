import { SessionId } from '../../domains/session/models/session';

import { SocketEvent } from './socket-event';

export interface SocketSessionCharacterLinked extends SocketEvent {
  id: SessionId;
  ipAddress: string;
  accountId: string;
  characterId: string;
  characterLinkedDate: number;
  signInMethod: string;
  authorizedDate: number;
  hash: string;
}
