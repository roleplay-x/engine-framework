import { Vector3 } from '../../../shared';
import { BasePlayer } from '../../../shared';
import { RPClient } from '../client';

export class ClientPlayer extends BasePlayer {
  private sessionId: string;

  private platformAdapter = RPClient.get().getContext().platformAdapter;

  constructor(id: string, sessionId: string) {
    super(id);
    this.sessionId = sessionId;
  }

  /**
   * Creates a ClientPlayer instance.
   *
   * @param id - Player ID
   * @param sessionId - Session ID
   * @returns New ClientPlayer instance
   */
  public static create(id: string, sessionId: string): ClientPlayer {
    return new ClientPlayer(id, sessionId);
  }

  public getPosition(): Vector3 {
    return this.platformAdapter.player.getEntityCoords(this.platformAdapter.player.getPlayerPed());
  }

  public setPosition(x: number, y: number, z: number): void {
    this.platformAdapter.player.setEntityPosition(
      this.platformAdapter.player.getPlayerPed(),
      new Vector3(x, y, z),
    );
  }

  public get health(): number {
    return this.platformAdapter.player.getPlayerHealth();
  }

  public set health(health: number) {
    this.platformAdapter.player.setPlayerHealth(health);
  }

  /**
   * Emits an event to the server.
   * Note: Client players typically don't emit events to other players,
   * but this method is required by the BasePlayer interface.
   */
  public emit(event: string, ...args: any[]): void {
    // Client players typically don't emit events to other players
    // This could be implemented to emit to server if needed
    console.warn(
      `ClientPlayer.emit called with event: ${event} - this may not be intended behavior`,
    );
  }
}
