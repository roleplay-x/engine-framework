import { Vector } from './base.vector';

export class Vector3 extends Vector {
  constructor(x: number, y: number, z: number) {
    super(x, y, z);
  }

  add(other: Vector3): Vector3 {
    return new Vector3(this.x + other.x, this.y + other.y, this.z + other.z);
  }

  subtract(other: Vector3): Vector3 {
    return new Vector3(this.x - other.x, this.y - other.y, this.z - other.z);
  }

  multiply(scalar: number): Vector3 {
    return new Vector3(this.x * scalar, this.y * scalar, this.z * scalar);
  }

  divide(scalar: number): Vector3 {
    if (scalar === 0) throw new Error('Division by zero');
    return new Vector3(this.x / scalar, this.y / scalar, this.z / scalar);
  }

  normalize(): Vector3 {
    const mag = this.magnitude();
    if (mag === 0) return new Vector3(0, 0, 0);
    return this.divide(mag);
  }

  distance(other: Vector3): number {
    return this.subtract(other).magnitude();
  }

  dot(other: Vector3): number {
    return this.x * other.x + this.y * other.y + this.z * other.z;
  }

  cross(other: Vector3): Vector3 {
    return new Vector3(
      this.y * other.z - this.z * other.y,
      this.z * other.x - this.x * other.z,
      this.x * other.y - this.y * other.x,
    );
  }

  angle(other: Vector3): number {
    const dot = this.dot(other);
    const mag1 = this.magnitude();
    const mag2 = other.magnitude();
    return Math.acos(dot / (mag1 * mag2));
  }

  toString(): string {
    return `Vector3(${this.x}, ${this.y}, ${this.z})`;
  }

  static zero(): Vector3 {
    return new Vector3(0, 0, 0);
  }

  static fromArray(arr: number[]): Vector3 {
    if (arr.length < 3) throw new Error('Array must have at least 3 elements');
    return new Vector3(arr[0], arr[1], arr[2]);
  }

  static fromPlatform(vector: { x: number; y: number; z: number }): Vector3 {
    return new Vector3(vector.x, vector.y, vector.z);
  }
}
