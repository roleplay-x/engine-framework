import {
  ReferenceCategory,
  SegmentPolicy,
  SegmentStyle,
  SegmentTypeCode,
} from '@roleplayx/engine-sdk';

import { SegmentDefinitionId } from '../../domains/reference/models/segment';

import { SocketEvent } from './socket-event';

export interface SocketSegmentDefinitionUpdated extends SocketEvent {
  id: SegmentDefinitionId;
  category: ReferenceCategory;
  type: SegmentTypeCode;
  policy: SegmentPolicy;
  style: SegmentStyle;
  visible: boolean;
}
