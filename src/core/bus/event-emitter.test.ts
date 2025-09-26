/**
 * Tests for RPEventEmitter
 */
import { RPEventEmitter } from './event-emitter';

interface TestEvents {
  testEvent: { data: string };
  numberEvent: { value: number };
  errorEvent: { error: Error };
}

describe('RPEventEmitter', () => {
  let emitter: RPEventEmitter<TestEvents>;

  beforeEach(() => {
    emitter = new RPEventEmitter<TestEvents>();
  });

  describe('on/emit', () => {
    it('should register and call event listeners', () => {
      const listener = jest.fn();
      emitter.on('testEvent', listener);

      const payload = { data: 'test' };
      emitter.emit('testEvent', payload);

      expect(listener).toHaveBeenCalledWith(payload);
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('should call multiple listeners for the same event', () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();

      emitter.on('testEvent', listener1);
      emitter.on('testEvent', listener2);

      const payload = { data: 'test' };
      emitter.emit('testEvent', payload);

      expect(listener1).toHaveBeenCalledWith(payload);
      expect(listener2).toHaveBeenCalledWith(payload);
    });

    it('should support different event types', () => {
      const testListener = jest.fn();
      const numberListener = jest.fn();

      emitter.on('testEvent', testListener);
      emitter.on('numberEvent', numberListener);

      emitter.emit('testEvent', { data: 'test' });
      emitter.emit('numberEvent', { value: 42 });

      expect(testListener).toHaveBeenCalledWith({ data: 'test' });
      expect(numberListener).toHaveBeenCalledWith({ value: 42 });
    });
  });

  describe('once', () => {
    it('should call listener only once', () => {
      const listener = jest.fn();
      emitter.once('testEvent', listener);

      emitter.emit('testEvent', { data: 'first' });
      emitter.emit('testEvent', { data: 'second' });

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith({ data: 'first' });
    });

    it('should work alongside regular listeners', () => {
      const onceListener = jest.fn();
      const regularListener = jest.fn();

      emitter.once('testEvent', onceListener);
      emitter.on('testEvent', regularListener);

      emitter.emit('testEvent', { data: 'first' });
      emitter.emit('testEvent', { data: 'second' });

      expect(onceListener).toHaveBeenCalledTimes(1);
      expect(regularListener).toHaveBeenCalledTimes(2);
    });
  });

  describe('off', () => {
    it('should remove specific listener', () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();

      emitter.on('testEvent', listener1);
      emitter.on('testEvent', listener2);
      emitter.off('testEvent', listener1);

      emitter.emit('testEvent', { data: 'test' });

      expect(listener1).not.toHaveBeenCalled();
      expect(listener2).toHaveBeenCalledWith({ data: 'test' });
    });

    it('should handle removing non-existent listener gracefully', () => {
      const listener = jest.fn();

      expect(() => {
        emitter.off('testEvent', listener);
      }).not.toThrow();
    });
  });

  describe('offAll', () => {
    it('should remove all listeners for specific event', () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();
      const otherListener = jest.fn();

      emitter.on('testEvent', listener1);
      emitter.on('testEvent', listener2);
      emitter.on('numberEvent', otherListener);

      emitter.offAll('testEvent');

      emitter.emit('testEvent', { data: 'test' });
      emitter.emit('numberEvent', { value: 42 });

      expect(listener1).not.toHaveBeenCalled();
      expect(listener2).not.toHaveBeenCalled();
      expect(otherListener).toHaveBeenCalledWith({ value: 42 });
    });
  });

  describe('error handling', () => {
    it('should propagate errors from listeners', () => {
      const errorListener = jest.fn(() => {
        throw new Error('Listener error');
      });
      const successListener = jest.fn();

      emitter.on('testEvent', errorListener);
      emitter.on('testEvent', successListener);

      // EventEmitter propagates errors from listeners
      expect(() => {
        emitter.emit('testEvent', { data: 'test' });
      }).toThrow('Listener error');

      expect(errorListener).toHaveBeenCalled();
      // successListener may or may not be called depending on error handling
    });
  });

  describe('async listeners', () => {
    it('should support async listeners', async () => {
      const asyncListener = jest.fn().mockResolvedValue(undefined);

      emitter.on('testEvent', asyncListener);
      emitter.emit('testEvent', { data: 'test' });

      expect(asyncListener).toHaveBeenCalledWith({ data: 'test' });
    });
  });
});
