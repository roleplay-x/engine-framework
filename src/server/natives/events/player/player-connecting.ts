import { SessionId } from '../../../domains/session/models/session';

export interface RPPlayerConnecting {
  sessionId: SessionId;
  ipAddress: string;
}
