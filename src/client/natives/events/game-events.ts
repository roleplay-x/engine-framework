export interface GameEventTypes {
  'entityDamage': [victim: number, attacker: number, weaponHash: number, damage: number];
}

export type GameEventName = keyof GameEventTypes;
export type GameEventArgs<T extends GameEventName> = GameEventTypes[T];
