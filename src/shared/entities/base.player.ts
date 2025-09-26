import { Vector3 } from '../math';

export abstract class BasePlayer {
  constructor(public readonly id: string) {}

  public abstract getPosition(): Vector3;
  public abstract setPosition(x: number, y: number, z: number): void;
}
