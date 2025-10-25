import { Character } from '@roleplayx/engine-sdk';

export type CharacterId = string;

export interface RPCharacter extends Character {
  id: CharacterId;
}
