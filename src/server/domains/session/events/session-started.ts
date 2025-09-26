import { SessionId } from '../models/session';

export interface RPSessionStarted {
  sessionId: SessionId;
  sessionToken: string;
}
