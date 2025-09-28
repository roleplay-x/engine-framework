import ws from 'ws';

import { RPEventEmitter } from '../../core/bus/event-emitter';
import { RPServerEvents } from '../core/events/events';
import { RPLogger } from '../../core/logger';
import { getVersion } from '../../version';

import {
  IncomingSocketEvents,
  IncomingSocketEventsMap,
  OutgoingSocketEvents,
} from './socket-events';

export interface SocketMessage<Data = unknown> {
  event: string;
  data: Data & { timestamp?: number };
  headers: Record<string, string>;
}

export interface EngineSocketConfig {
  url: string;
  protocols?: string | string[];
  apiKeyId: string;
  apiKeySecret: string;
  serverId: string;
}

export class EngineSocket {
  private ws!: ws.WebSocket;
  private connectedAt = 0;

  private readonly maxRetries = 20;
  private retryCount = 0;
  private readonly baseDelayMs = 1000;
  private manuallyClosed = false;

  private isConnecting = false;
  private isConnected = false;

  private activeTimers = new Set<NodeJS.Timeout>();
  private pingInterval?: NodeJS.Timeout;

  constructor(
    private readonly config: EngineSocketConfig,
    private readonly eventEmitter: RPEventEmitter<RPServerEvents>,
    private readonly logger: RPLogger,
  ) {}

  public async start(): Promise<void> {
    if (this.isConnecting || this.isConnected) {
      this.logger.warn('Socket is already connecting or connected, ignoring start() call');
      return;
    }

    this.manuallyClosed = false;
    this.isConnecting = true;

    try {
      await this.tryConnect();
      this.isConnected = true;
    } finally {
      this.isConnecting = false;
    }
  }

  public close(code?: number, reason?: string) {
    this.manuallyClosed = true;
    this.isConnected = false;
    this.isConnecting = false;

    // Clear all active timers
    this.clearAllTimers();

    // Clear ping interval
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = undefined;
    }

    if (this.ws) {
      this.ws.close(code, reason);
    }
  }

  private clearAllTimers(): void {
    this.activeTimers.forEach((timer) => clearTimeout(timer));
    this.activeTimers.clear();
  }

  private addTimer(timer: NodeJS.Timeout): NodeJS.Timeout {
    this.activeTimers.add(timer);
    return timer;
  }

  private async tryConnect(): Promise<void> {
    try {
      await this.connectOnce();
      this.retryCount = 0;
      this.logger.info('Socket connected successfully');
    } catch (err) {
      if (this.manuallyClosed) {
        this.logger.info('Socket manually closed, no more retries.');
        return;
      }
      this.retryCount++;
      if (this.retryCount > this.maxRetries) {
        this.logger.error(
          `Socket connection failed after maximum retries: ${this.maxRetries}`,
          err,
        );
        process.exit(1);
      }
      const delay = this.baseDelayMs * 2 ** (this.retryCount - 1);
      this.logger.warn(`WebSocket connection failed: ${err} retry count ${this.retryCount} with delay ${delay}ms`);
      await this.delay(delay);
      return this.tryConnect();
    }
  }

  private async connectOnce(): Promise<void> {
    return new Promise((resolve, reject) => {
      const connectionUrl = this.appendQuery(this.config.url, {
        apiKeyId: this.config.apiKeyId,
        apiKeySecret: this.config.apiKeySecret,
        serverId: this.config.serverId,
      });
      
      this.logger.info('Connecting to WebSocket:', connectionUrl);
      
      this.ws = new ws.WebSocket(
        connectionUrl,
        this.config.protocols,
        {
          perMessageDeflate: true,
          skipUTF8Validation: false,
          maxPayload: 10 * 1024 * 1024,
        },
      );
      this.ws.binaryType = 'arraybuffer';

      if ('on' in this.ws && typeof this.ws.on === 'function') {
        this.ws.on('ping', () => {
          this.logger.trace('Received ping from server');
          this.ws.pong();
        });

        this.ws.on('pong', () => {
          this.logger.trace('Received pong from server');
        });
      }

      this.ws.onerror = (err) => {
        this.logger.error('WebSocket error:', err);
        this.ws.close();
        reject(err);
      };
      this.ws.onclose = (e) => {
        reject(new Error(`WebSocket closed before handshake (${e.code}/${e.reason})`));
      };

      this.ws.onopen = () => {
        this.connectedAt = Date.now();
        this.logger.info('WebSocket connection opened, waiting for handshake...');

        const timer = this.addTimer(
          setTimeout(() => {
            this.logger.error('WebSocket handshake timeout after 60 seconds');
            this.ws.onmessage = null!;
            reject(new Error('Websocket handshake timeout'));
          }, 60_000),
        );

        const ackHandler = (ev: ws.MessageEvent) => {
          let msg: SocketMessage;
          try {
            msg = JSON.parse(ev.data as string);
            this.logger.debug('Received WebSocket message:', msg);
          } catch (error) {
            this.logger.warn('Failed to parse WebSocket message:', ev.data);
            return;
          }
          if (msg.event === 'connected') {
            clearTimeout(timer);
            this.activeTimers.delete(timer);
            const version = getVersion();
            this.send(
              OutgoingSocketEvents.Connected,
              {
                version,
                timestamp: this.connectedAt,
              },
              {},
            );
            this.ws.onmessage = this.handleMessage.bind(this);

            this.setupPingInterval();
            this.setupPostHandshakeReconnection();

            resolve();
          }
        };
        this.ws.onmessage = ackHandler;
      };
    });
  }

  private handleMessage(ev: ws.MessageEvent) {
    let msg: SocketMessage;
    try {
      msg = JSON.parse(ev.data as string);
    } catch (err) {
      this.logger.error('Invalid JSON', err);
      return;
    }

    if (!msg || !msg.data || typeof msg.data !== 'object' || msg.data === null) {
      this.logger.warn('Received message with invalid data:', msg);
      return;
    }

    const ts = msg.data?.timestamp;
    if (typeof ts === 'number' && ts < this.connectedAt) {
      return;
    }

    const raw = msg.event as IncomingSocketEvents;
    if (!(raw in IncomingSocketEventsMap)) {
      return;
    }

    const key = IncomingSocketEventsMap[raw];
    this.eventEmitter.emit(key as keyof RPServerEvents, msg.data as RPServerEvents[typeof key]);
  }

  private send<Data>(
    event: OutgoingSocketEvents,
    data: Data,
    headers: Record<string, string> = {},
  ) {
    const msg: SocketMessage = {
      event: event,
      data: { ...data, timestamp: Date.now() },
      headers: headers,
    };
    this.ws.send(JSON.stringify(msg));
  }

  private delay(ms: number): Promise<void> {
    return new Promise((res) => setTimeout(res, ms));
  }

  private appendQuery(url: string, query?: Record<string, unknown>): string {
    if (!query) return url;

    const parts = Object.entries(query)
      .filter(([, v]) => v != null)
      .map(([k, v]) => {
        const str = Array.isArray(v) ? v.map((x) => String(x)).join(',') : String(v);
        return `${encodeURIComponent(k)}=${encodeURIComponent(str)}`;
      });

    return parts.length ? `${url}?${parts.join('&')}` : url;
  }

  private setupPingInterval(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }

    this.pingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === 1) {
        if ('ping' in this.ws && typeof this.ws.ping === 'function') {
          this.ws.ping();
          this.logger.debug('Sent ping to server');
        }
      }
    }, 30000);
  }

  private setupPostHandshakeReconnection(): void {
    if (!this.ws) return;

    // Override close handler to handle post-handshake disconnections
    this.ws.onclose = (e) => {
      this.isConnected = false;

      // Clear ping interval on disconnect
      if (this.pingInterval) {
        clearInterval(this.pingInterval);
        this.pingInterval = undefined;
      }

      if (this.manuallyClosed) {
        this.logger.info('Socket manually closed');
        return;
      }

      this.logger.warn(
        `Connection lost after handshake (${e.code}/${e.reason}), attempting reconnect`,
      );

      // Attempt reconnection
      this.addTimer(
        setTimeout(() => {
          if (!this.manuallyClosed) {
            this.isConnecting = false; // Reset connecting state
            this.start().catch((err) => {
              this.logger.error('Reconnection failed:', err);
            });
          }
        }, 1000),
      );
    };

    // Handle errors during normal operation
    this.ws.onerror = (err) => {
      this.logger.error('WebSocket error during operation:', err);
      // Don't close immediately, let onclose handle reconnection
    };
  }
}
