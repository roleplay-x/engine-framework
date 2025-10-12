import { RPServerService } from '../../core/server-service';
import { RPDiscordService } from '../../natives/services';
import { SessionId } from '../session/models/session';
import { SessionService } from '../session/service';
  

export class DiscordService extends RPDiscordService {

  getDiscordUserId(sessionId: SessionId): string | undefined {
    const session = this.getService(SessionService).getPlayerBySession(sessionId);
    if (!session) {
      return undefined;
    }

    return this.context.platformAdapter.player.getPlayerDiscordId(session.id);
  }
}
  