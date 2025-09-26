/**
 * Common mocks for testing
 */
import { RPLogger } from '../src/core/logger';

import Mocked = jest.Mocked;

/**
 * Mock logger that captures log calls for testing
 */
export class MockLogger implements RPLogger {
  public logs: Array<{ level: string; message: string; args: unknown[] }> = [];

  trace(message: string, ...args: unknown[]): void {
    this.logs.push({ level: 'trace', message, args });
  }

  debug(message: string, ...args: unknown[]): void {
    this.logs.push({ level: 'debug', message, args });
  }

  info(message: string, ...args: unknown[]): void {
    this.logs.push({ level: 'info', message, args });
  }

  warn(message: string, ...args: unknown[]): void {
    this.logs.push({ level: 'warn', message, args });
  }

  error(message: string, ...args: unknown[]): void {
    this.logs.push({ level: 'error', message, args });
  }

  clear(): void {
    this.logs = [];
  }

  getLogsByLevel(level: string): Array<{ message: string; args: unknown[] }> {
    return this.logs
      .filter((log) => log.level === level)
      .map(({ message, args }) => ({ message, args }));
  }
}

/**
 * Mock EngineClient for testing
 */
export class MockEngineClient {
  public requests: Array<{ method: string; args: unknown[] }> = [];

  constructor(public config?: unknown) {}

  // Mock the EngineClient interface without implementing it strictly
  // This allows us to avoid type compatibility issues with private properties
  setAuthorization = jest.fn((authorization: unknown) => {
    this.requests.push({ method: 'setAuthorization', args: [authorization] });
  });

  changeLocale = jest.fn((locale: string) => {
    this.requests.push({ method: 'changeLocale', args: [locale] });
  });

  get = jest.fn((options: unknown) => {
    this.requests.push({ method: 'get', args: [options] });
    return Promise.resolve({});
  });

  post = jest.fn((options: unknown) => {
    this.requests.push({ method: 'post', args: [options] });
    return Promise.resolve({});
  });

  put = jest.fn((options: unknown) => {
    this.requests.push({ method: 'put', args: [options] });
    return Promise.resolve({});
  });

  patch = jest.fn((options: unknown) => {
    this.requests.push({ method: 'patch', args: [options] });
    return Promise.resolve({});
  });

  delete = jest.fn((options: unknown) => {
    this.requests.push({ method: 'delete', args: [options] });
    return Promise.resolve({});
  });

  request = jest.fn((config: unknown) => {
    this.requests.push({ method: 'request', args: [config] });
    return Promise.resolve({ data: {}, status: 200, statusText: 'OK', headers: {}, config: {} });
  });

  clear(): void {
    this.requests = [];
    jest.clearAllMocks();
  }
}

/**
 * Create a mock API class instance
 */
export function createMockApi<T>(methods: (keyof T)[]): jest.Mocked<T> {
  const mockApi = {} as jest.Mocked<T>;

  methods.forEach((method) => {
    mockApi[method] = jest.fn().mockResolvedValue({}) as Mocked<T>[keyof T];
  });

  return mockApi;
}
