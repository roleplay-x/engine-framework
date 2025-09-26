import { SoundType } from '@roleplayx/engine-sdk/sound/models/sound';

import { SoundId } from '../../domains/world/models/sound';

import { SocketEvent } from './socket-event';

export interface SocketSoundCreated extends SocketEvent {
  id: SoundId;
  name: string;
  type: SoundType;
  description: string;
  attributes: {
    [key: string]: string;
  };
  externalUrl?: string;
  enabled: boolean;
}
