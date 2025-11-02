import { BaseBlueprintConfigValue, Character } from '@roleplayx/engine-sdk';

export type CharacterId = string;

export interface RPCharacterAppearance {
  values: BaseBlueprintConfigValue[];
  imageUrl?: string;
  version: number;
  isUpdateRequired: boolean;
}

export interface RPCharacter extends Omit<Character, 'appearance'> {
  id: CharacterId;
  appearance: RPCharacterAppearance;
  spawned: boolean;
}
