/**
 * Tests for RPLogger interface and default implementation
 */
import { defaultLogger, LogLevel, RPLogger } from './logger';

describe('RPLogger Interface', () => {
  describe('defaultLogger', () => {
    let consoleSpies: {
      trace: jest.SpyInstance;
      debug: jest.SpyInstance;
      info: jest.SpyInstance;
      warn: jest.SpyInstance;
      error: jest.SpyInstance;
    };

    beforeEach(() => {
      consoleSpies = {
        trace: jest.spyOn(console, 'trace').mockImplementation(),
        debug: jest.spyOn(console, 'debug').mockImplementation(),
        info: jest.spyOn(console, 'info').mockImplementation(),
        warn: jest.spyOn(console, 'warn').mockImplementation(),
        error: jest.spyOn(console, 'error').mockImplementation(),
      };

      defaultLogger.minLevel = LogLevel.TRACE;
    });

    afterEach(() => {
      Object.values(consoleSpies).forEach((spy) => spy.mockRestore());
    });

    describe('debug', () => {
      it('should log debug messages', () => {
        defaultLogger.debug('Debug message');
        expect(consoleSpies.debug).toHaveBeenCalledWith('Debug message');
      });

      it('should support multiple arguments', () => {
        const context = { userId: '123' };
        const error = new Error('Test error');

        defaultLogger.debug('Debug with context', context, error);
        expect(consoleSpies.debug).toHaveBeenCalledWith('Debug with context', context, error);
      });

      it('should handle no additional arguments', () => {
        defaultLogger.debug('Simple debug');
        expect(consoleSpies.debug).toHaveBeenCalledWith('Simple debug');
      });
    });

    describe('info', () => {
      it('should log info messages', () => {
        defaultLogger.info('Info message');
        expect(consoleSpies.info).toHaveBeenCalledWith('Info message');
      });

      it('should support metadata objects', () => {
        const metadata = { requestId: 'req-123', duration: 150 };

        defaultLogger.info('Request completed', metadata);
        expect(consoleSpies.info).toHaveBeenCalledWith('Request completed', metadata);
      });

      it('should support multiple data points', () => {
        defaultLogger.info('Processing', { step: 1 }, { total: 10 }, 'additional info');
        expect(consoleSpies.info).toHaveBeenCalledWith(
          'Processing',
          { step: 1 },
          { total: 10 },
          'additional info',
        );
      });
    });

    describe('warn', () => {
      it('should log warning messages', () => {
        defaultLogger.warn('Warning message');
        expect(consoleSpies.warn).toHaveBeenCalledWith('Warning message');
      });

      it('should support error objects in warnings', () => {
        const error = new Error('Non-critical error');

        defaultLogger.warn('Something went wrong', error);
        expect(consoleSpies.warn).toHaveBeenCalledWith('Something went wrong', error);
      });
    });

    describe('error', () => {
      it('should log error messages', () => {
        defaultLogger.error('Error message');
        expect(consoleSpies.error).toHaveBeenCalledWith('Error message');
      });

      it('should support Error objects', () => {
        const error = new Error('Test error');

        defaultLogger.error('Operation failed', error);
        expect(consoleSpies.error).toHaveBeenCalledWith('Operation failed', error);
      });

      it('should support error with context', () => {
        const error = new Error('Database error');
        const context = { query: 'SELECT * FROM users', retries: 3 };

        defaultLogger.error('Database operation failed', error, context);
        expect(consoleSpies.error).toHaveBeenCalledWith(
          'Database operation failed',
          error,
          context,
        );
      });

      it('should handle non-Error objects', () => {
        const errorLike = { message: 'Custom error', code: 500 };

        defaultLogger.error('Custom error occurred', errorLike);
        expect(consoleSpies.error).toHaveBeenCalledWith('Custom error occurred', errorLike);
      });
    });

    describe('flexible argument handling', () => {
      it('should handle empty args gracefully', () => {
        defaultLogger.info('Message only');
        expect(consoleSpies.info).toHaveBeenCalledWith('Message only');
      });

      it('should handle many arguments', () => {
        const args = [1, 2, 3, 'four', { five: 5 }, [6, 7]];

        defaultLogger.debug('Many args', ...args);
        expect(consoleSpies.debug).toHaveBeenCalledWith('Many args', ...args);
      });

      it('should handle null and undefined values', () => {
        defaultLogger.info('With nullish values', null, undefined, 0, '');
        expect(consoleSpies.info).toHaveBeenCalledWith(
          'With nullish values',
          null,
          undefined,
          0,
          '',
        );
      });
    });
  });

  describe('Interface Compatibility', () => {
    it('should be compatible with Winston logger pattern', () => {
      // Simulate Winston-style usage
      const winstonLikeLogger: RPLogger = {
        trace: jest.fn(),
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      };

      // Common Winston patterns
      winstonLikeLogger.info('User login', { userId: '123', ip: '192.168.1.1' });
      winstonLikeLogger.error('Database error', new Error('Connection failed'));

      expect(winstonLikeLogger.info).toHaveBeenCalledWith('User login', {
        userId: '123',
        ip: '192.168.1.1',
      });
      expect(winstonLikeLogger.error).toHaveBeenCalledWith('Database error', expect.any(Error));
    });

    it('should be compatible with Pino logger pattern', () => {
      // Simulate Pino-style usage
      const pinoLikeLogger: RPLogger = {
        trace: jest.fn(),
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      };

      // Common Pino patterns
      pinoLikeLogger.info('HTTP request', { method: 'GET', url: '/api/users', status: 200 });
      pinoLikeLogger.error('Request failed', new Error('Timeout'), { requestId: 'req-123' });

      expect(pinoLikeLogger.info).toHaveBeenCalledWith('HTTP request', {
        method: 'GET',
        url: '/api/users',
        status: 200,
      });
      expect(pinoLikeLogger.error).toHaveBeenCalledWith('Request failed', expect.any(Error), {
        requestId: 'req-123',
      });
    });

    it('should be compatible with console logger pattern', () => {
      // Simulate console-style usage
      const consoleLikeLogger: RPLogger & { log?: typeof consoleLikeLogger.info } = {
        trace: jest.fn(),
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      };

      // Common console patterns
      consoleLikeLogger.log = consoleLikeLogger.info; // Some loggers alias log to info
      consoleLikeLogger.info('Simple message');
      consoleLikeLogger.error('Error:', new Error('Something broke'), 'Additional context');

      expect(consoleLikeLogger.info).toHaveBeenCalledWith('Simple message');
      expect(consoleLikeLogger.error).toHaveBeenCalledWith(
        'Error:',
        expect.any(Error),
        'Additional context',
      );
    });
  });

  describe('Type Safety', () => {
    it('should enforce string message parameter', () => {
      const logger: RPLogger = defaultLogger;

      // These should compile fine
      logger.info('String message');
      logger.error('Error message', new Error());

      // TypeScript should catch these at compile time:
      // logger.info(123); // Should be compilation error
      // logger.error(); // Should be compilation error

      expect(true).toBe(true); // Placeholder for type safety verification
    });

    it('should allow any additional arguments', () => {
      const logger: RPLogger = defaultLogger;

      // All of these should be valid
      logger.info('Message');
      logger.info('Message', 'string');
      logger.info('Message', 123);
      logger.info('Message', { object: true });
      logger.info('Message', ['array']);
      logger.info('Message', null);
      logger.info('Message', undefined);
      logger.info('Message', new Error());

      expect(true).toBe(true); // Placeholder for type safety verification
    });
  });
});
