import { AccountId } from '../models/account';

export interface RPAccountUsernameChanged {
  accountId: AccountId;
  username: string;
}
