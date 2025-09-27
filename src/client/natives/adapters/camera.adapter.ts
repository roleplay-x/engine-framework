import { Vector3 } from "../../../shared";

export interface ICameraAdapter {
  createCamera(type?: string): number;
  destroyCamera(camera: number, destroyImmediately?: boolean): void;
  setCameraActive(camera: number, active: boolean): void;
  renderScriptCameras(render: boolean, ease: boolean, easeTime: number, p3: boolean, p4: boolean): void;
  setCameraCoord(camera: number, position: Vector3): void;
  setCameraRotation(camera: number, rotation: Vector3, rotationOrder?: number): void;
  setCameraFov(camera: number, fov: number): void;
  pointCameraAtCoord(camera: number, position: Vector3): void;
  pointCameraAtEntity(camera: number, entity: number, offsetX?: number, offsetY?: number, offsetZ?: number, p5?: boolean): void;
  attachCameraToEntity(camera: number, entity: number, offsetX: number, offsetY: number, offsetZ: number, isRelative: boolean): void;
  detachCamera(camera: number): void;
  isCameraActive(camera: number): boolean;
  getCameraCoord(camera: number): Vector3;
  getCameraRotation(camera: number): Vector3;
  getCameraFov(camera: number): number;
  displayHud(display: boolean): void;
  displayRadar(display: boolean): void;
  isHudHidden(): boolean;
}
