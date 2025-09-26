import { ReferenceCategory } from '@roleplayx/engine-sdk';

import { SegmentDefinitionId } from '../../domains/reference/models/segment';
import { CategoryReferenceId } from '../../domains/reference/models/reference';

import { SocketEvent } from './socket-event';

export interface SocketSegmentRemoved extends SocketEvent {
  categoryReferenceId: CategoryReferenceId;
  segmentDefinitionId: SegmentDefinitionId;
  category: ReferenceCategory;
  referenceId: string;
}
