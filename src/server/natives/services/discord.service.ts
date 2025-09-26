import { SessionId } from '../../domains/session/models/session';
import { RPServerService } from '../../core/server-service';
import { ServerTypes } from '../../core/types';

export abstract class RPDiscordService<
  T extends ServerTypes = ServerTypes,
> extends RPServerService<T> {
  abstract getDiscordUserId(sessionId: SessionId): string | undefined;
}
