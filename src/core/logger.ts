export enum LogLevel {
  TRACE = 0,
  DEBUG = 1,
  INFO = 2,
  WARN = 3,
  ERROR = 4,
}

/**
 * Universal logger interface compatible with popular logging libraries.
 *
 * Supports flexible method signatures to work with different logging patterns:
 * - logger.info('message')
 * - logger.info('message', { context })
 * - logger.error('message', error)
 * - logger.error('message', error, { context })
 */
export interface RPLogger {
  trace(message: string, ...args: unknown[]): void;

  debug(message: string, ...args: unknown[]): void;

  info(message: string, ...args: unknown[]): void;

  warn(message: string, ...args: unknown[]): void;

  error(message: string, ...args: unknown[]): void;
}

export class DefaultRPLogger implements RPLogger {
  public minLevel: LogLevel;

  constructor(minLevel: LogLevel = LogLevel.INFO) {
    this.minLevel = minLevel;
  }

  trace(message: string, ...args: unknown[]): void {
    if (this.minLevel <= LogLevel.TRACE) {
      console.trace(message, ...args);
    }
  }

  debug(message: string, ...args: unknown[]): void {
    if (this.minLevel <= LogLevel.DEBUG) {
      console.debug(message, ...args);
    }
  }

  info(message: string, ...args: unknown[]): void {
    if (this.minLevel <= LogLevel.INFO) {
      console.info(message, ...args);
    }
  }

  warn(message: string, ...args: unknown[]): void {
    if (this.minLevel <= LogLevel.WARN) {
      console.warn(message, ...args);
    }
  }

  error(message: string, ...args: unknown[]): void {
    if (this.minLevel <= LogLevel.ERROR) {
      console.error(message, ...args);
    }
  }
}

export const defaultLogger = new DefaultRPLogger();
