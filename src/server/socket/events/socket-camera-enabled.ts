import {
  CameraCinematic,
  CameraFollow,
  CameraOrbit,
  CameraStatic,
  CameraType,
} from '@roleplayx/engine-sdk';

import { CameraId } from '../../domains/world/models/camera';

import { SocketEvent } from './socket-event';

export interface SocketCameraEnabled extends SocketEvent {
  id: CameraId;
  type: CameraType;
  description: string;
  static?: CameraStatic;
  follow?: CameraFollow;
  orbit?: CameraOrbit;
  cinematic?: CameraCinematic;
  soundId?: string;
  freezePlayer: boolean;
  hideHud: boolean;
  enabled: boolean;
}
