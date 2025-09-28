import { Camera } from '@roleplayx/engine-sdk';
import { CameraStatic } from '@roleplayx/engine-sdk/camera/models/camera-static';
import { CameraFollow } from '@roleplayx/engine-sdk/camera/models/camera-follow';
import { CameraOrbit } from '@roleplayx/engine-sdk/camera/models/camera-orbit';
import { CameraCinematic } from '@roleplayx/engine-sdk/camera/models/camera-cinematic';
import { CameraType } from '@roleplayx/engine-sdk/camera/models/camera';

export type CameraId = string;

export interface RPCamera extends Camera {
  id: CameraId;
  type: CameraType;
  description: string;
  static: CameraStatic | null;
  follow: CameraFollow | null;
  orbit: CameraOrbit | null;
  cinematic: CameraCinematic | null;
  soundId: string | null;
  freezePlayer: boolean;
  hideHud: boolean;
  enabled: boolean;
  createdDate: number;
  lastModifiedDate: number;
}
