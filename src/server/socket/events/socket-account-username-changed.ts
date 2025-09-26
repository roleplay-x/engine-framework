import { AccountId } from '../../domains/account/models/account';

import { SocketEvent } from './socket-event';

export interface SocketAccountUsernameChanged extends SocketEvent {
  id: AccountId;
  username: string;
  timestamp: number;
}
