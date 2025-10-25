import { SessionEndReason } from '@roleplayx/engine-sdk';

import { PlayerId, SessionId } from '../models/session';

export interface RPSessionFinished {
  sessionId: SessionId;
  playerId?: PlayerId;
  accountId?: string;
  characterId?: string;
  endReason: SessionEndReason;
  endReasonText?: string;
}
