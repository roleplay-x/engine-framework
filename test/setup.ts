/**
 * Global test setup and utilities
 */

// Mock timers for tests that use setTimeout/setInterval
export const setupMockTimers = () => {
  jest.useFakeTimers();
};

export const teardownMockTimers = () => {
  jest.useRealTimers();
};

// Common test timeout
export const TEST_TIMEOUT = 10000;

// Mock process exit to prevent tests from actually exiting
const originalExit = process.exit;
export const mockProcessExit = () => {
  process.exit = jest.fn() as never;
};

export const restoreProcessExit = () => {
  process.exit = originalExit;
};