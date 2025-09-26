import { Vector3 } from '../../../shared';
import { SpawnPointData } from '../types';

export class SpawnPoint {
  public readonly id: string;
  public readonly position: Vector3;
  public readonly heading: number;
  public readonly model?: string | number;
  public readonly skipFade: boolean;

  constructor(data: SpawnPointData & { id?: string }) {
    this.id = data.id || this.generateId();
    this.position = new Vector3(data.x, data.y, data.z);
    this.heading = data.heading || 0;
    this.model = data.model;
    this.skipFade = data.skipFade || false;
  }

  private generateId(): string {
    return `spawn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  toData(): SpawnPointData {
    return {
      x: this.position.x,
      y: this.position.y,
      z: this.position.z,
      heading: this.heading,
      model: this.model,
      skipFade: this.skipFade,
    };
  }

  static fromData(data: SpawnPointData & { id?: string }): SpawnPoint {
    return new SpawnPoint(data);
  }
}
