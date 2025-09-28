import { Vector3 } from '../../../shared';

export interface IClientLogger {
  debug(message: string, ...args: any[]): void;
  info(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  error(message: string, ...args: any[]): void;
}

export interface ICoreAdapter {
  readonly logger: IClientLogger;

  // Utility
  wait(ms: number): Promise<void>;
  getGameTimer(): number;
  getHashKey(str: string): number;

  // World & Collision
  requestCollision(position: Vector3): void;
  hasCollisionLoadedAroundEntity(entity: number): boolean;
  requestModel(model: string | number): Promise<void>;
  setModelAsNoLongerNeeded(model: string | number): void;

  // Camera & Screen
  fadeScreen(fadeIn: boolean, duration: number): Promise<void>;
  isScreenFaded(fadeIn: boolean): boolean;
  shutdownLoadingScreen(): void;
  isGameplayCamRendering(): boolean;

  // Game state
  isGamePaused(): boolean;
  setGamePaused(paused: boolean): void;
  getGameTime(): number;

  // HUD & UI
  displayHud(display: boolean): void;
  displayRadar(display: boolean): void;
  isHudHidden(): boolean;
}
