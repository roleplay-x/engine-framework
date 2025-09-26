import { Vector3 } from '../../../shared';
import { BasePlayer } from '../../../shared';

export abstract class ClientPlayer extends BasePlayer {
  protected constructor(id: string) {
    super(id);
  }

  abstract getPosition(): Vector3;

  abstract get health(): number;
  abstract get name(): string;
  abstract get sessionId(): string | undefined;
}
