import { EventEmitter as NodeEventEmitter } from 'events';

/** Event listener function that can be sync or async */
type EventListener<T> = (payload: T) => void | Promise<void>;
/** Error handler for async event listener errors */
type ErrorHandler = (error: Error, event: string, payload: unknown) => void;

/**
 * Type-safe event emitter wrapper around Node.js EventEmitter
 *
 * Provides automatic async error handling and type-safe event emission
 */
export class RPEventEmitter<Events> {
  private emitter = new NodeEventEmitter();
  private errorHandler?: ErrorHandler;

  /**
   * Create a new event emitter with optional configuration
   * @param options Configuration options for the emitter
   */
  constructor(options?: { maxListeners?: number; errorHandler?: ErrorHandler }) {
    this.emitter.setMaxListeners(options?.maxListeners ?? 100);
    this.errorHandler = options?.errorHandler;

    this.emitter.on('error', (error) => {
      if (this.errorHandler) {
        this.errorHandler(error, 'internal', undefined);
      } else {
        console.error('EventEmitter internal error:', error);
      }
    });
  }

  /**
   * Add an event listener
   * @param event The event name
   * @param listener The listener function
   */
  on<E extends keyof Events>(event: E, listener: EventListener<Events[E]>): this {
    const wrappedListener = this.wrapAsyncListener(event as string, listener);
    this.emitter.on(event as string, wrappedListener);
    return this;
  }

  /**
   * Remove an event listener
   * @param event The event name
   * @param listener The listener to remove (if not provided, removes all)
   */
  off<E extends keyof Events>(event: E, listener?: EventListener<Events[E]>): this {
    if (!listener) {
      this.emitter.removeAllListeners(event as string);
      return this;
    }

    const listeners = this.emitter.listeners(event as string);
    const wrappedListener = listeners.find(
      (l) => (l as { __original?: EventListener<Events[E]> }).__original === listener,
    ) as ((...args: unknown[]) => void) | undefined;

    if (wrappedListener) {
      this.emitter.off(event as string, wrappedListener);
    }

    return this;
  }

  /**
   * Remove all listeners for an event
   * @param event The event name
   */
  offAll<E extends keyof Events>(event: E): this {
    this.emitter.removeAllListeners(event as string);
    return this;
  }

  /**
   * Emit an event with payload
   * @param event The event name
   * @param payload The event payload
   */
  emit<E extends keyof Events>(event: E, payload: Events[E]): boolean {
    return this.emitter.emit(event as string, payload);
  }

  /**
   * Add a one-time event listener
   * @param event The event name
   * @param listener The listener function
   */
  once<E extends keyof Events>(event: E, listener: EventListener<Events[E]>): this {
    const wrappedListener = this.wrapAsyncListener(event as string, listener);
    this.emitter.once(event as string, wrappedListener);
    return this;
  }

  /**
   * Get the number of listeners for an event
   * @param event The event name
   */
  listenerCount<E extends keyof Events>(event: E): number {
    return this.emitter.listenerCount(event as string);
  }

  /**
   * Set a global error handler for async event handler errors
   * @param handler The error handler function
   */
  setErrorHandler(handler: ErrorHandler): this {
    this.errorHandler = handler;
    return this;
  }

  /**
   * Remove all listeners and clean up resources
   */
  removeAllListeners(): this {
    this.emitter.removeAllListeners();
    return this;
  }

  /**
   * Wrap async listeners to handle promise rejections properly
   * @param event The event name
   * @param listener The original listener function
   */
  private wrapAsyncListener<E extends keyof Events>(
    event: string,
    listener: EventListener<Events[E]>,
  ): (payload: Events[E]) => void {
    const wrappedListener = (payload: Events[E]) => {
      try {
        const result = listener(payload);

        // If the result is a promise, handle rejections
        if (result && typeof result.then === 'function') {
          (result as Promise<void>).catch((error: Error) => {
            if (this.errorHandler) {
              this.errorHandler(error, event, payload);
            } else {
              // Default: log to console to prevent unhandled rejections
              console.error(`Async event handler error in '${event}':`, error);
            }
          });
        }
      } catch (error) {
        // Handle synchronous errors
        if (this.errorHandler) {
          this.errorHandler(error as Error, event, payload);
        } else {
          // Re-throw sync errors for immediate handling
          throw error;
        }
      }
    };

    // Store reference to original listener for proper removal
    (
      wrappedListener as ((...args: unknown[]) => void) & { __original?: EventListener<Events[E]> }
    ).__original = listener;

    return wrappedListener;
  }
}
