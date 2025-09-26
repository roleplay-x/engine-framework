import { ReferenceCategory } from '@roleplayx/engine-sdk';

import { CategoryReferenceId } from '../models/reference';
import { MetricKey, MetricValue } from '../models/metric';

export interface RPReferenceMetricsUpdated {
  id: CategoryReferenceId;
  category: ReferenceCategory;
  referenceId: string;
  metrics: Map<MetricKey, MetricValue>;
}
