import { ReferenceCategory } from '@roleplayx/engine-sdk';

import { CategoryReferenceId } from '../../domains/reference/models/reference';
import { SegmentDefinitionId } from '../../domains/reference/models/segment';

import { SocketEvent } from './socket-event';

export interface SocketSegmentCreated extends SocketEvent {
  categoryReferenceId: CategoryReferenceId;
  segmentDefinitionId: SegmentDefinitionId;
  category: ReferenceCategory;
  referenceId: string;
}
