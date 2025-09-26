import { Metric, MetricMainKey } from '@roleplayx/engine-sdk';

export type MetricKey = string;

export type MetricValue = number | string | boolean | object[] | Map<string, object>;

export function getMetricKey(metric: Metric) {
  return generateMetricKey(metric.key, {
    subKey: metric.subKey,
    scope: metric.scope,
  });
}

export function generateMetricKey(
  mainKey: MetricMainKey,
  options?: {
    subKey?: string;
    scope?: { type: string; key: string };
  },
) {
  let key = '';
  if (options?.scope) {
    key += `${options.scope.type}:${options.scope.key}:`;
  }

  key += mainKey;

  if (options?.subKey) {
    key += `:${options.subKey}`;
  }

  return key;
}
