import { Camera } from '@roleplayx/engine-sdk';

export type CameraId = string;

export interface RPCamera extends Camera {
  id: CameraId;
}
