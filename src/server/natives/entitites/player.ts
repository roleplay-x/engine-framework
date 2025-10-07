import { Vector3 } from '../../../shared';
import { BasePlayer } from '../../../shared';
import { RPServerToClientEvents } from '../../../shared/types';
import { PlatformAdapter } from '../adapters';

export class ServerPlayer extends BasePlayer {
  private readonly sessionId: string;
  public readonly ip: string;
  private readonly platformAdapter: PlatformAdapter;

  constructor(id: string, sessionId: string, ip: string, platformAdapter: PlatformAdapter) {
    super(id);
    this.sessionId = sessionId;
    this.ip = ip;
    this.platformAdapter = platformAdapter;
  }

  /**
   * Creates a ServerPlayer instance.
   *
   * @param id - Player ID
   * @param sessionId - Session ID
   * @param ip - Player IP
   * @param platformAdapter - Platform adapter instance
   * @returns New ServerPlayer instance
   */
  public static create(
    id: string,
    sessionId: string,
    ip: string,
    platformAdapter: PlatformAdapter,
  ): ServerPlayer {
    return new ServerPlayer(id, sessionId, ip, platformAdapter);
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
