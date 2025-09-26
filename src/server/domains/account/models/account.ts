import { Account } from '@roleplayx/engine-sdk';

export type AccountId = string;

export interface RPAccount extends Account {
  id: AccountId;
}
