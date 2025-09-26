import { Vector } from './base.vector';

export class Vector2 extends Vector {
  constructor(x: number, y: number) {
    super(x, y, 0);
  }

  add(other: Vector2): Vector2 {
    return new Vector2(this.x + other.x, this.y + other.y);
  }

  subtract(other: Vector2): Vector2 {
    return new Vector2(this.x - other.x, this.y - other.y);
  }

  multiply(scalar: number): Vector2 {
    return new Vector2(this.x * scalar, this.y * scalar);
  }

  divide(scalar: number): Vector2 {
    if (scalar === 0) throw new Error('Division by zero');
    return new Vector2(this.x / scalar, this.y / scalar);
  }

  magnitude(): number {
    return Math.sqrt(this.x * this.x + this.y * this.y);
  }

  normalize(): Vector2 {
    const mag = this.magnitude();
    if (mag === 0) return new Vector2(0, 0);
    return this.divide(mag);
  }

  distance(other: Vector2): number {
    return this.subtract(other).magnitude();
  }

  dot(other: Vector2): number {
    return this.x * other.x + this.y * other.y;
  }

  cross(other: Vector2): number {
    return this.x * other.y - this.y * other.x;
  }

  angle(other: Vector2): number {
    const dot = this.dot(other);
    const mag1 = this.magnitude();
    const mag2 = other.magnitude();
    return Math.acos(dot / (mag1 * mag2));
  }

  rotate(angle: number): Vector2 {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return new Vector2(this.x * cos - this.y * sin, this.x * sin + this.y * cos);
  }

  toString(): string {
    return `Vector2(${this.x}, ${this.y})`;
  }

  static zero(): Vector2 {
    return new Vector2(0, 0);
  }

  static fromArray(arr: number[]): Vector2 {
    if (arr.length < 2) throw new Error('Array must have at least 2 elements');
    return new Vector2(arr[0], arr[1]);
  }
}
