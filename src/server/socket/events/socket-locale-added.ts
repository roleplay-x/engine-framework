import { Locale } from '@roleplayx/engine-sdk';

import { SocketEvent } from './socket-event';

export interface SocketLocaleAdded extends SocketEvent {
  locale: Locale;
}
