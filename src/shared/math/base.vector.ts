export abstract class Vector {
  constructor(
    public x: number,
    public y: number,
    public z: number = 0,
  ) {}

  add(other: Vector): Vector {
    return new (this.constructor as any)(this.x + other.x, this.y + other.y, this.z + other.z);
  }

  subtract(other: Vector): Vector {
    return new (this.constructor as any)(this.x - other.x, this.y - other.y, this.z - other.z);
  }

  multiply(scalar: number): Vector {
    return new (this.constructor as any)(this.x * scalar, this.y * scalar, this.z * scalar);
  }

  divide(scalar: number): Vector {
    if (scalar === 0) throw new Error('Division by zero');
    return new (this.constructor as any)(this.x / scalar, this.y / scalar, this.z / scalar);
  }

  magnitude(): number {
    return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
  }

  normalize(): Vector {
    const mag = this.magnitude();
    if (mag === 0) return new (this.constructor as any)(0, 0, 0);
    return this.divide(mag);
  }

  distance(other: Vector): number {
    return this.subtract(other).magnitude();
  }

  dot(other: Vector): number {
    return this.x * other.x + this.y * other.y + this.z * other.z;
  }

  equals(other: Vector): boolean {
    return this.x === other.x && this.y === other.y && this.z === other.z;
  }

  toArray(): number[] {
    return [this.x, this.y, this.z];
  }

  toString(): string {
    return `Vector(${this.x}, ${this.y}, ${this.z})`;
  }
}
