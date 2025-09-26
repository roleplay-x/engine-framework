/**
 * Tests for RPHookBus
 */
import { RPHookBus } from './hook-bus';

interface TestHooks {
  beforeTest: (context: { data: string }) => void | Promise<void>;
  afterTest: (context: { result: number }) => void | Promise<void>;
  processData: (context: {
    input: string;
    output?: string;
  }) => { input: string; output?: string } | Promise<{ input: string; output?: string }>;
}

describe('RPHookBus', () => {
  let hookBus: RPHookBus<TestHooks>;

  beforeEach(() => {
    hookBus = new RPHookBus<TestHooks>();
  });

  describe('on/run', () => {
    it('should register and run hooks', async () => {
      const hook = jest.fn().mockResolvedValue(undefined);
      hookBus.on('beforeTest', hook);

      const context = { data: 'test' };
      await hookBus.run('beforeTest', context);

      expect(hook).toHaveBeenCalledWith(context);
      expect(hook).toHaveBeenCalledTimes(1);
    });

    it('should run multiple hooks in registration order', async () => {
      const hook1 = jest.fn().mockResolvedValue(undefined);
      const hook2 = jest.fn().mockResolvedValue(undefined);
      const hook3 = jest.fn().mockResolvedValue(undefined);

      hookBus.on('beforeTest', hook1);
      hookBus.on('beforeTest', hook2);
      hookBus.on('beforeTest', hook3);

      const context = { data: 'test' };
      await hookBus.run('beforeTest', context);

      expect(hook1).toHaveBeenCalledWith(context);
      expect(hook2).toHaveBeenCalledWith(context);
      expect(hook3).toHaveBeenCalledWith(context);
    });

    it('should support different hook types', async () => {
      const beforeHook = jest.fn().mockResolvedValue(undefined);
      const afterHook = jest.fn().mockResolvedValue(undefined);

      hookBus.on('beforeTest', beforeHook);
      hookBus.on('afterTest', afterHook);

      await hookBus.run('beforeTest', { data: 'test' });
      await hookBus.run('afterTest', { result: 42 });

      expect(beforeHook).toHaveBeenCalledWith({ data: 'test' });
      expect(afterHook).toHaveBeenCalledWith({ result: 42 });
    });
  });

  describe('off', () => {
    it('should remove specific hook', async () => {
      const hook1 = jest.fn().mockResolvedValue(undefined);
      const hook2 = jest.fn().mockResolvedValue(undefined);

      hookBus.on('beforeTest', hook1);
      hookBus.on('beforeTest', hook2);
      hookBus.off('beforeTest', hook1);

      const context = { data: 'test' };
      await hookBus.run('beforeTest', context);

      expect(hook1).not.toHaveBeenCalled();
      expect(hook2).toHaveBeenCalledWith(context);
    });

    it('should handle removing non-existent hook gracefully', () => {
      const hook = jest.fn();

      expect(() => {
        hookBus.off('beforeTest', hook);
      }).not.toThrow();
    });

    it('should remove all hooks for specific event when no function provided', async () => {
      const hook1 = jest.fn().mockResolvedValue(undefined);
      const hook2 = jest.fn().mockResolvedValue(undefined);
      const otherHook = jest.fn().mockResolvedValue(undefined);

      hookBus.on('beforeTest', hook1);
      hookBus.on('beforeTest', hook2);
      hookBus.on('afterTest', otherHook);

      hookBus.off('beforeTest');

      await hookBus.run('beforeTest', { data: 'test' });
      await hookBus.run('afterTest', { result: 42 });

      expect(hook1).not.toHaveBeenCalled();
      expect(hook2).not.toHaveBeenCalled();
      expect(otherHook).toHaveBeenCalledWith({ result: 42 });
    });
  });

  describe('context modification', () => {
    it('should allow hooks to modify and return context', async () => {
      const modifierHook = jest
        .fn()
        .mockImplementation((context: { input: string; output?: string }) => {
          return { ...context, output: `processed: ${context.input}` };
        });

      hookBus.on('processData', modifierHook);

      const context = { input: 'test data' };
      const result = await hookBus.run('processData', context);

      expect(result).toEqual({ input: 'test data', output: 'processed: test data' });
      expect(modifierHook).toHaveBeenCalledWith(context);
    });

    it('should chain context modifications across multiple hooks', async () => {
      const hook1 = jest.fn().mockImplementation((context: { input: string; output?: string }) => {
        return { ...context, output: `step1: ${context.input}` };
      });

      const hook2 = jest.fn().mockImplementation((context: { input: string; output?: string }) => {
        return { ...context, output: `step2: ${context.output}` };
      });

      hookBus.on('processData', hook1);
      hookBus.on('processData', hook2);

      const context = { input: 'test' };
      const result = await hookBus.run('processData', context);

      expect(result).toEqual({ input: 'test', output: 'step2: step1: test' });
    });

    it('should use original context when hook returns undefined', async () => {
      const hook = jest.fn().mockResolvedValue(undefined);
      hookBus.on('beforeTest', hook);

      const context = { data: 'test' };
      const result = await hookBus.run('beforeTest', context);

      expect(result).toBe(context);
      expect(hook).toHaveBeenCalledWith(context);
    });
  });

  describe('filtering', () => {
    it('should support filter functions', async () => {
      const hook = jest.fn().mockResolvedValue(undefined);
      const filter = (payload: { data: string }) => payload.data === 'allowed';

      hookBus.on('beforeTest', hook, filter);

      await hookBus.run('beforeTest', { data: 'allowed' });
      await hookBus.run('beforeTest', { data: 'blocked' });

      expect(hook).toHaveBeenCalledTimes(1);
      expect(hook).toHaveBeenCalledWith({ data: 'allowed' });
    });

    it('should support filter objects', async () => {
      const hook = jest.fn().mockResolvedValue(undefined);
      const filter = { data: 'specific' };

      hookBus.on('beforeTest', hook, filter);

      await hookBus.run('beforeTest', { data: 'specific' });
      await hookBus.run('beforeTest', { data: 'other' });

      expect(hook).toHaveBeenCalledTimes(1);
      expect(hook).toHaveBeenCalledWith({ data: 'specific' });
    });
  });

  describe('no hooks registered', () => {
    it('should handle execution when no hooks are registered', async () => {
      const context = { data: 'test' };
      const result = await hookBus.run('beforeTest', context);

      expect(result).toBe(context);
    });
  });
});
