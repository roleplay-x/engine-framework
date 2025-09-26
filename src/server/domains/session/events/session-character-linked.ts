import { SessionInfoAccount, SessionInfoCharacter } from '@roleplayx/engine-sdk';

import { SessionId } from '../models/session';

export interface RPSessionCharacterLinked {
  sessionId: SessionId;
  account: SessionInfoAccount;
  character: SessionInfoCharacter;
}
