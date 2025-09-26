import { SessionInfoAccount, SessionInfoCharacter } from '@roleplayx/engine-sdk';

import { SessionId } from '../models/session';

export interface RPSessionUpdated {
  sessionId: SessionId;
  account?: SessionInfoAccount;
  character?: SessionInfoCharacter;
}
