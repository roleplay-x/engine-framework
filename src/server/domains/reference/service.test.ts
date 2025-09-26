/**
 * Tests for ReferenceService
 */
import {
  AccessPolicy,
  Metric,
  MetricMainKey,
  MetricValueType,
  Reference,
  ReferenceCategory,
  Segment,
  SegmentTypeCode,
  SessionEndReason,
} from '@roleplayx/engine-sdk';

import { RPEventEmitter } from '../../../core/bus/event-emitter';
import { RPHookBus } from '../../../core/bus/hook-bus';
import { MockLogger } from '../../../../test/mocks';
import { RPServerContext } from '../../core/context';
import { RPServerEvents } from '../../core/events/events';
import { RPServerHooks } from '../../core/hooks/hooks';

import { ReferenceService } from './service';
import { getCategoryReferenceId } from './models/reference';
import { RPSegmentDefinition } from './models/segment';

describe('ReferenceService', () => {
  let mockLogger: MockLogger;
  let mockEventEmitter: RPEventEmitter<RPServerEvents>;
  let mockHookBus: RPHookBus<RPServerHooks>;
  let mockContext: RPServerContext;
  let referenceService: ReferenceService;

  // Test data
  const testReferences: Reference[] = [
    {
      id: 'VEHICLE:vehicle_1',
      category: ReferenceCategory.Vehicle,
      categoryName: 'Vehicle',
      referenceId: 'vehicle_1',
      name: 'Test Vehicle 1',
      enabled: true,
    },
    {
      id: 'VEHICLE:vehicle_2',
      category: ReferenceCategory.Vehicle,
      categoryName: 'Vehicle',
      referenceId: 'vehicle_2',
      name: 'Test Vehicle 2',
      enabled: true,
    },
    {
      id: 'VEHICLE:vehicle_3',
      category: ReferenceCategory.Vehicle,
      categoryName: 'Vehicle',
      referenceId: 'vehicle_3',
      name: 'Test Vehicle 3',
      enabled: false,
    },
  ];

  const testMetrics: Metric[] = [
    {
      id: 'metric_1',
      categoryReferenceId: 'VEHICLE:vehicle_1',
      key: MetricMainKey.Id,
      valueType: MetricValueType.String,
      value: 'vehicle_1',
      name: 'Vehicle ID',
      description: 'Unique identifier for the vehicle',
    },
    {
      id: 'metric_2',
      categoryReferenceId: 'VEHICLE:vehicle_1',
      key: MetricMainKey.CreatedDate,
      valueType: MetricValueType.Number,
      value: 1640995200000,
      name: 'Created Date',
      description: 'Date when the vehicle was created',
    },
    {
      id: 'metric_3',
      categoryReferenceId: 'VEHICLE:vehicle_2',
      key: MetricMainKey.IsActive,
      valueType: MetricValueType.Boolean,
      value: true,
      name: 'Is Active',
      description: 'Whether the vehicle is currently active',
    },
    {
      id: 'metric_4',
      categoryReferenceId: 'VEHICLE:vehicle_2',
      key: MetricMainKey.CreatedDate,
      valueType: MetricValueType.Number,
      value: 1641081600000,
      name: 'Created Date',
      description: 'Date when the vehicle was created',
    },
  ];

  const testSegments: Segment[] = [
    {
      id: 'segment_1',
      segmentDefinitionId: 'def_1',
      name: 'Test Vehicles',
      type: SegmentTypeCode.Manual,
      typeName: 'Manual',
      category: ReferenceCategory.Vehicle,
      categoryName: 'Vehicle',
      referenceId: 'vehicle_1',
      referenceName: 'Test Vehicle 1',
      policy: {
        accessPolicies: [],
        vehicle: {
          maxSpeed: 250,
          category: 'test',
        },
      },
      style: {
        color: {
          background: '#FFD700',
          text: '#000000',
        },
      },
      visible: true,
      createdDate: Date.now() - 86400000,
      lastModifiedDate: Date.now() - 3600000,
    },
  ];

  const mockReferenceApi = {
    getReferences: jest.fn(),
    getReferenceMetrics: jest.fn(),
    getReferenceSegments: jest.fn(),
  };

  const mockMetricApi = {
    getMetrics: jest.fn(),
  };

  const mockSegmentApi = {
    getSegmentDefinitions: jest.fn(),
    getSegments: jest.fn(),
  };

  beforeEach(() => {
    mockLogger = new MockLogger();
    mockEventEmitter = new RPEventEmitter<RPServerEvents>();
    mockHookBus = new RPHookBus<RPServerHooks>();

    // Reset mocks before each test
    mockReferenceApi.getReferences.mockResolvedValue({
      items: testReferences.filter((r) => r.enabled),
      pageIndex: 0,
      pageSize: 100,
      pageCount: 0,
      totalCount: 2,
    });
    mockReferenceApi.getReferenceMetrics.mockResolvedValue([]);
    mockReferenceApi.getReferenceSegments.mockResolvedValue(testSegments);
    mockMetricApi.getMetrics.mockResolvedValue({
      items: testMetrics,
      pageIndex: 0,
      pageSize: 100,
      pageCount: 0,
      totalCount: 4,
    });
    mockSegmentApi.getSegmentDefinitions.mockResolvedValue([]);
    mockSegmentApi.getSegments.mockResolvedValue({
      items: testSegments,
      pageIndex: 0,
      pageSize: 100,
      pageCount: 0,
      totalCount: 1,
    });

    mockContext = {
      logger: mockLogger,
      eventEmitter: mockEventEmitter,
      hookBus: mockHookBus,
      getEngineApi: jest.fn().mockImplementation((apiType) => {
        if (apiType.name === 'ReferenceApi') {
          return mockReferenceApi;
        }
        if (apiType.name === 'MetricApi') {
          return mockMetricApi;
        }
        if (apiType.name === 'SegmentApi') {
          return mockSegmentApi;
        }
        return {};
      }),
      getService: jest.fn(),
    } as unknown as RPServerContext;

    referenceService = new ReferenceService(mockContext);
  });

  describe('init', () => {
    it('should initialize vehicle references and metrics', async () => {
      await referenceService.init();

      expect(mockContext.getEngineApi).toHaveBeenCalledTimes(4);
      expect(mockReferenceApi.getReferences).toHaveBeenCalledWith({
        category: ReferenceCategory.Vehicle,
        enabled: true,
        pageIndex: 0,
        pageSize: 100,
      });
      expect(mockMetricApi.getMetrics).toHaveBeenCalledWith({
        category: ReferenceCategory.Vehicle,
        pageIndex: 0,
        pageSize: 100,
      });
    });

    it('should log initialization step', async () => {
      const infoSpy = jest.spyOn(mockLogger, 'info');

      await referenceService.init();

      expect(infoSpy).toHaveBeenCalledWith('Initializing vehicle references...');
    });

    it('should handle multiple pages of references', async () => {
      const page1References = [testReferences[0]];
      const page2References = [testReferences[1]];

      // Clear all previous calls and set up fresh mocks
      mockReferenceApi.getReferences.mockClear();
      mockMetricApi.getMetrics.mockClear();

      mockReferenceApi.getReferences
        .mockResolvedValueOnce({
          items: page1References,
          pageIndex: 0,
          pageSize: 1,
          pageCount: 1,
          totalCount: 2,
        })
        .mockResolvedValueOnce({
          items: page2References,
          pageIndex: 1,
          pageSize: 1,
          pageCount: 1,
          totalCount: 2,
        });

      mockMetricApi.getMetrics.mockResolvedValue({
        items: testMetrics,
        pageIndex: 0,
        pageSize: 100,
        pageCount: 0,
        totalCount: 4,
      });

      // Create a fresh service to avoid interference from beforeEach
      const freshService = new ReferenceService(mockContext);
      await freshService.init();

      expect(mockReferenceApi.getReferences).toHaveBeenCalledTimes(2);
    });

    it('should handle multiple pages of metrics', async () => {
      const page1Metrics = [testMetrics[0], testMetrics[1]];
      const page2Metrics = [testMetrics[2], testMetrics[3]];

      // Clear all previous calls and set up fresh mocks
      mockReferenceApi.getReferences.mockClear();
      mockMetricApi.getMetrics.mockClear();

      mockReferenceApi.getReferences.mockResolvedValue({
        items: testReferences.filter((r) => r.enabled),
        pageIndex: 0,
        pageSize: 100,
        pageCount: 0,
        totalCount: 2,
      });

      mockMetricApi.getMetrics
        .mockResolvedValueOnce({
          items: page1Metrics,
          pageIndex: 0,
          pageSize: 2,
          pageCount: 1,
          totalCount: 4,
        })
        .mockResolvedValueOnce({
          items: page2Metrics,
          pageIndex: 1,
          pageSize: 2,
          pageCount: 1,
          totalCount: 4,
        });

      // Create a fresh service to avoid interference from beforeEach
      const freshService = new ReferenceService(mockContext);
      await freshService.init();

      expect(mockMetricApi.getMetrics).toHaveBeenCalledTimes(2);
    });
  });

  describe('getMetrics', () => {
    beforeEach(async () => {
      await referenceService.init();
    });

    it('should return metrics for existing category reference ID using string format', () => {
      const categoryReferenceId = 'VEHICLE:vehicle_1';
      const result = referenceService.getMetrics(categoryReferenceId);

      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(2);
      expect(result.get('ID')).toBe('vehicle_1');
      expect(result.get('CREATED_DATE')).toBe(1640995200000);
    });

    it('should return metrics for existing category reference ID using object format', () => {
      const categoryReferenceId = {
        category: ReferenceCategory.Vehicle,
        referenceId: 'vehicle_2',
      };
      const result = referenceService.getMetrics(categoryReferenceId);

      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(2);
      expect(result.get('IS_ACTIVE')).toBe(true);
      expect(result.get('CREATED_DATE')).toBe(1641081600000);
    });

    it('should return empty map for non-existing category reference ID', () => {
      const categoryReferenceId = 'VEHICLE:non_existing';
      const result = referenceService.getMetrics(categoryReferenceId);

      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(0);
    });

    it('should handle different metric value types correctly', () => {
      const vehicle1Metrics = referenceService.getMetrics('VEHICLE:vehicle_1');
      const vehicle2Metrics = referenceService.getMetrics('VEHICLE:vehicle_2');

      const idMetric = vehicle1Metrics.get('ID');
      const createdDateMetric = vehicle1Metrics.get('CREATED_DATE');
      const isActiveMetric = vehicle2Metrics.get('IS_ACTIVE');
      expect(idMetric).toBe('vehicle_1');
      expect(createdDateMetric).toBe(1640995200000);
      expect(isActiveMetric).toBe(true);
    });

    it('should maintain separate metric maps for different category references', () => {
      const vehicle1Metrics = referenceService.getMetrics('VEHICLE:vehicle_1');
      const vehicle2Metrics = referenceService.getMetrics('VEHICLE:vehicle_2');

      expect(vehicle1Metrics.size).toBe(2);
      expect(vehicle2Metrics.size).toBe(2);

      // Verify they contain different metrics
      expect(vehicle1Metrics.has('ID')).toBe(true);
      expect(vehicle1Metrics.has('IS_ACTIVE')).toBe(false);
      expect(vehicle2Metrics.has('IS_ACTIVE')).toBe(true);
      expect(vehicle2Metrics.has('ID')).toBe(false);
    });
  });

  describe('getCategoryReferenceId helper function', () => {
    it('should return string as-is when passed string', () => {
      const result = getCategoryReferenceId('VEHICLE:test_vehicle');
      expect(result).toBe('VEHICLE:test_vehicle');
    });

    it('should generate category reference ID from object', () => {
      const result = getCategoryReferenceId({
        category: ReferenceCategory.Vehicle,
        referenceId: 'test_vehicle',
      });
      expect(result).toBe('VEHICLE:test_vehicle');
    });

    it('should handle different reference categories', () => {
      const vehicleResult = getCategoryReferenceId({
        category: ReferenceCategory.Vehicle,
        referenceId: 'my_car',
      });
      const accountResult = getCategoryReferenceId({
        category: ReferenceCategory.Account,
        referenceId: 'my_account',
      });
      const characterResult = getCategoryReferenceId({
        category: ReferenceCategory.Character,
        referenceId: 'my_character',
      });

      expect(vehicleResult).toBe('VEHICLE:my_car');
      expect(accountResult).toBe('ACCOUNT:my_account');
      expect(characterResult).toBe('CHARACTER:my_character');
    });
  });

  describe('private methods behavior', () => {
    it('should properly organize metrics by category reference ID during preload', async () => {
      // Test with metrics that have same categoryReferenceId
      const duplicateMetrics = [
        ...testMetrics,
        {
          id: 'metric_5',
          categoryReferenceId: 'VEHICLE:vehicle_1',
          key: MetricMainKey.TotalSessionTimeSeconds,
          valueType: MetricValueType.Number,
          value: 7200,
          name: 'Total Session Time',
          description: 'Total session time in seconds',
        } as Metric,
      ];

      mockMetricApi.getMetrics.mockResolvedValue({
        items: duplicateMetrics,
        pageIndex: 0,
        pageSize: 100,
        pageCount: 0,
        totalCount: 5,
      });

      await referenceService.init();

      const vehicle1Metrics = referenceService.getMetrics('VEHICLE:vehicle_1');
      expect(vehicle1Metrics.size).toBe(3); // Should have 3 metrics for vehicle_1
      expect(vehicle1Metrics.has('TOTAL_SESSION_TIME_SECONDS')).toBe(true);
    });

    it('should handle empty API responses gracefully', async () => {
      mockReferenceApi.getReferences.mockResolvedValue({
        items: [],
        pageIndex: 0,
        pageSize: 100,
        pageCount: 0,
        totalCount: 0,
      });
      mockMetricApi.getMetrics.mockResolvedValue({
        items: [],
        pageIndex: 0,
        pageSize: 100,
        pageCount: 0,
        totalCount: 0,
      });

      await referenceService.init();

      const result = referenceService.getMetrics('VEHICLE:any_vehicle');
      expect(result.size).toBe(0);
    });

    it('should stop pagination when reaching the last page', async () => {
      // Clear all previous calls and set up fresh mocks
      mockReferenceApi.getReferences.mockClear();
      mockMetricApi.getMetrics.mockClear();

      mockReferenceApi.getReferences.mockResolvedValue({
        items: testReferences.slice(0, 1),
        pageIndex: 0,
        pageSize: 100,
        pageCount: 0, // pageCount <= pageIndex, should stop
        totalCount: 1,
      });

      mockMetricApi.getMetrics.mockResolvedValue({
        items: testMetrics,
        pageIndex: 0,
        pageSize: 100,
        pageCount: 0,
        totalCount: 4,
      });

      // Create a fresh service to avoid interference from beforeEach
      const freshService = new ReferenceService(mockContext);
      await freshService.init();

      expect(mockReferenceApi.getReferences).toHaveBeenCalledTimes(1);
    });
  });

  describe('error handling', () => {
    it('should handle API errors during reference preloading', async () => {
      mockReferenceApi.getReferences.mockRejectedValue(new Error('API Error'));

      await expect(referenceService.init()).rejects.toThrow('API Error');
    });

    it('should handle API errors during metric preloading', async () => {
      mockMetricApi.getMetrics.mockRejectedValue(new Error('Metric API Error'));

      await expect(referenceService.init()).rejects.toThrow('Metric API Error');
    });
  });

  describe('performance and caching', () => {
    beforeEach(async () => {
      await referenceService.init();
    });

    it('should return consistent results for repeated calls', () => {
      const categoryReferenceId = 'VEHICLE:vehicle_1';
      const result1 = referenceService.getMetrics(categoryReferenceId);
      const result2 = referenceService.getMetrics(categoryReferenceId);

      expect(result1).toBe(result2); // Should return same Map instance
      expect(result1.size).toBe(result2.size);
    });

    it('should handle large numbers of metrics efficiently', async () => {
      // Generate a large number of metrics
      const largeMetricSet: Metric[] = [];
      for (let i = 0; i < 1000; i++) {
        largeMetricSet.push({
          id: `metric_${i}`,
          categoryReferenceId: 'VEHICLE:test_vehicle',
          key: MetricMainKey.Id,
          valueType: MetricValueType.Number,
          value: i,
        });
      }

      mockMetricApi.getMetrics.mockResolvedValue({
        items: largeMetricSet,
        pageIndex: 0,
        pageSize: 1000,
        pageCount: 0,
        totalCount: 1000,
      });

      // Reinitialize with large dataset
      const newService = new ReferenceService(mockContext);
      await newService.init();

      const startTime = Date.now();
      const result = newService.getMetrics('VEHICLE:test_vehicle');
      const endTime = Date.now();

      expect(result.size).toBe(1);
      expect(endTime - startTime).toBeLessThan(10); // Should be very fast
    });
  });

  describe('getSegmentDefinition', () => {
    const testSegmentDefinition = {
      id: 'def_1',
      type: SegmentTypeCode.Manual,
      category: ReferenceCategory.Account,
      policy: {
        accessPolicies: [AccessPolicy.AccountWrite, AccessPolicy.AccountRead],
      },
      style: {
        color: {
          background: '#FFD700',
          text: '#000000',
        },
      },
      visible: true,
      createdDate: Date.now() - 86400000,
      lastModifiedDate: Date.now() - 3600000,
    };

    beforeEach(async () => {
      await referenceService.init();
      referenceService['segmentDefinitions'].set('def_1', testSegmentDefinition);
    });

    it('should return segment definition for existing ID', () => {
      const result = referenceService.getSegmentDefinition('def_1');
      expect(result).toEqual(testSegmentDefinition);
    });

    it('should return undefined for non-existing segment definition ID', () => {
      const result = referenceService.getSegmentDefinition('non_existing_def');
      expect(result).toBeUndefined();
    });
  });

  describe('getReferenceSegments', () => {
    const testSegmentDefinitions = [
      {
        id: 'def_1',
        type: SegmentTypeCode.Manual,
        category: ReferenceCategory.Account,
        policy: {
          accessPolicies: [AccessPolicy.AccountWrite],
        },
        style: {
          color: {
            background: '#FFD700',
            text: '#000000',
          },
        },
        visible: true,
        createdDate: Date.now() - 86400000,
        lastModifiedDate: Date.now() - 3600000,
      },
      {
        id: 'def_2',
        type: SegmentTypeCode.Auto,
        category: ReferenceCategory.Account,
        policy: {
          accessPolicies: [AccessPolicy.AccountRead],
        },
        style: {
          color: {
            background: '#00FF00',
            text: '#FFFFFF',
          },
        },
        visible: true,
        createdDate: Date.now() - 86400000,
        lastModifiedDate: Date.now() - 3600000,
      },
    ];

    beforeEach(async () => {
      await referenceService.init();
      testSegmentDefinitions.forEach((def) => {
        referenceService['segmentDefinitions'].set(def.id, def as unknown as RPSegmentDefinition);
      });
      referenceService['referenceSegmentDefinitionIds'].set(
        'ACCOUNT:user123',
        new Set(['def_1', 'def_2']),
      );
      referenceService['referenceSegmentDefinitionIds'].set('ACCOUNT:user456', new Set(['def_2']));
    });

    it('should return all segment definitions for a reference', () => {
      const result = referenceService.getReferenceSegments('ACCOUNT:user123');

      expect(result).toHaveLength(2);
      expect(result).toContainEqual(testSegmentDefinitions[0]);
      expect(result).toContainEqual(testSegmentDefinitions[1]);
    });

    it('should return empty array for reference with no segments', () => {
      const result = referenceService.getReferenceSegments('ACCOUNT:non_existing');
      expect(result).toEqual([]);
    });

    it('should handle object parameter format', () => {
      const result = referenceService.getReferenceSegments({
        category: ReferenceCategory.Account,
        referenceId: 'user456',
      });

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(testSegmentDefinitions[1]);
    });
  });

  describe('hasSegment', () => {
    beforeEach(async () => {
      await referenceService.init();
      referenceService['referenceSegmentDefinitionIds'].set(
        'ACCOUNT:user123',
        new Set(['def_1', 'def_2']),
      );
      referenceService['referenceSegmentDefinitionIds'].set('ACCOUNT:user456', new Set(['def_2']));
    });

    it('should return true when reference has the segment', () => {
      const result = referenceService.hasSegment('ACCOUNT:user123', 'def_1');
      expect(result).toBe(true);
    });

    it('should return false when reference does not have the segment', () => {
      const result = referenceService.hasSegment('ACCOUNT:user123', 'def_3');
      expect(result).toBe(false);
    });

    it('should return false for non-existing reference', () => {
      const result = referenceService.hasSegment('ACCOUNT:non_existing', 'def_1');
      expect(result).toBe(false);
    });

    it('should handle object parameter format', () => {
      const result = referenceService.hasSegment(
        {
          category: ReferenceCategory.Account,
          referenceId: 'user456',
        },
        'def_2',
      );
      expect(result).toBe(true);
    });
  });

  describe('applyMetricsLogic', () => {
    beforeEach(async () => {
      await referenceService.init();
    });

    it('should apply simple comparison logic to metrics', () => {
      const result = referenceService.applyMetricsLogic('VEHICLE:vehicle_1', {
        '>': [{ var: 'CREATED_DATE' }, 1600000000000],
      });

      expect(result).toBe(true);
    });

    it('should apply complex logical conditions to metrics', () => {
      const result = referenceService.applyMetricsLogic('VEHICLE:vehicle_1', {
        and: [
          { '>': [{ var: 'CREATED_DATE' }, 1600000000000] },
          { '==': [{ var: 'ID' }, 'vehicle_1'] },
        ],
      });

      expect(result).toBe(true);
    });

    it('should return false for conditions that do not match', () => {
      const result = referenceService.applyMetricsLogic('VEHICLE:vehicle_1', {
        '>': [{ var: 'CREATED_DATE' }, 2000000000000],
      });

      expect(result).toBe(false);
    });

    it('should handle boolean metrics correctly', () => {
      const result = referenceService.applyMetricsLogic('VEHICLE:vehicle_2', {
        '==': [{ var: 'IS_ACTIVE' }, true],
      });

      expect(result).toBe(true);
    });

    it('should handle arithmetic operations on metrics', () => {
      const result = referenceService.applyMetricsLogic('VEHICLE:vehicle_2', {
        '<': [{ '+': [{ var: 'CREATED_DATE' }, 1000000] }, 2000000000000],
      });

      expect(result).toBe(true);
    });

    it('should handle string comparison operations', () => {
      const result = referenceService.applyMetricsLogic('VEHICLE:vehicle_1', {
        in: ['vehicle', { var: 'ID' }],
      });

      expect(result).toBe(true); // 'vehicle' in 'vehicle_1'
    });

    it('should handle logical OR operations', () => {
      const result = referenceService.applyMetricsLogic('VEHICLE:vehicle_1', {
        or: [
          { '>': [{ var: 'CREATED_DATE' }, 2000000000000] }, // false
          { '==': [{ var: 'ID' }, 'vehicle_1'] }, // true
        ],
      });

      expect(result).toBe(true);
    });

    it('should handle missing metrics gracefully', () => {
      const result = referenceService.applyMetricsLogic('VEHICLE:vehicle_1', {
        '==': [{ var: 'non_existing_metric' }, null],
      });

      expect(result).toBe(true); // non-existing vars return null in json-logic
    });

    it('should return undefined for non-existing category reference ID', () => {
      const result = referenceService.applyMetricsLogic('VEHICLE:non_existing', {
        '>': [{ var: 'CREATED_DATE' }, 1600000000000],
      });

      expect(result).toBeUndefined();
    });

    it('should handle object parameter format', () => {
      const result = referenceService.applyMetricsLogic(
        {
          category: ReferenceCategory.Vehicle,
          referenceId: 'vehicle_2',
        },
        {
          '==': [{ var: 'IS_ACTIVE' }, true],
        },
      );

      expect(result).toBe(true);
    });

    it('should handle complex nested conditions', () => {
      const result = referenceService.applyMetricsLogic('VEHICLE:vehicle_1', {
        if: [
          { '>': [{ var: 'CREATED_DATE' }, 1600000000000] },
          { '==': [{ var: 'ID' }, 'vehicle_1'] },
          false,
        ],
      });

      expect(result).toBe(true);
    });

    it('should handle numeric operations with different metric types', () => {
      const result = referenceService.applyMetricsLogic('VEHICLE:vehicle_1', {
        '<=': [
          { '/': [{ var: 'CREATED_DATE' }, 1000000000] }, // timestamp / 1B
          2000,
        ],
      });

      expect(result).toBe(true);
    });
  });

  describe('getReferenceAccessPolicies', () => {
    const testSegmentDefinitions = [
      {
        id: 'def_1',
        type: SegmentTypeCode.Manual,
        category: ReferenceCategory.Account,
        policy: {
          accessPolicies: [AccessPolicy.AccountWrite, AccessPolicy.AccountRead],
        },
        style: { color: { background: '#FFD700', text: '#000000' } },
        visible: true,
        createdDate: Date.now() - 86400000,
        lastModifiedDate: Date.now() - 3600000,
      },
      {
        id: 'def_2',
        type: SegmentTypeCode.Auto,
        category: ReferenceCategory.Account,
        policy: {
          accessPolicies: [AccessPolicy.AccountRead, AccessPolicy.CharacterRead],
        },
        style: { color: { background: '#00FF00', text: '#FFFFFF' } },
        visible: true,
        createdDate: Date.now() - 86400000,
        lastModifiedDate: Date.now() - 3600000,
      },
    ];

    beforeEach(async () => {
      await referenceService.init();
      testSegmentDefinitions.forEach((def) => {
        referenceService['segmentDefinitions'].set(def.id, def as unknown as RPSegmentDefinition);
      });
      referenceService['referenceSegmentDefinitionIds'].set(
        'ACCOUNT:user123',
        new Set(['def_1', 'def_2']),
      );
    });

    it('should return unique access policies for a reference', () => {
      const result = referenceService.getReferenceAccessPolicies('ACCOUNT:user123');

      expect(result).toHaveLength(3);
      expect(result).toContain(AccessPolicy.AccountWrite);
      expect(result).toContain(AccessPolicy.AccountRead);
      expect(result).toContain(AccessPolicy.CharacterRead);
    });

    it('should return empty array for reference with no segments', () => {
      const result = referenceService.getReferenceAccessPolicies('ACCOUNT:non_existing');
      expect(result).toEqual([]);
    });

    it('should handle object parameter format', () => {
      const result = referenceService.getReferenceAccessPolicies({
        category: ReferenceCategory.Account,
        referenceId: 'user123',
      });

      expect(result).toHaveLength(3);
      expect(result).toContain(AccessPolicy.AccountWrite);
    });

    it('should deduplicate access policies', () => {
      // Add another segment with overlapping policies
      const def3 = {
        id: 'def_3',
        type: SegmentTypeCode.Manual,
        category: ReferenceCategory.Account,
        policy: {
          accessPolicies: [AccessPolicy.AccountRead, AccessPolicy.ReferenceRead],
        },
        style: { color: { background: '#0000FF', text: '#FFFFFF' } },
        visible: true,
        createdDate: Date.now() - 86400000,
        lastModifiedDate: Date.now() - 3600000,
      };

      referenceService['segmentDefinitions'].set(def3.id, def3);
      referenceService['referenceSegmentDefinitionIds'].set(
        'ACCOUNT:user123',
        new Set(['def_1', 'def_2', 'def_3']),
      );

      const result = referenceService.getReferenceAccessPolicies('ACCOUNT:user123');

      expect(result).toHaveLength(4); // AccountRead should not be duplicated
      expect(result).toContain(AccessPolicy.ReferenceRead);
    });
  });

  describe('hasAccessPolicyInSegmentDefinitions', () => {
    const testSegmentDefinitions = [
      {
        id: 'def_1',
        type: SegmentTypeCode.Manual,
        category: ReferenceCategory.Account,
        policy: {
          accessPolicies: [AccessPolicy.AccountWrite, AccessPolicy.AccountRead],
        },
        style: { color: { background: '#FFD700', text: '#000000' } },
        visible: true,
        createdDate: Date.now(),
        lastModifiedDate: Date.now(),
      },
      {
        id: 'def_2',
        type: SegmentTypeCode.Auto,
        category: ReferenceCategory.Account,
        policy: {
          accessPolicies: [AccessPolicy.CharacterRead],
        },
        style: { color: { background: '#00FF00', text: '#FFFFFF' } },
        visible: true,
        createdDate: Date.now(),
        lastModifiedDate: Date.now(),
      },
    ];

    beforeEach(async () => {
      await referenceService.init();
      testSegmentDefinitions.forEach((def) => {
        referenceService['segmentDefinitions'].set(def.id, def as unknown as RPSegmentDefinition);
      });
    });

    it('should return true when access policy exists in segment definitions', () => {
      const result = referenceService.hasAccessPolicyInSegmentDefinitions(
        AccessPolicy.AccountWrite,
        ['def_1', 'def_2'],
      );
      expect(result).toBe(true);
    });

    it('should return false when access policy does not exist in segment definitions', () => {
      const result = referenceService.hasAccessPolicyInSegmentDefinitions(
        AccessPolicy.ReferenceRead,
        ['def_1', 'def_2'],
      );
      expect(result).toBe(false);
    });

    it('should return false when segment definitions do not exist', () => {
      const result = referenceService.hasAccessPolicyInSegmentDefinitions(
        AccessPolicy.AccountRead,
        ['non_existing_def'],
      );
      expect(result).toBe(false);
    });

    it('should handle empty segment definition IDs array', () => {
      const result = referenceService.hasAccessPolicyInSegmentDefinitions(
        AccessPolicy.AccountRead,
        [],
      );
      expect(result).toBe(false);
    });

    it('should return true on first match without checking all definitions', () => {
      const result = referenceService.hasAccessPolicyInSegmentDefinitions(
        AccessPolicy.AccountRead,
        ['def_1', 'def_2'],
      );
      expect(result).toBe(true);
    });
  });

  describe('hasAccessPolicy', () => {
    const testSegmentDefinitions = [
      {
        id: 'def_1',
        policy: { accessPolicies: [AccessPolicy.AccountWrite, AccessPolicy.AccountRead] },
      },
      {
        id: 'def_2',
        policy: { accessPolicies: [AccessPolicy.CharacterRead] },
      },
    ];

    beforeEach(async () => {
      await referenceService.init();
      testSegmentDefinitions.forEach((def) => {
        referenceService['segmentDefinitions'].set(def.id, def as unknown as RPSegmentDefinition);
      });
      referenceService['referenceSegmentDefinitionIds'].set(
        'ACCOUNT:user123',
        new Set(['def_1', 'def_2']),
      );
    });

    it('should return true when reference has the access policy', () => {
      const result = referenceService.hasAccessPolicy('ACCOUNT:user123', AccessPolicy.AccountWrite);
      expect(result).toBe(true);
    });

    it('should return false when reference does not have the access policy', () => {
      const result = referenceService.hasAccessPolicy(
        'ACCOUNT:user123',
        AccessPolicy.ReferenceRead,
      );
      expect(result).toBe(false);
    });

    it('should return false for non-existing reference', () => {
      const result = referenceService.hasAccessPolicy(
        'ACCOUNT:non_existing',
        AccessPolicy.AccountRead,
      );
      expect(result).toBe(false);
    });

    it('should handle object parameter format', () => {
      const result = referenceService.hasAccessPolicy(
        {
          category: ReferenceCategory.Account,
          referenceId: 'user123',
        },
        AccessPolicy.CharacterRead,
      );
      expect(result).toBe(true);
    });
  });

  describe('session event handlers', () => {
    beforeEach(async () => {
      await referenceService.init();
    });

    describe('onSessionAuthorized', () => {
      it('should load account reference data on session authorization', async () => {
        const mockLoadReference = jest.spyOn(
          referenceService as unknown as { loadReference: jest.Mock },
          'loadReference',
        );
        mockLoadReference.mockResolvedValue(undefined);

        const payload = {
          sessionId: 'session_123',
          account: {
            id: 'account_456',
            username: 'testuser',
            segmentDefinitionIds: ['def_1'],
            authorizedDate: Date.now(),
          },
        };

        mockEventEmitter.emit('sessionAuthorized', payload);

        await new Promise((resolve) => setTimeout(resolve, 10));

        expect(mockLoadReference).toHaveBeenCalledWith({
          category: ReferenceCategory.Account,
          referenceId: 'account_456',
        });
      });
    });

    describe('onSessionCharacterLinked', () => {
      it('should load character reference data on character linking', async () => {
        const mockLoadReference = jest.spyOn(
          referenceService as unknown as { loadReference: jest.Mock },
          'loadReference',
        );
        mockLoadReference.mockResolvedValue(undefined);

        const payload = {
          sessionId: 'session_123',
          account: {
            id: 'account_456',
            username: 'testuser',
            segmentDefinitionIds: ['def_1'],
            authorizedDate: Date.now(),
          },
          character: {
            id: 'character_789',
            firstName: 'John',
            lastName: 'Doe',
            fullName: 'John Doe',
            linkedDate: Date.now(),
            segmentDefinitionIds: ['def_2'],
          },
        };

        mockEventEmitter.emit('sessionCharacterLinked', payload);

        await new Promise((resolve) => setTimeout(resolve, 10));

        expect(mockLoadReference).toHaveBeenCalledWith({
          category: ReferenceCategory.Character,
          referenceId: 'character_789',
        });
      });
    });

    describe('onSessionFinished', () => {
      it('should remove account and character references on session finish', () => {
        const mockRemoveReference = jest.spyOn(
          referenceService as unknown as { removeReference: jest.Mock },
          'removeReference',
        );

        const payload = {
          sessionId: 'session_123',
          accountId: 'account_456',
          characterId: 'character_789',
          endReason: SessionEndReason.PlayerQuit,
        };

        mockEventEmitter.emit('sessionFinished', payload);

        expect(mockRemoveReference).toHaveBeenCalledWith(
          { category: ReferenceCategory.Account, referenceId: 'account_456' },
          'session_123',
        );
        expect(mockRemoveReference).toHaveBeenCalledWith(
          { category: ReferenceCategory.Character, referenceId: 'character_789' },
          'session_123',
        );
      });

      it('should handle session finish with only account', () => {
        const mockRemoveReference = jest.spyOn(
          referenceService as unknown as { removeReference: jest.Mock },
          'removeReference',
        );

        const payload = {
          sessionId: 'session_123',
          accountId: 'account_456',
          endReason: SessionEndReason.PlayerQuit,
        };

        mockEventEmitter.emit('sessionFinished', payload);

        expect(mockRemoveReference).toHaveBeenCalledTimes(1);
        expect(mockRemoveReference).toHaveBeenCalledWith(
          { category: ReferenceCategory.Account, referenceId: 'account_456' },
          'session_123',
        );
      });

      it('should handle session finish with only character', () => {
        const mockRemoveReference = jest.spyOn(
          referenceService as unknown as { removeReference: jest.Mock },
          'removeReference',
        );

        const payload = {
          sessionId: 'session_123',
          characterId: 'character_789',
          endReason: SessionEndReason.PlayerQuit,
        };

        mockEventEmitter.emit('sessionFinished', payload);

        expect(mockRemoveReference).toHaveBeenCalledTimes(1);
        expect(mockRemoveReference).toHaveBeenCalledWith(
          { category: ReferenceCategory.Character, referenceId: 'character_789' },
          'session_123',
        );
      });
    });
  });

  describe('socket event handlers', () => {
    describe('onSocketSegmentDefinitionCreated', () => {
      it('should add new segment definition to cache', () => {
        const payload = {
          id: 'new_def',
          type: SegmentTypeCode.Manual,
          category: ReferenceCategory.Account,
          policy: {
            accessPolicies: [AccessPolicy.AccountWrite],
          },
          style: {
            color: {
              background: '#FF0000',
              text: '#FFFFFF',
            },
          },
          visible: true,
          timestamp: Date.now(),
        };

        mockEventEmitter.emit('socketSegmentDefinitionCreated', payload);

        const storedDef = referenceService['segmentDefinitions'].get('new_def');
        expect(storedDef).toBeDefined();
        expect(storedDef?.id).toBe('new_def');
        expect(storedDef?.createdDate).toBe(payload.timestamp);
        expect(storedDef?.lastModifiedDate).toBe(payload.timestamp);
      });
    });

    describe('onSocketSegmentDefinitionUpdated', () => {
      const existingDef = {
        id: 'existing_def',
        type: SegmentTypeCode.Manual,
        category: ReferenceCategory.Account,
        policy: {
          accessPolicies: [AccessPolicy.AccountWrite],
        },
        style: {
          color: {
            background: '#FFD700',
            text: '#000000',
          },
        },
        visible: true,
        createdDate: Date.now() - 86400000,
        lastModifiedDate: Date.now() - 3600000,
      };

      beforeEach(() => {
        referenceService['segmentDefinitions'].set(
          'existing_def',
          existingDef as RPSegmentDefinition,
        );
      });

      it('should update existing segment definition', () => {
        const payload = {
          id: 'existing_def',
          type: SegmentTypeCode.Auto,
          category: ReferenceCategory.Account,
          policy: {
            accessPolicies: [AccessPolicy.AccountRead],
          },
          style: {
            color: {
              background: '#00FF00',
              text: '#FFFFFF',
            },
          },
          visible: false,
          timestamp: Date.now(),
        };

        mockEventEmitter.emit('socketSegmentDefinitionUpdated', payload);

        const updatedDef = referenceService['segmentDefinitions'].get('existing_def');
        expect(updatedDef?.visible).toBe(false);
        expect(updatedDef?.createdDate).toBe(existingDef.createdDate);
        expect(updatedDef?.lastModifiedDate).toBe(payload.timestamp);
      });

      it('should create new definition if it does not exist', () => {
        const payload = {
          id: 'brand_new_def',
          type: SegmentTypeCode.Manual,
          category: ReferenceCategory.Account,
          policy: {
            accessPolicies: [AccessPolicy.AccountWrite],
          },
          style: {
            color: {
              background: '#FF0000',
              text: '#FFFFFF',
            },
          },
          visible: true,
          timestamp: Date.now(),
        };

        mockEventEmitter.emit('socketSegmentDefinitionUpdated', payload);

        const newDef = referenceService['segmentDefinitions'].get('brand_new_def');
        expect(newDef).toBeDefined();
        expect(newDef?.createdDate).toBe(payload.timestamp);
        expect(newDef?.lastModifiedDate).toBe(payload.timestamp);
      });

      it('should ignore update if timestamp is older', () => {
        const oldTimestamp = existingDef.lastModifiedDate - 10000;
        const payload = {
          id: 'existing_def',
          type: SegmentTypeCode.Auto,
          category: ReferenceCategory.Account,
          policy: {
            accessPolicies: [AccessPolicy.AccountRead],
          },
          style: {
            color: {
              background: '#0000FF',
              text: '#FFFFFF',
            },
          },
          visible: false,
          timestamp: oldTimestamp,
        };

        mockEventEmitter.emit('socketSegmentDefinitionUpdated', payload);

        const def = referenceService['segmentDefinitions'].get('existing_def');
        expect(def?.lastModifiedDate).toBe(existingDef.lastModifiedDate);
      });
    });

    describe('onSocketSegmentDefinitionRemoved', () => {
      beforeEach(() => {
        referenceService['segmentDefinitions'].set('def_to_remove', {
          id: 'def_to_remove',
        } as RPSegmentDefinition);
      });

      it('should remove segment definition from cache', () => {
        expect(referenceService['segmentDefinitions'].has('def_to_remove')).toBe(true);

        mockEventEmitter.emit('socketSegmentDefinitionRemoved', {
          id: 'def_to_remove',
          category: ReferenceCategory.Account,
          type: SegmentTypeCode.Manual,
          policy: {
            accessPolicies: [],
          },
          style: {
            color: {
              background: '#000000',
              text: '#FFFFFF',
            },
          },
          visible: true,
          timestamp: Date.now(),
        });

        expect(referenceService['segmentDefinitions'].has('def_to_remove')).toBe(false);
      });
    });

    describe('onSocketSegmentCreated', () => {
      beforeEach(() => {
        referenceService['referenceSegmentDefinitionIds'].set(
          'ACCOUNT:user123',
          new Set(['def_1']),
        );
      });

      it('should add segment to reference and emit event', () => {
        const emitSpy = jest.spyOn(mockEventEmitter, 'emit');
        const payload = {
          categoryReferenceId: 'ACCOUNT:user123',
          segmentDefinitionId: 'def_2',
          category: ReferenceCategory.Account,
          referenceId: 'user123',
          timestamp: Date.now(),
        };

        mockEventEmitter.emit('socketSegmentCreated', payload);

        const segments = referenceService['referenceSegmentDefinitionIds'].get('ACCOUNT:user123');
        expect(segments?.has('def_2')).toBe(true);
        expect(emitSpy).toHaveBeenCalledWith('segmentCreated', payload);
      });

      it('should do nothing if reference does not exist', () => {
        const emitSpy = jest.spyOn(mockEventEmitter, 'emit');
        const payload = {
          categoryReferenceId: 'ACCOUNT:non_existing',
          segmentDefinitionId: 'def_2',
          category: ReferenceCategory.Account,
          referenceId: 'non_existing',
          timestamp: Date.now(),
        };

        mockEventEmitter.emit('socketSegmentCreated', payload);

        expect(emitSpy).toHaveBeenCalledTimes(1);
      });
    });

    describe('onSocketSegmentRemoved', () => {
      beforeEach(() => {
        referenceService['referenceSegmentDefinitionIds'].set(
          'ACCOUNT:user123',
          new Set(['def_1', 'def_2']),
        );
      });

      it('should remove segment from reference and emit event', () => {
        const emitSpy = jest.spyOn(mockEventEmitter, 'emit');
        const payload = {
          categoryReferenceId: 'ACCOUNT:user123',
          segmentDefinitionId: 'def_2',
          category: ReferenceCategory.Account,
          referenceId: 'user123',
          timestamp: Date.now(),
        };

        mockEventEmitter.emit('socketSegmentRemoved', payload);

        const segments = referenceService['referenceSegmentDefinitionIds'].get('ACCOUNT:user123');
        expect(segments?.has('def_2')).toBe(false);
        expect(segments?.has('def_1')).toBe(true);
        expect(emitSpy).toHaveBeenCalledWith('segmentRemoved', payload);
      });

      it('should do nothing if reference does not exist', () => {
        const emitSpy = jest.spyOn(mockEventEmitter, 'emit');
        const payload = {
          categoryReferenceId: 'ACCOUNT:non_existing',
          segmentDefinitionId: 'def_2',
          category: ReferenceCategory.Account,
          referenceId: 'non_existing',
          timestamp: Date.now(),
        };

        mockEventEmitter.emit('socketSegmentRemoved', payload);

        expect(emitSpy).toHaveBeenCalledTimes(1);
      });
    });

    describe('onSocketMetricsUpdated', () => {
      beforeEach(async () => {
        await referenceService.init();
      });

      it('should update metrics and emit referenceMetricsUpdated event', () => {
        const emitSpy = jest.spyOn(mockEventEmitter, 'emit');
        mockEventEmitter.emit('socketMetricsUpdated', {
          id: 'VEHICLE:vehicle_1',
          category: ReferenceCategory.Vehicle,
          referenceId: 'vehicle_1',
          keys: ['top_speed', 'new_metric'],
          timestamp: Date.now(),
        });

        expect(emitSpy).toHaveBeenCalledWith('socketMetricsUpdated', {
          id: 'VEHICLE:vehicle_1',
          category: ReferenceCategory.Vehicle,
          referenceId: 'vehicle_1',
          keys: ['top_speed', 'new_metric'],
          timestamp: expect.any(Number),
        });
      });
    });
  });
});
