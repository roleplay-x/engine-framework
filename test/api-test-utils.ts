import { FastifyInstance } from 'fastify';
import { EngineClient } from '@roleplayx/engine-sdk';

import { ApiControllerCtor, ApiServer, ApiServerConfig } from '../src/server/api';
import {
  RPServerContext,
  RPServerContextOptions,
  RPServerEvents,
  RPServerHooks,
  RPServerService,
} from '../src/server';
import { RPEventEmitter } from '../src/core/bus/event-emitter';
import { RPHookBus } from '../src/core/bus/hook-bus';
import { defaultLogger } from '../src/core/logger';
import { PlatformAdapter } from '../src/server/natives/adapters/platform.adapter';

/**
 * Test utilities for API controller testing
 */
export class ApiTestServer {
  private apiServer: ApiServer;
  private context: RPServerContext;
  private serviceMocks = new Map<unknown, unknown>();

  constructor(config: ApiServerConfig) {
    const mockEngineClient = {} as EngineClient;
    const eventEmitter = new RPEventEmitter<RPServerEvents>();
    const hookBus = new RPHookBus<RPServerHooks>();
    const mockPlatformAdapter = {} as PlatformAdapter;

    const contextOptions: RPServerContextOptions = {
      engineClient: mockEngineClient,
      eventEmitter,
      hookBus,
      logger: defaultLogger,
      platformAdapter: mockPlatformAdapter,
    };

    this.context = new RPServerContext(contextOptions);
    this.setupServiceMocking();
    this.apiServer = new ApiServer(this.context, {
      port: 0, // Use random port
      host: '127.0.0.1',
      ...config,
    });
  }

  private setupServiceMocking(): void {
    jest.spyOn(this.context, 'getService').mockImplementation((serviceClass) => {
      if (this.serviceMocks.has(serviceClass)) {
        return this.serviceMocks.get(serviceClass) as RPServerService;
      }

      const mockService = this.createDefaultServiceMock();
      this.serviceMocks.set(serviceClass, mockService);
      return mockService as RPServerService;
    });
  }

  private createDefaultServiceMock(): unknown {
    return {
      init: jest.fn(),
      dispose: jest.fn(),
      translateError: jest.fn((key: string) => key),
    };
  }

  /**
   * Set a custom mock for a service
   */
  mockService(serviceClass: unknown, mock: unknown): this {
    this.serviceMocks.set(serviceClass, mock);
    return this;
  }

  /**
   * Register a controller for testing
   */
  registerController(controller: ApiControllerCtor): this {
    this.apiServer.registerController(controller);
    return this;
  }

  /**
   * Start the test server
   */
  async start(): Promise<void> {
    await this.context.init();
    await this.apiServer.start();
  }

  /**
   * Stop the test server
   */
  async stop(): Promise<void> {
    await this.apiServer.stop();
    await this.context.dispose();
  }

  /**
   * Get the Fastify instance for testing
   */
  getFastify(): FastifyInstance {
    return this.apiServer.getFastify();
  }

  /**
   * Get the server URL
   */
  getUrl(): string {
    const address = this.getFastify().server.address();
    if (typeof address === 'object' && address) {
      return `http://127.0.0.1:${address.port}`;
    }
    return 'http://127.0.0.1:3000';
  }

  /**
   * Get the context for service registration
   */
  getContext(): RPServerContext {
    return this.context;
  }
}
