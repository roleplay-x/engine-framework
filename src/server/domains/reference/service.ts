import {
  AccessPolicy,
  MetricApi,
  ReferenceApi,
  ReferenceCategory,
  SegmentApi,
} from '@roleplayx/engine-sdk';
import { AdditionalOperation, apply, RulesLogic } from 'json-logic-js';

import { RPServerService } from '../../core/server-service';
import { OnServer } from '../../core/events/decorators';
import { RPSessionAuthorized } from '../session/events/session-authorized';
import { RPSessionCharacterLinked } from '../session/events/session-character-linked';
import { RPSessionFinished } from '../session/events/session-finished';
import { SocketMetricsUpdated } from '../../socket/events/socket-metrics-updated';
import { SessionId } from '../session/models/session';
import { SocketSegmentDefinitionCreated } from '../../socket/events/socket-segment-definition-created';
import { SocketSegmentDefinitionUpdated } from '../../socket/events/socket-segment-definition-updated';
import { SocketSegmentDefinitionRemoved } from '../../socket/events/socket-segment-definition-removed';
import { SocketSegmentCreated } from '../../socket/events/socket-segment-created';
import { SocketSegmentRemoved } from '../../socket/events/socket-segment-removed';

import {
  CategoryReferenceId,
  CategoryReferenceIdParam,
  getCategoryReferenceId,
  RPReference,
} from './models/reference';
import { getMetricKey, MetricKey, MetricValue } from './models/metric';
import { RPSegmentDefinition, SegmentDefinitionId } from './models/segment';

/**
 * Service for managing reference data, segments and metrics in the roleplay server.
 *
 * This service provides functionality for:
 * - Reference data management (accounts, characters, vehicles, etc.)
 * - Metric data retrieval and caching
 * - Segment information management
 * - Bulk data preloading for performance
 *
 * The service maintains local caches of reference data, metrics, and segments
 * that are preloaded during initialization for optimal performance. It supports
 * different reference categories and provides efficient access to related metrics.
 *
 * @example
 * ```typescript
 * // Get metrics for a specific reference
 * const vehicleMetrics = referenceService.getMetrics({
 *   category: ReferenceCategory.Vehicle,
 *   referenceId: 'vehicle_123'
 * });
 * ```
 */
export class ReferenceService extends RPServerService {
  /** Cache of reference data indexed by category reference ID */
  private readonly references: Map<CategoryReferenceId, RPReference> = new Map([]);
  /** Cache of metrics organized by category reference ID and metric key */
  private readonly metrics: Map<CategoryReferenceId, Map<MetricKey, MetricValue>> = new Map([]);
  /** Cache of segments indexed by category reference ID */
  private readonly referenceSegmentDefinitionIds: Map<
    CategoryReferenceId,
    Set<SegmentDefinitionId>
  > = new Map([]);

  /** Map of segment definitions indexed by their unique ID */
  private readonly segmentDefinitions: Map<SegmentDefinitionId, RPSegmentDefinition> = new Map([]);
  /** Map tracking which session is associated with each category reference */
  private readonly refSessionId: Map<CategoryReferenceId, SessionId> = new Map([]);

  /**
   * Initializes the reference service by preloading references and metrics.
   *
   * This method is called during server startup to populate the local caches
   * with reference data and their associated metrics for optimal performance.
   *
   * @override
   * @returns Promise that resolves when initialization is complete
   */
  public override async init(): Promise<void> {
    this.logger.info('Initializing segment definitions...');
    await this.preloadSegmentDefinitions();
    this.logger.info('Initializing vehicle references...');
    await this.preloadReferenceCategory(ReferenceCategory.Vehicle);
    return super.init();
  }

  /**
   * Retrieves all metrics for a specific category reference.
   *
   * Returns a map of metrics associated with the specified category reference ID.
   * Metrics contain detailed information such as values, units, and descriptions
   * for various properties of the reference item.
   *
   * @param categoryReferenceId - The category reference ID (object with category and referenceId, or string)
   * @returns Map of metrics indexed by metric key, empty map if no metrics found
   */
  public getMetrics(categoryReferenceId: CategoryReferenceIdParam): Map<MetricKey, MetricValue> {
    const catRefId = getCategoryReferenceId(categoryReferenceId);
    return this.metrics.get(catRefId) ?? new Map([]);
  }

  /**
   * Retrieves a segment definition by its unique ID.
   *
   * Segment definitions describe rules for categorizing references into segments
   * based on their metric values or other criteria.
   *
   * @param segmentDefinitionId - The unique identifier of the segment definition
   * @returns The segment definition if found, undefined otherwise
   */
  public getSegmentDefinition(
    segmentDefinitionId: SegmentDefinitionId,
  ): RPSegmentDefinition | undefined {
    return this.segmentDefinitions.get(segmentDefinitionId);
  }

  /**
   * Retrieves all segment definitions associated with a specific category reference.
   *
   * Returns an array of segment definitions that are applicable to the given
   * category reference. These definitions can be used to determine which
   * segments the reference belongs to.
   *
   * @param categoryReferenceId - The category reference ID (object with category and referenceId, or string)
   * @returns Array of segment definitions for the reference, empty array if none found
   */
  public getReferenceSegments(
    categoryReferenceId: CategoryReferenceIdParam,
  ): ReadonlyArray<RPSegmentDefinition> {
    const catRefId = getCategoryReferenceId(categoryReferenceId);
    const definitions: RPSegmentDefinition[] = [];
    this.referenceSegmentDefinitionIds.get(catRefId)?.forEach((segDefId) => {
      const segmentDefinition = this.segmentDefinitions.get(segDefId);
      if (segmentDefinition) {
        definitions.push(segmentDefinition);
      }
    });
    return definitions;
  }

  /**
   * Retrieves all unique access policies for a specific category reference.
   *
   * Collects access policies from all segment definitions associated with the
   * reference and returns a deduplicated array of access policies.
   *
   * @param categoryReferenceId - The category reference ID (object with category and referenceId, or string)
   * @returns Array of unique access policies for the reference, empty array if none found
   */
  public getReferenceAccessPolicies(
    categoryReferenceId: CategoryReferenceIdParam,
  ): ReadonlyArray<AccessPolicy> {
    const catRefId = getCategoryReferenceId(categoryReferenceId);
    const accessPolicies: AccessPolicy[] = [];
    this.referenceSegmentDefinitionIds.get(catRefId)?.forEach((segDefId) => {
      const segmentDefinition = this.segmentDefinitions.get(segDefId);
      if (segmentDefinition) {
        accessPolicies.push(...(segmentDefinition.policy.accessPolicies as AccessPolicy[]));
      }
    });

    return [...new Set(accessPolicies)];
  }

  /**
   * Checks if an access policy exists in any of the specified segment definitions.
   *
   * Iterates through the provided segment definition IDs and checks if any of them
   * contain the specified access policy in their access policies list.
   *
   * @param accessPolicy - The access policy to search for
   * @param segmentDefinitionIds - Array of segment definition IDs to check
   * @returns True if any segment definition contains the access policy, false otherwise
   */
  public hasAccessPolicyInSegmentDefinitions(
    accessPolicy: AccessPolicy,
    segmentDefinitionIds: ReadonlyArray<SegmentDefinitionId>,
  ): boolean {
    for (const segmentDefinitionId of segmentDefinitionIds) {
      const segmentDefinition = this.segmentDefinitions.get(segmentDefinitionId);
      if (segmentDefinition && segmentDefinition.policy.accessPolicies.includes(accessPolicy)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Checks if a category reference belongs to a specific segment.
   *
   * @param categoryReferenceId - The category reference ID (object with category and referenceId, or string)
   * @param segmentDefinitionId - The segment definition ID to check
   * @returns True if the reference belongs to the segment, false otherwise
   */
  public hasSegment(
    categoryReferenceId: CategoryReferenceIdParam,
    segmentDefinitionId: SegmentDefinitionId,
  ): boolean {
    const catRefId = getCategoryReferenceId(categoryReferenceId);
    return this.referenceSegmentDefinitionIds.get(catRefId)?.has(segmentDefinitionId) ?? false;
  }

  /**
   * Checks if a category reference has a specific access policy.
   *
   * Searches through all segment definitions associated with the reference
   * to determine if any of them include the specified access policy.
   *
   * @param categoryReferenceId - The category reference ID (object with category and referenceId, or string)
   * @param accessPolicy - The access policy to check for
   * @returns True if the reference has the access policy, false otherwise
   */
  public hasAccessPolicy(
    categoryReferenceId: CategoryReferenceIdParam,
    accessPolicy: AccessPolicy,
  ): boolean {
    const catRefId = getCategoryReferenceId(categoryReferenceId);
    const segmentDefinitionIds = [...(this.referenceSegmentDefinitionIds.get(catRefId) ?? [])];
    for (const segmentDefinitionId of segmentDefinitionIds) {
      const segmentDefinition = this.segmentDefinitions.get(segmentDefinitionId);
      if (segmentDefinition?.policy.accessPolicies.includes(accessPolicy)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Applies JSON Logic rules to metrics data for a specific category reference.
   *
   * Evaluates JSON Logic conditions against the metrics associated with the given
   * category reference ID. This allows for complex conditional logic to be applied
   * to metric values, supporting operations like comparisons, logical operators,
   * arithmetic operations, and more.
   *
   * @param categoryReferenceId - The category reference ID (object with category and referenceId, or string)
   * @param condition - JSON Logic rules to apply to the metrics data
   * @returns The result of applying the JSON Logic rules, or undefined if no metrics found
   *
   * @example
   * ```typescript
   * // Check if vehicle's top speed is greater than 200
   * const result = referenceService.applyMetricsLogic('VEHICLE:vehicle_1', {
   *   '>': [{ 'var': 'top_speed' }, 200]
   * });
   *
   * // Complex condition: high speed AND gasoline fuel
   * const result = referenceService.applyMetricsLogic('VEHICLE:vehicle_1', {
   *   'and': [
   *     { '>': [{ 'var': 'top_speed' }, 200] },
   *     { '==': [{ 'var': 'fuel_type' }, 'Gasoline'] }
   *   ]
   * });
   * ```
   */
  public applyMetricsLogic(
    categoryReferenceId: CategoryReferenceIdParam,
    condition: RulesLogic<AdditionalOperation>,
  ) {
    const catRefId = getCategoryReferenceId(categoryReferenceId);
    const metrics = this.metrics.get(catRefId);
    if (!metrics) {
      return;
    }

    return apply(condition, Object.fromEntries(metrics));
  }

  private async loadReferenceSegments(categoryReferenceId: CategoryReferenceIdParam) {
    const catRefId = getCategoryReferenceId(categoryReferenceId);
    const segments = await this.getEngineApi(ReferenceApi).getReferenceSegments(catRefId);
    const set = new Set([...segments.map((p) => p.segmentDefinitionId)]);
    this.referenceSegmentDefinitionIds.set(catRefId, set);
  }

  private async loadReferenceMetrics(categoryReferenceId: CategoryReferenceIdParam) {
    const catRefId = getCategoryReferenceId(categoryReferenceId);
    const metrics = await this.getEngineApi(ReferenceApi).getReferenceMetrics(catRefId);

    const metricsMap = new Map<MetricKey, MetricValue>([]);
    metrics.forEach((metric) => {
      metricsMap.set(getMetricKey(metric), metric.value);
    });
    this.metrics.set(catRefId, metricsMap);
  }

  private async loadReference(categoryReferenceId: CategoryReferenceIdParam) {
    const catRefId = getCategoryReferenceId(categoryReferenceId);
    const ref = await this.getEngineApi(ReferenceApi).getReferenceById(catRefId);
    await Promise.all([this.loadReferenceMetrics(catRefId), this.loadReferenceSegments(catRefId)]);
    this.references.set(ref.id, ref);
  }

  private async preloadSegmentDefinitions() {
    const segmentDefinitions = await this.getEngineApi(SegmentApi).getSegmentDefinitions();
    segmentDefinitions.forEach((segmentDefinition) =>
      this.segmentDefinitions.set(segmentDefinition.id, segmentDefinition),
    );
  }

  private async preloadReferenceCategory(category: ReferenceCategory) {
    await this.preloadReferences(category);
    await this.preloadReferenceMetrics(category);
    await this.preloadReferenceSegmentDefinitions(category);
  }

  private async preloadReferences(category: ReferenceCategory) {
    let pageIndex = 0;
    while (true) {
      const refs = await this.getEngineApi(ReferenceApi).getReferences({
        category,
        enabled: true,
        pageIndex,
        pageSize: 100,
      });

      refs.items.forEach((ref) => this.references.set(ref.id, ref));
      if (refs.pageCount <= pageIndex) {
        break;
      }

      pageIndex++;
    }
  }

  private async preloadReferenceMetrics(category: ReferenceCategory) {
    let pageIndex = 0;
    while (true) {
      const metrics = await this.getEngineApi(MetricApi).getMetrics({
        category,
        pageIndex,
        pageSize: 100,
      });

      metrics.items.forEach((metric) => {
        let catRefMetrics = this.metrics.get(metric.categoryReferenceId);
        if (!catRefMetrics) {
          catRefMetrics = new Map([]);
          this.metrics.set(metric.categoryReferenceId, catRefMetrics);
        }

        catRefMetrics.set(getMetricKey(metric), metric.value);
      });

      if (metrics.pageCount <= pageIndex) {
        break;
      }

      pageIndex++;
    }
  }

  private async preloadReferenceSegmentDefinitions(category: ReferenceCategory) {
    let pageIndex = 0;
    while (true) {
      const segments = await this.getEngineApi(SegmentApi).getSegments({
        category,
        pageIndex,
        pageSize: 100,
      });

      segments.items.forEach((segment) => {
        const catRefId = getCategoryReferenceId({
          category: segment.category,
          referenceId: segment.referenceId,
        });

        let refSegmentDefinitionIds = this.referenceSegmentDefinitionIds.get(catRefId);
        if (!refSegmentDefinitionIds) {
          refSegmentDefinitionIds = new Set([]);
          this.referenceSegmentDefinitionIds.set(catRefId, refSegmentDefinitionIds);
        }

        refSegmentDefinitionIds.add(segment.segmentDefinitionId);
      });

      if (segments.pageCount <= pageIndex) {
        break;
      }

      pageIndex++;
    }
  }

  private removeReference(categoryReferenceId: CategoryReferenceIdParam, sessionId?: SessionId) {
    const catRefId = getCategoryReferenceId(categoryReferenceId);
    if (sessionId && this.refSessionId.get(catRefId) !== sessionId) {
      return;
    }

    this.references.delete(catRefId);
    this.metrics.delete(catRefId);
    this.referenceSegmentDefinitionIds.delete(catRefId);
  }

  @OnServer('sessionAuthorized')
  private async onSessionAuthorized(payload: RPSessionAuthorized) {
    const catRefId = getCategoryReferenceId({
      category: ReferenceCategory.Account,
      referenceId: payload.account.id,
    });

    this.refSessionId.set(catRefId, payload.sessionId);
    await this.loadReference({
      category: ReferenceCategory.Account,
      referenceId: payload.account.id,
    });
  }

  @OnServer('sessionCharacterLinked')
  private async onSessionCharacterLinked(payload: RPSessionCharacterLinked) {
    const catRefId = getCategoryReferenceId({
      category: ReferenceCategory.Character,
      referenceId: payload.character.id,
    });

    this.refSessionId.set(catRefId, payload.sessionId);
    await this.loadReference({
      category: ReferenceCategory.Character,
      referenceId: payload.character.id,
    });
  }

  @OnServer('sessionFinished')
  private async onSessionFinished(payload: RPSessionFinished) {
    if (payload.accountId) {
      this.removeReference(
        { category: ReferenceCategory.Account, referenceId: payload.accountId },
        payload.sessionId,
      );
    }

    if (payload.characterId) {
      this.removeReference(
        {
          category: ReferenceCategory.Character,
          referenceId: payload.characterId,
        },
        payload.sessionId,
      );
    }
  }

  @OnServer('socketMetricsUpdated')
  private async onSocketMetricsUpdated(payload: SocketMetricsUpdated) {
    const refMetrics = this.metrics.get(payload.referenceId);
    if (!refMetrics) {
      return;
    }

    const metrics = await this.getEngineApi(ReferenceApi).getReferenceMetrics(payload.id, {
      fullKeys: payload.keys,
    });

    const updatedMetrics = new Map<MetricKey, MetricValue>([]);
    for (const metric of metrics) {
      const key = getMetricKey(metric);
      refMetrics.set(key, metric.value);
      updatedMetrics.set(key, metric.value);
    }

    this.eventEmitter.emit('referenceMetricsUpdated', {
      id: payload.id,
      referenceId: payload.referenceId,
      category: payload.category,
      metrics: updatedMetrics,
    });
  }

  @OnServer('socketSegmentDefinitionCreated')
  private async onSocketSegmentDefinitionCreated(payload: SocketSegmentDefinitionCreated) {
    this.segmentDefinitions.set(payload.id, {
      ...payload,
      createdDate: payload.timestamp,
      lastModifiedDate: payload.timestamp,
    });
  }

  @OnServer('socketSegmentDefinitionUpdated')
  private async onSocketSegmentDefinitionUpdated(payload: SocketSegmentDefinitionUpdated) {
    const segmentDefinition = this.segmentDefinitions.get(payload.id);
    if (!segmentDefinition) {
      this.segmentDefinitions.set(payload.id, {
        ...payload,
        createdDate: payload.timestamp,
        lastModifiedDate: payload.timestamp,
      });
      return;
    }

    if (segmentDefinition.lastModifiedDate > payload.timestamp) {
      return;
    }

    this.segmentDefinitions.set(payload.id, {
      ...payload,
      createdDate: segmentDefinition.createdDate,
      lastModifiedDate: payload.timestamp,
    });
  }

  @OnServer('socketSegmentDefinitionRemoved')
  private async onSocketSegmentDefinitionRemoved(payload: SocketSegmentDefinitionRemoved) {
    this.segmentDefinitions.delete(payload.id);
  }

  @OnServer('socketSegmentCreated')
  private async onSocketSegmentCreated(payload: SocketSegmentCreated) {
    const segmentDefinitionIds = this.referenceSegmentDefinitionIds.get(
      payload.categoryReferenceId,
    );

    if (!segmentDefinitionIds) {
      return;
    }

    segmentDefinitionIds.add(payload.segmentDefinitionId);
    this.eventEmitter.emit('segmentCreated', payload);
  }

  @OnServer('socketSegmentRemoved')
  private async onSocketSegmentRemoved(payload: SocketSegmentRemoved) {
    const segmentDefinitionIds = this.referenceSegmentDefinitionIds.get(
      payload.categoryReferenceId,
    );

    if (!segmentDefinitionIds) {
      return;
    }

    segmentDefinitionIds.delete(payload.segmentDefinitionId);
    this.eventEmitter.emit('segmentRemoved', payload);
  }
}
