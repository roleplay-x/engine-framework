import { ReferenceCategory } from '@roleplayx/engine-sdk';

import { CategoryReferenceId } from '../models/reference';

export interface RPSegmentCreated {
  categoryReferenceId: CategoryReferenceId;
  category: ReferenceCategory;
  referenceId: string;
  segmentDefinitionId: string;
}
