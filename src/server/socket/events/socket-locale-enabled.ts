import { Locale } from '@roleplayx/engine-sdk';

import { SocketEvent } from './socket-event';

export interface SocketLocaleEnabled extends SocketEvent {
  locale: Locale;
}
