import { ReferenceCategory } from '@roleplayx/engine-sdk';

import { CategoryReferenceId } from '../../domains/reference/models/reference';

import { SocketEvent } from './socket-event';

export interface SocketMetricsUpdated extends SocketEvent {
  id: CategoryReferenceId;
  category: ReferenceCategory;
  referenceId: string;
  keys: string[];
}
