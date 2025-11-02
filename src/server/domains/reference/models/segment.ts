import { SegmentTypeCode } from '@roleplayx/engine-sdk/segment/models/segment-type';
import { ReferenceCategory } from '@roleplayx/engine-sdk/reference/models/reference-category';
import { SegmentPolicy } from '@roleplayx/engine-sdk/segment/models/segment-policy';
import { SegmentStyle } from '@roleplayx/engine-sdk/segment/models/segment-style';

export type SegmentDefinitionId = string;

export interface RPSegmentDefinition {
  id: SegmentDefinitionId;
  type: SegmentTypeCode;
  category: ReferenceCategory;
  policy: SegmentPolicy;
  style: SegmentStyle;
  visible: boolean;
  createdDate: number;
  lastModifiedDate: number;
}
