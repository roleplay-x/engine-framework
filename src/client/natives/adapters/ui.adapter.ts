import { Vector3 } from '../../../shared';

export interface DrawText3DOptions {
  scale?: number;
  font?: number;
  color?: {
    r: number;
    g: number;
    b: number;
    a: number;
  };
  outline?: boolean;
  centered?: boolean;
}

export interface DrawText2DOptions {
  scale?: number;
  font?: number;
  color?: {
    r: number;
    g: number;
    b: number;
    a: number;
  };
  alignment?: 'left' | 'center' | 'right';
  outline?: boolean;
  centered?: boolean;
}

export interface DrawRectOptions {
  color?: {
    r: number;
    g: number;
    b: number;
    a: number;
  };
}

export interface IUIAdapter {
  drawText3D(position: Vector3, text: string, options?: DrawText3DOptions): void;
  drawText2D(x: number, y: number, text: string, options?: DrawText2DOptions): void;
  drawRect(x: number, y: number, width: number, height: number, options?: DrawRectOptions): void;
}

