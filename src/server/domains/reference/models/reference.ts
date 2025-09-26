import { Reference, ReferenceCategory } from '@roleplayx/engine-sdk';

export type CategoryReferenceId = string;

export type CategoryReferenceIdParam =
  | CategoryReferenceId
  | { category: ReferenceCategory; referenceId: string };

export interface RPReference extends Reference {
  id: CategoryReferenceId;
}

export function getCategoryReferenceId(data: CategoryReferenceIdParam): CategoryReferenceId {
  if (typeof data === 'string') {
    return data;
  }
  return `${data.category}:${data.referenceId}`;
}
