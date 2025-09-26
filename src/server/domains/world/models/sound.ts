import { Sound } from '@roleplayx/engine-sdk';

export type SoundId = string;

export interface RPSound extends Sound {
  id: SoundId;
}
