import { BasePlayer, Vector3 } from '../../../shared';
import { RPServerToClientEvents } from '../../../shared/types';
import { RPServer } from '../../server';
import { PlatformAdapter } from '../adapters';

export class ServerPlayer extends BasePlayer {
  private readonly sessionId: string;
  public readonly ip: string;

  private readonly token: string;
  private readonly platformAdapter: PlatformAdapter = RPServer.get().getContext().platformAdapter;

  constructor(id: string, sessionId: string, ip: string, token: string) {
    super(id);
    this.sessionId = sessionId;
    this.ip = ip;
    this.token = token;
  }

  /**
   * Creates a ServerPlayer instance.
   *
   * @param id - Player ID
   * @param sessionId - Session ID
   * @param ip - Player IP
   * @param token - Player token
   * @returns New ServerPlayer instance
   */
  public static create(id: string, sessionId: string, ip: string, token: string): ServerPlayer {
    return new ServerPlayer(id, sessionId, ip, token);
  }

  public getPosition(): Vector3 {
    return this.platformAdapter.player.getPlayerPosition(this.id);
  }

  public setPosition(x: number, y: number, z: number): void {
    this.platformAdapter.player.setPlayerPosition(this.id, new Vector3(x, y, z));
  }

  public get health(): number {
    return this.platformAdapter.player.getPlayerHealth(this.id);
  }

  public set health(health: number) {
    // TODO: Implement
  }

  /**
   * Emits an event to this player with type safety.
   *
   * @param event - The event name (must be a valid server-to-client event)
   * @param data - The event data matching the event's type definition
   */
  public emit<K extends keyof RPServerToClientEvents>(
    event: K,
    data: RPServerToClientEvents[K],
  ): void {
    this.platformAdapter.network.emitToPlayer(this.id, event, data);
  }
}
