import type { ConnectionInfo, ConnectionStatus, StreamMessage } from '../types/event';
import { getBackoffDelay } from '../utils/backoff';
import { parseStreamMessage } from '../utils/validate';

const SOCKET_CONNECTING = 0;
const SOCKET_OPEN = 1;

export interface StreamClientOptions {
  url: string;
  symbol: string;
  onMessage: (message: StreamMessage) => void;
  onStatus: (info: ConnectionInfo) => void;
  onMalformed?: () => void;
  onDropped?: () => void;
  createSocket?: (url: string) => WebSocket;
  /** `false` is trusted (no network); `true` only means "maybe", so sockets are still verified by the watchdog. */
  isOnline?: () => boolean;
  baseDelayMs?: number;
  maxDelayMs?: number;
  maxAttempts?: number;
  /** Give up on a handshake that has not produced a message within this time. */
  connectTimeoutMs?: number;
  /** Force a reconnect if an established feed goes quiet for this long. */
  staleTimeoutMs?: number;
  /** The retry counter only resets once a connection has stayed up this long, so a flapping socket keeps backing off. */
  stableAfterMs?: number;
  maxMessagesPerSecond?: number;
}

const DEFAULTS = {
  createSocket: (url: string): WebSocket => new WebSocket(url),
  isOnline: (): boolean => typeof navigator === 'undefined' || navigator.onLine !== false,
  baseDelayMs: 1_000,
  maxDelayMs: 15_000,
  maxAttempts: 6,
  connectTimeoutMs: 10_000,
  // The 24h ticker alone arrives every second, so 5 s of silence means the feed is dead.
  staleTimeoutMs: 5_000,
  stableAfterMs: 10_000,
  maxMessagesPerSecond: 2_000,
};

type ResolvedOptions = StreamClientOptions & typeof DEFAULTS;

/** Framework-agnostic WebSocket client: connection state machine, validation, backoff, watchdog and rate cap. */
export class StreamClient {
  private readonly options: ResolvedOptions;
  private socket: WebSocket | null = null;
  private stopped = true;
  private attempt = 0;
  private receivedSinceOpen = false;
  private lastActivityAt = 0;
  private rateWindowStart = 0;
  private rateWindowCount = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private stableTimer: ReturnType<typeof setTimeout> | null = null;
  private watchdogTimer: ReturnType<typeof setInterval> | null = null;
  private info: ConnectionInfo;

  constructor(options: StreamClientOptions) {
    this.options = { ...DEFAULTS, ...options };
    this.info = { status: 'idle', attempt: 0, maxAttempts: this.options.maxAttempts, nextRetryAt: null };
  }

  getInfo(): ConnectionInfo {
    return this.info;
  }

  connect(): void {
    if (!this.stopped) return;
    this.stopped = false;
    this.attempt = 0;
    this.open();
  }

  disconnect(): void {
    if (this.stopped) return;
    this.stopped = true;
    this.clearTimers();
    this.closeSocket();
    this.emit('idle');
  }

  /** Skip the remaining backoff (user action or browser came back online). */
  retryNow(): void {
    if (this.stopped || (this.info.status !== 'reconnecting' && this.info.status !== 'error')) return;
    this.clearTimers();
    this.attempt = 0;
    this.open();
  }

  /** Browser reported the network is gone: drop the socket now instead of waiting for the watchdog. */
  networkLost(): void {
    if (this.stopped || this.reconnectTimer !== null || this.info.status === 'error') return;
    this.clearTimers();
    this.closeSocket();
    this.scheduleReconnect();
  }

  private open(): void {
    this.closeSocket();
    // While offline, count the attempt as failed without opening a socket that cannot succeed.
    if (!this.options.isOnline()) {
      this.scheduleReconnect();
      return;
    }
    this.receivedSinceOpen = false;
    this.lastActivityAt = Date.now();
    this.emit(this.attempt === 0 ? 'connecting' : 'reconnecting');

    let socket: WebSocket;
    try {
      socket = this.options.createSocket(this.options.url);
    } catch {
      this.scheduleReconnect();
      return;
    }

    this.socket = socket;
    socket.onmessage = (event: MessageEvent) => this.handleMessage(socket, event.data);
    socket.onclose = () => this.handleClose(socket);
    this.startWatchdog();
  }

  private handleMessage(socket: WebSocket, data: unknown): void {
    if (socket !== this.socket) return;
    const now = Date.now();
    this.lastActivityAt = now;

    if (now - this.rateWindowStart >= 1_000) {
      this.rateWindowStart = now;
      this.rateWindowCount = 0;
    }
    this.rateWindowCount += 1;
    if (this.rateWindowCount > this.options.maxMessagesPerSecond) {
      this.options.onDropped?.();
      return;
    }

    const message = parseStreamMessage(data, this.options.symbol);
    if (!message) {
      this.options.onMalformed?.();
      return;
    }

    if (!this.receivedSinceOpen) {
      this.receivedSinceOpen = true;
      this.emit('live');
      this.stableTimer = setTimeout(() => {
        this.stableTimer = null;
        this.attempt = 0;
      }, this.options.stableAfterMs);
    }
    this.options.onMessage(message);
  }

  private handleClose(socket: WebSocket): void {
    if (socket !== this.socket) return;
    this.socket = null;
    this.clearTimers();
    if (!this.stopped) this.scheduleReconnect();
  }

  private scheduleReconnect(): void {
    if (this.attempt >= this.options.maxAttempts) {
      this.emit('error');
      return;
    }
    const delay = getBackoffDelay(this.attempt, {
      baseMs: this.options.baseDelayMs,
      maxMs: this.options.maxDelayMs,
    });
    this.attempt += 1;
    this.emit('reconnecting', Date.now() + delay);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.open();
    }, delay);
  }

  private startWatchdog(): void {
    const { connectTimeoutMs, staleTimeoutMs } = this.options;
    const interval = Math.max(250, Math.floor(Math.min(connectTimeoutMs, staleTimeoutMs) / 4));
    this.watchdogTimer = setInterval(() => {
      const limit = this.receivedSinceOpen ? staleTimeoutMs : connectTimeoutMs;
      if (Date.now() - this.lastActivityAt <= limit) return;
      this.clearTimers();
      this.closeSocket();
      this.scheduleReconnect();
    }, interval);
  }

  private closeSocket(): void {
    const socket = this.socket;
    if (!socket) return;
    this.socket = null;
    socket.onopen = null;
    socket.onmessage = null;
    socket.onclose = null;
    socket.onerror = null;
    if (socket.readyState === SOCKET_CONNECTING) {
      // Closing mid-handshake logs a browser warning; close as soon as it opens instead.
      socket.onopen = () => socket.close(1000);
    } else if (socket.readyState === SOCKET_OPEN) {
      socket.close(1000);
    }
  }

  private clearTimers(): void {
    if (this.reconnectTimer !== null) clearTimeout(this.reconnectTimer);
    if (this.stableTimer !== null) clearTimeout(this.stableTimer);
    if (this.watchdogTimer !== null) clearInterval(this.watchdogTimer);
    this.reconnectTimer = null;
    this.stableTimer = null;
    this.watchdogTimer = null;
  }

  private emit(status: ConnectionStatus, nextRetryAt: number | null = null): void {
    this.info = { status, attempt: this.attempt, maxAttempts: this.options.maxAttempts, nextRetryAt };
    this.options.onStatus(this.info);
  }
}
