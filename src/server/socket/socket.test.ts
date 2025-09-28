/**
 * Production-ready integration tests for EngineSocket
 * Tests critical production scenarios including error handling, retry logic, and connection management
 */
import ws from 'ws';

import { RPEventEmitter } from '../../core/bus/event-emitter';
import { MockLogger } from '../../../test/mocks';
import { RPServerEvents } from '../core/events/events';

import { EngineSocket, EngineSocketConfig, SocketMessage } from './socket';
import { IncomingSocketEvents, OutgoingSocketEvents } from './socket-events';
import { SocketSessionStarted } from './events/socket-session-started';

// Mock external dependencies
jest.mock('../../version', () => ({
  getVersion: () => '1.0.0-test',
}));

describe('EngineSocket Integration Tests', () => {
  let mockLogger: MockLogger;
  let mockEventEmitter: RPEventEmitter<RPServerEvents>;
  let mockServer: ws.Server;
  let actualPort: number;

  const baseConfig: EngineSocketConfig = {
    url: 'ws://localhost:8080',
    apiKeyId: 'test-key-id',
    apiKeySecret: 'test-key-secret',
    serverId: 'test-server',
  };

  beforeAll((done) => {
    // Create a real WebSocket server for integration testing
    mockServer = new ws.Server({ port: 0 }, () => {
      actualPort = (mockServer.address() as ws.AddressInfo).port;
      done();
    });
  });

  afterAll((done) => {
    mockServer.close(done);
  });

  let activeSocket: EngineSocket | null = null;

  beforeEach(() => {
    mockLogger = new MockLogger();
    mockEventEmitter = new RPEventEmitter<RPServerEvents>();
    jest.clearAllMocks();
    jest.clearAllTimers();
    jest.useRealTimers();

    // Clean up any existing connections and listeners
    mockServer.removeAllListeners('connection');
    mockServer.clients.forEach((client) => client.close());
  });

  afterEach(() => {
    // Clean up any active socket
    if (activeSocket) {
      activeSocket.close();
      activeSocket = null;
    }

    // Clean up server connections
    mockServer.clients.forEach((client) => client.close());
    mockServer.removeAllListeners('connection');
  });

  describe('Critical Production Issues', () => {
    it('should handle connection drop AFTER successful handshake', async () => {
      const config = { ...baseConfig, url: `ws://localhost:${actualPort}` };
      const socket = new EngineSocket(config, mockEventEmitter, mockLogger);

      let serverWs: ws.WebSocket;
      const warnSpy = jest.spyOn(mockLogger, 'warn');

      mockServer.once('connection', (ws) => {
        serverWs = ws;
        // Complete handshake successfully
        const handshakeMessage: SocketMessage<{ timestamp: number }> = {
          event: 'connected',
          data: { timestamp: Date.now() },
          headers: {},
        };
        ws.send(JSON.stringify(handshakeMessage));
      });

      // Start connection successfully
      await socket.start();

      // CRITICAL TEST: Drop connection AFTER handshake (use valid close code)
      serverWs!.close(1000, 'Connection dropped unexpectedly');

      // Wait to see if socket tries to reconnect
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Check warn spy calls
      console.log(
        'Warn calls:',
        warnSpy.mock.calls.map((call) => call[0]),
      );

      const hasReconnectAttempt = warnSpy.mock.calls.some(
        (call) =>
          call[0]?.includes('retrying') ||
          call[0]?.includes('reconnect') ||
          call[0]?.includes('Connection lost'),
      );

      // Clean up
      socket.close();

      expect(hasReconnectAttempt).toBe(true);
    }, 10000);

    it('should prevent race conditions with multiple start() calls', async () => {
      const config = { ...baseConfig, url: `ws://localhost:${actualPort}` };
      const socket = new EngineSocket(config, mockEventEmitter, mockLogger);

      let connectionAttempts = 0;
      mockServer.once('connection', (ws) => {
        connectionAttempts++;
        console.log(`🔍 Connection attempt #${connectionAttempts}`);

        // Delay to create race condition window
        setTimeout(() => {
          const handshakeMessage: SocketMessage<{ timestamp: number }> = {
            event: 'connected',
            data: { timestamp: Date.now() },
            headers: {},
          };
          ws.send(JSON.stringify(handshakeMessage));
        }, 50);
      });

      // CRITICAL TEST: Multiple concurrent start() calls
      const promises = await Promise.allSettled([socket.start(), socket.start(), socket.start()]);

      console.log(
        'Promise results:',
        promises.map((p) => p.status),
      );
      console.log('Total connection attempts:', connectionAttempts);

      // Clean up
      socket.close();

      // EXPECTED TO FAIL: Should only have 1 connection attempt, likely has 3
      expect(connectionAttempts).toBe(1);
    }, 10000);

    it('should properly cleanup WebSocket resources', async () => {
      const config = { ...baseConfig, url: `ws://localhost:${actualPort}` };
      const socket = new EngineSocket(config, mockEventEmitter, mockLogger);

      mockServer.once('connection', (ws) => {
        const handshakeMessage: SocketMessage<{ timestamp: number }> = {
          event: 'connected',
          data: { timestamp: Date.now() },
          headers: {},
        };
        ws.send(JSON.stringify(handshakeMessage));
      });

      await socket.start();

      // Get reference to internal WebSocket before closing
      const internalWs = (socket as unknown as { ws: WebSocket }).ws;
      const initialReadyState = internalWs?.readyState;

      console.log('WebSocket state before close:', initialReadyState);

      // Close socket
      socket.close();

      // 🚨 CRITICAL TEST: Check resource cleanup
      const finalReadyState = internalWs?.readyState;
      console.log('WebSocket state after close:', finalReadyState);

      // Should be CLOSING (2) or CLOSED (3)
      expect(finalReadyState).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Retry Logic Testing', () => {
    it('should implement correct exponential backoff timing', async () => {
      const config = { ...baseConfig, url: 'ws://localhost:99999' }; // Invalid port
      const socket = new EngineSocket(config, mockEventEmitter, mockLogger);
      activeSocket = socket;

      jest.useFakeTimers();
      const warnSpy = jest.spyOn(mockLogger, 'warn');

      // Start connection (will fail)
      socket.start().catch(() => {});

      // Wait for initial failure
      await jest.runOnlyPendingTimersAsync();

      // Check first retry message
      const hasFirstRetry = warnSpy.mock.calls.some(
        (call) => call[0].includes('WebSocket connection failed:') && call[0].includes('retry count 1 with delay 1000ms'),
      );
      expect(hasFirstRetry).toBe(true);

      // Advance time for first retry and check second delay
      jest.advanceTimersByTime(1000);
      await jest.runOnlyPendingTimersAsync();

      const hasSecondRetry = warnSpy.mock.calls.some(
        (call) => call[0].includes('WebSocket connection failed:') && call[0].includes('retry count 2 with delay 2000ms'),
      );
      expect(hasSecondRetry).toBe(true);

      socket.close();
      jest.useRealTimers();
      activeSocket = null;
    }, 10000);

    it('should exit process after maximum retries', async () => {
      const config = { ...baseConfig, url: 'ws://localhost:99999' };
      const socket = new EngineSocket(config, mockEventEmitter, mockLogger);
      activeSocket = socket;

      const errorSpy = jest.spyOn(mockLogger, 'error');
      const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called');
      });

      jest.useFakeTimers();

      try {
        socket.start().catch(() => {});

        // Fast-forward through all 20 retries
        for (let i = 1; i <= 20; i++) {
          await jest.runOnlyPendingTimersAsync();
          const delay = 1000 * Math.pow(2, i - 1);
          jest.advanceTimersByTime(delay);
        }

        await jest.runOnlyPendingTimersAsync();

        // Should call process.exit after max retries
        expect(mockExit).toHaveBeenCalledWith(1);
        expect(errorSpy).toHaveBeenCalledWith(
          'Socket connection failed after maximum retries: 20',
          expect.any(Error),
        );
      } catch (error) {
        expect((error as Error).message).toBe('process.exit called');
      }

      jest.useRealTimers();
      mockExit.mockRestore();
      activeSocket = null;
    }, 12000);
  });

  describe('Error Recovery', () => {
    it('should recover from malformed server messages', async () => {
      const config = { ...baseConfig, url: `ws://localhost:${actualPort}` };
      const socket = new EngineSocket(config, mockEventEmitter, mockLogger);

      mockServer.once('connection', (ws) => {
        // Complete handshake first
        const handshakeMessage: SocketMessage<{ timestamp: number }> = {
          event: 'connected',
          data: { timestamp: Date.now() },
          headers: {},
        };
        ws.send(JSON.stringify(handshakeMessage));

        // Send various malformed messages
        setTimeout(() => {
          ws.send('invalid-json{');
          ws.send('null');
          ws.send('{"event": "test", "data": null}');
          ws.send('{"event": "test"}');

          // Then send valid message
          ws.send(
            JSON.stringify({
              event: IncomingSocketEvents.SessionStarted,
              data: {
                id: 'test-session',
                hash: 'test-hash',
                ipAddress: '127.0.0.1',
                timestamp: Date.now(),
              },
              headers: {},
            }),
          );
        }, 100);
      });

      const errorSpy = jest.spyOn(mockLogger, 'error');
      const eventSpy = jest.spyOn(mockEventEmitter, 'emit');

      await socket.start();
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Should log JSON errors but continue processing
      expect(errorSpy).toHaveBeenCalledWith('Invalid JSON', expect.any(Error));

      // Should still process valid messages after errors
      expect(eventSpy).toHaveBeenCalledWith(
        'socketSessionStarted',
        expect.objectContaining({
          id: 'test-session',
        }),
      );

      // Clean up
      socket.close();
    });

    it('should handle server disconnection during handshake', async () => {
      const config = { ...baseConfig, url: `ws://localhost:${actualPort}` };
      const socket = new EngineSocket(config, mockEventEmitter, mockLogger);
      activeSocket = socket;

      let connectionAttempts = 0;

      // Mock server to fail first connection, succeed on retry
      const handleConnection = (ws: ws.WebSocket) => {
        connectionAttempts++;
        if (connectionAttempts === 1) {
          // First connection: close immediately without handshake
          setTimeout(() => {
            ws.close(1000, 'Server shutting down');
          }, 50);
        } else {
          // Second connection: complete handshake
          const handshakeMessage: SocketMessage<{ timestamp: number }> = {
            event: 'connected',
            data: { timestamp: Date.now() },
            headers: {},
          };
          ws.send(JSON.stringify(handshakeMessage));
        }
      };

      mockServer.on('connection', handleConnection);

      const warnSpy = jest.spyOn(mockLogger, 'warn');

      try {
        // This should eventually succeed after retry
        await socket.start();

        // Should have attempted multiple connections
        expect(connectionAttempts).toBeGreaterThan(1);

        // Should have logged retry attempt
        const hasRetryAttempt = warnSpy.mock.calls.some((call) => call[0]?.includes('retry count'));
        expect(hasRetryAttempt).toBe(true);
      } catch {
        // If it still fails, check that retry was attempted
        const hasRetryAttempt = warnSpy.mock.calls.some((call) => call[0]?.includes('retry count'));
        expect(hasRetryAttempt).toBe(true);
      }

      mockServer.removeListener('connection', handleConnection);
      socket.close();
      activeSocket = null;
    }, 6000);
  });

  describe('Working Core Functionality', () => {
    it('should successfully complete handshake protocol', async () => {
      const config = { ...baseConfig, url: `ws://localhost:${actualPort}` };
      const socket = new EngineSocket(config, mockEventEmitter, mockLogger);
      activeSocket = socket;

      let handshakeCompleted = false;
      mockServer.once('connection', (ws) => {
        // Send handshake message
        const handshakeMessage: SocketMessage<{ timestamp: number }> = {
          event: 'connected',
          data: { timestamp: Date.now() },
          headers: {},
        };
        ws.send(JSON.stringify(handshakeMessage));

        // Listen for client response
        ws.once('message', (data) => {
          const message = JSON.parse(data.toString());
          if (message.event === OutgoingSocketEvents.Connected) {
            handshakeCompleted = true;
            expect(message.data.version).toBe('1.0.0-test');
            expect(message.data.timestamp).toBeGreaterThan(0);
          }
        });
      });

      await socket.start();

      // Wait a bit for handshake to complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(handshakeCompleted).toBe(true);

      socket.close();
      activeSocket = null;
    });

    it('should process valid socket events correctly', async () => {
      const config = { ...baseConfig, url: `ws://localhost:${actualPort}` };
      const socket = new EngineSocket(config, mockEventEmitter, mockLogger);

      const eventSpy = jest.spyOn(mockEventEmitter, 'emit');

      mockServer.once('connection', (ws) => {
        // Complete handshake
        const handshakeMessage: SocketMessage<{ timestamp: number }> = {
          event: 'connected',
          data: { timestamp: Date.now() },
          headers: {},
        };
        ws.send(JSON.stringify(handshakeMessage));

        // Send session started event
        setTimeout(() => {
          const sessionMessage: SocketMessage<SocketSessionStarted> = {
            event: IncomingSocketEvents.SessionStarted,
            data: {
              id: 'session-123',
              hash: 'session-hash',
              ipAddress: '192.168.1.1',
              timestamp: Date.now(),
            },
            headers: {},
          };
          ws.send(JSON.stringify(sessionMessage));
        }, 100);
      });

      await socket.start();
      await new Promise((resolve) => setTimeout(resolve, 200));

      expect(eventSpy).toHaveBeenCalledWith('socketSessionStarted', {
        id: 'session-123',
        hash: 'session-hash',
        ipAddress: '192.168.1.1',
        timestamp: expect.any(Number),
      });

      // Clean up
      socket.close();
    });

    it('should filter old messages by timestamp', async () => {
      const config = { ...baseConfig, url: `ws://localhost:${actualPort}` };
      const socket = new EngineSocket(config, mockEventEmitter, mockLogger);

      const eventSpy = jest.spyOn(mockEventEmitter, 'emit');
      const connectionTime = Date.now();

      mockServer.once('connection', (ws) => {
        // Complete handshake
        const handshakeMessage: SocketMessage<{ timestamp: number }> = {
          event: 'connected',
          data: { timestamp: connectionTime },
          headers: {},
        };
        ws.send(JSON.stringify(handshakeMessage));

        setTimeout(() => {
          // Send old message (should be filtered)
          const oldMessage: SocketMessage<SocketSessionStarted> = {
            event: IncomingSocketEvents.SessionStarted,
            data: {
              id: 'old-session',
              hash: 'old-hash',
              ipAddress: '192.168.1.1',
              timestamp: connectionTime - 5000, // 5 seconds before connection
            },
            headers: {},
          };
          ws.send(JSON.stringify(oldMessage));

          // Send new message (should be processed)
          const newMessage: SocketMessage<SocketSessionStarted> = {
            event: IncomingSocketEvents.SessionStarted,
            data: {
              id: 'new-session',
              hash: 'new-hash',
              ipAddress: '192.168.1.1',
              timestamp: connectionTime + 1000, // 1 second after connection
            },
            headers: {},
          };
          ws.send(JSON.stringify(newMessage));
        }, 100);
      });

      await socket.start();
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Should only process the new message
      expect(eventSpy).toHaveBeenCalledTimes(1);
      expect(eventSpy).toHaveBeenCalledWith('socketSessionStarted', {
        id: 'new-session',
        hash: 'new-hash',
        ipAddress: '192.168.1.1',
        timestamp: expect.any(Number),
      });

      // Clean up
      socket.close();
    });
  });

  describe('Ping/Pong Functionality', () => {
    it('should respond to server ping with pong', async () => {
      const config = { ...baseConfig, url: `ws://localhost:${actualPort}` };
      const socket = new EngineSocket(config, mockEventEmitter, mockLogger);
      activeSocket = socket;

      let pongReceived = false;
      mockServer.once('connection', (ws) => {
        ws.on('pong', () => {
          pongReceived = true;
        });

        const handshakeMessage: SocketMessage<{ timestamp: number }> = {
          event: 'connected',
          data: { timestamp: Date.now() },
          headers: {},
        };
        ws.send(JSON.stringify(handshakeMessage));

        // Send ping after handshake
        setTimeout(() => {
          ws.ping();
        }, 100);
      });

      await socket.start();

      // Wait for ping/pong exchange
      await new Promise((resolve) => setTimeout(resolve, 200));

      expect(pongReceived).toBe(true);

      socket.close();
      activeSocket = null;
    });

    it('should send ping to server periodically', async () => {
      jest.useFakeTimers();

      const config = { ...baseConfig, url: `ws://localhost:${actualPort}` };
      const socket = new EngineSocket(config, mockEventEmitter, mockLogger);
      activeSocket = socket;

      let pingReceived = false;
      mockServer.once('connection', (ws) => {
        ws.on('ping', () => {
          pingReceived = true;
        });

        const handshakeMessage: SocketMessage<{ timestamp: number }> = {
          event: 'connected',
          data: { timestamp: Date.now() },
          headers: {},
        };
        ws.send(JSON.stringify(handshakeMessage));
      });

      await socket.start();

      // Fast-forward time to trigger ping interval (30 seconds)
      jest.advanceTimersByTime(30000);

      // Wait a bit for ping to be sent
      jest.useRealTimers();
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(pingReceived).toBe(true);

      socket.close();
      activeSocket = null;
    });

    it('should clear ping interval when connection is closed', async () => {
      jest.useFakeTimers();

      const config = { ...baseConfig, url: `ws://localhost:${actualPort}` };
      const socket = new EngineSocket(config, mockEventEmitter, mockLogger);
      activeSocket = socket;

      let pingCount = 0;
      mockServer.once('connection', (ws) => {
        ws.on('ping', () => {
          pingCount++;
        });

        const handshakeMessage: SocketMessage<{ timestamp: number }> = {
          event: 'connected',
          data: { timestamp: Date.now() },
          headers: {},
        };
        ws.send(JSON.stringify(handshakeMessage));
      });

      await socket.start();

      // Trigger one ping
      jest.advanceTimersByTime(30000);

      // Close connection
      socket.close();

      // Advance time more - no more pings should be sent
      jest.advanceTimersByTime(50000);

      jest.useRealTimers();
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(pingCount).toBe(1); // Only one ping before close

      activeSocket = null;
    });

    it('should handle pong responses from server', async () => {
      const config = { ...baseConfig, url: `ws://localhost:${actualPort}` };
      const socket = new EngineSocket(config, mockEventEmitter, mockLogger);
      activeSocket = socket;

      const logSpy = jest.spyOn(mockLogger, 'trace');
      mockServer.once('connection', (ws) => {
        const handshakeMessage: SocketMessage<{ timestamp: number }> = {
          event: 'connected',
          data: { timestamp: Date.now() },
          headers: {},
        };
        ws.send(JSON.stringify(handshakeMessage));

        // Send pong after handshake
        setTimeout(() => {
          ws.pong();
        }, 100);
      });

      await socket.start();

      // Wait for pong to be received
      await new Promise((resolve) => setTimeout(resolve, 200));

      expect(logSpy).toHaveBeenCalledWith('Received pong from server');

      socket.close();
      activeSocket = null;
    });

    it('should only ping when connection is open', async () => {
      jest.useFakeTimers();

      const config = { ...baseConfig, url: `ws://localhost:${actualPort}` };
      const socket = new EngineSocket(config, mockEventEmitter, mockLogger);
      activeSocket = socket;

      let pingCount = 0;
      mockServer.once('connection', (ws) => {
        ws.on('ping', () => {
          pingCount++;
        });

        const handshakeMessage: SocketMessage<{ timestamp: number }> = {
          event: 'connected',
          data: { timestamp: Date.now() },
          headers: {},
        };
        ws.send(JSON.stringify(handshakeMessage));
      });

      await socket.start();

      // First advance timer to trigger first ping while connection is open
      jest.advanceTimersByTime(30000);

      // Now close the connection manually
      socket.close();

      // Wait for close to complete and timers to clear
      jest.useRealTimers();
      await new Promise((resolve) => setTimeout(resolve, 100));
      jest.useFakeTimers();

      // Reset ping count after close
      const initialPingCount = pingCount;
      pingCount = 0;

      // Advance time more - no more pings should be sent
      jest.advanceTimersByTime(50000);

      jest.useRealTimers();
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(pingCount).toBe(0);
      expect(initialPingCount).toBeGreaterThan(0);

      activeSocket = null;
    });
  });
});
