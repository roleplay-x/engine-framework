/**
 * Tests for EventService hook system
 */
import { MockLogger } from '../../../../test/mocks';

import { EventService } from './service';
import { ClientPlatformAdapter } from '../../natives/adapters/platform.adapter';
import { RPHookBus } from '../../../core/bus/hook-bus';
import { RPClientHooks } from '../../core/hooks/hooks';

describe('EventService Hooks', () => {
  let mockLogger: MockLogger;
  let mockPlatformAdapter: jest.Mocked<ClientPlatformAdapter>;
  let mockHookBus: jest.Mocked<RPHookBus<RPClientHooks>>;
  let eventService: EventService;

  beforeEach(async () => {
    mockLogger = new MockLogger();
    mockHookBus = {
      run: jest.fn().mockResolvedValue(undefined),
      on: jest.fn(),
      off: jest.fn(),
    } as unknown as jest.Mocked<RPHookBus<RPClientHooks>>;

    mockPlatformAdapter = {
      network: {
        onServerEvent: jest.fn(),
        offServerEvent: jest.fn(),
        emitToServer: jest.fn(),
        on: jest.fn(),
        off: jest.fn(),
        once: jest.fn(),
        emit: jest.fn(),
        removeAllListeners: jest.fn(),
        listenerCount: jest.fn().mockReturnValue(0),
        onGameEvent: jest.fn(),
        offGameEvent: jest.fn(),
        mapPlatformEvent: jest.fn(),
        unmapPlatformEvent: jest.fn(),
        getMappedGameEvent: jest.fn().mockReturnValue(null),
      },
    } as unknown as jest.Mocked<ClientPlatformAdapter>;

    const mockContext = {
      logger: mockLogger,
      platformAdapter: mockPlatformAdapter,
      hookBus: mockHookBus,
    } as any;
    
    eventService = new EventService(mockContext);
    
    await eventService.init();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Hook Integration', () => {
    it('should call hookBus.trigger for client events', () => {
      const eventHandler = jest.fn();
      
      eventService.on('testEvent', eventHandler);

      expect(mockPlatformAdapter.network.on).toHaveBeenCalledWith('testEvent', expect.any(Function));
    });

    it('should call hookBus.trigger for server events', () => {
      const eventHandler = jest.fn();
      
      eventService.onServerEvent('testServerEvent', eventHandler);

      expect(mockPlatformAdapter.network.onServerEvent).toHaveBeenCalledWith('testServerEvent', expect.any(Function));
    });

    it('should call hookBus.trigger for game events', () => {
      const eventHandler = jest.fn();
      
      eventService.onGameEvent('entityDamage', eventHandler);

      expect(mockPlatformAdapter.network.onGameEvent).toHaveBeenCalledWith('entityDamage', expect.any(Function));
    });
  });

  describe('Hook Execution', () => {
    it('should execute beforeClientEvent hook', async () => {
      const beforeHook = jest.fn();
      const eventHandler = jest.fn();
      
      mockHookBus.run.mockImplementation(async (hookName: string, data: any) => {
        if (hookName === 'beforeClientEvent') {
          beforeHook(data);
        }
        return data;
      });

      eventService.on('testEvent', eventHandler);

      const wrappedHandler = (mockPlatformAdapter.network.on as jest.Mock).mock.calls[0][1];
      await wrappedHandler('testData');

      expect(beforeHook).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'testEvent',
          data: ['testData'],
          preventDefault: expect.any(Function),
          stopPropagation: expect.any(Function),
        })
      );
      expect(eventHandler).toHaveBeenCalledWith('testData');
    });

    it('should execute afterClientEvent hook', async () => {
      const afterHook = jest.fn();
      const eventHandler = jest.fn();
      
      mockHookBus.run.mockImplementation(async (hookName: string, data: any) => {
        if (hookName === 'afterClientEvent') {
          afterHook(data);
        }
        return data;
      });

      eventService.on('testEvent', eventHandler);

      const wrappedHandler = (mockPlatformAdapter.network.on as jest.Mock).mock.calls[0][1];
      await wrappedHandler('testData');

      expect(afterHook).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'testEvent',
          data: ['testData'],
          preventDefault: expect.any(Function),
          stopPropagation: expect.any(Function),
        })
      );
      expect(eventHandler).toHaveBeenCalledWith('testData');
    });

    it('should prevent event execution when preventDefault is called', async () => {
      const eventHandler = jest.fn();
      
      mockHookBus.run.mockImplementation(async (hookName: string, data: any) => {
        if (hookName === 'beforeClientEvent') {
          data.preventDefault();
        }
        return data;
      });

      eventService.on('testEvent', eventHandler);

      const wrappedHandler = (mockPlatformAdapter.network.on as jest.Mock).mock.calls[0][1];
      await wrappedHandler('testData');

      expect(eventHandler).not.toHaveBeenCalled();
    });

    it('should stop propagation when stopPropagation is called', async () => {
      const eventHandler = jest.fn();
      
      mockHookBus.run.mockImplementation(async (hookName: string, data: any) => {
        if (hookName === 'beforeClientEvent') {
          data.stopPropagation();
        }
        return data;
      });

      eventService.on('testEvent', eventHandler);

      const wrappedHandler = (mockPlatformAdapter.network.on as jest.Mock).mock.calls[0][1];
      await wrappedHandler('testData');

      expect(eventHandler).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle hook errors gracefully', async () => {
      const eventHandler = jest.fn();
      const errorSpy = jest.spyOn(mockLogger, 'error');
      
      mockHookBus.run.mockRejectedValue(new Error('Hook error'));

      eventService.on('testEvent', eventHandler);

      const wrappedHandler = (mockPlatformAdapter.network.on as jest.Mock).mock.calls[0][1];
      await wrappedHandler('testData');

      expect(eventHandler).toHaveBeenCalledWith('testData');
      expect(errorSpy).toHaveBeenCalledWith('Error executing hook beforeClientEvent:', expect.any(Error));
    });

    it('should handle event handler errors gracefully', async () => {
      const eventHandler = jest.fn().mockImplementation(() => {
        throw new Error('Handler error');
      });
      const errorSpy = jest.spyOn(mockLogger, 'error');
      
      eventService.on('testEvent', eventHandler);

      const wrappedHandler = (mockPlatformAdapter.network.on as jest.Mock).mock.calls[0][1];
      await wrappedHandler('testData');

      expect(errorSpy).toHaveBeenCalledWith("Error in event handler for 'testEvent':", expect.any(Error));
    });
  });
});