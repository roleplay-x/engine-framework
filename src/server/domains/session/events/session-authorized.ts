import { SessionInfoAccount } from '@roleplayx/engine-sdk';

import { SessionId } from '../models/session';

export interface RPSessionAuthorized {
  sessionId: SessionId;
  account: SessionInfoAccount;
}
