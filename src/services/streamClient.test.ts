import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { tradeFrame } from '../test/fixtures';
import type { ConnectionInfo } from '../types/event';
import { StreamClient, type StreamClientOptions } from './streamClient';

class FakeSocket {
  static instances: FakeSocket[] = [];
  readyState = 0;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  close = vi.fn(() => {
    this.readyState = 3;
  });

  constructor(readonly url: string) {
    FakeSocket.instances.push(this);
  }

  open() {
    this.readyState = 1;
    this.onopen?.();
  }

  send(data: unknown) {
    this.onmessage?.({ data });
  }

  drop() {
    this.readyState = 3;
    this.onclose?.();
  }
}

const latestSocket = () => FakeSocket.instances[FakeSocket.instances.length - 1];

function setup(overrides: Partial<StreamClientOptions> = {}) {
  const statuses: ConnectionInfo[] = [];
  const onMessage = vi.fn();
  const onMalformed = vi.fn();
  const onDropped = vi.fn();
  const client = new StreamClient({
    url: 'wss://example.test/stream',
    symbol: 'BTCUSDT',
    onMessage,
    onMalformed,
    onDropped,
    onStatus: (info) => statuses.push(info),
    createSocket: (url) => new FakeSocket(url) as unknown as WebSocket,
    maxAttempts: 3,
    ...overrides,
  });
  const lastStatus = () => statuses[statuses.length - 1]?.status;
  return { client, statuses, lastStatus, onMessage, onMalformed, onDropped };
}

describe('StreamClient', () => {
  beforeEach(() => {
    FakeSocket.instances = [];
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(1);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('goes connecting -> live on the first valid message', () => {
    const { client, lastStatus, onMessage } = setup();
    client.connect();
    expect(lastStatus()).toBe('connecting');

    latestSocket().open();
    latestSocket().send(tradeFrame());

    expect(lastStatus()).toBe('live');
    expect(onMessage).toHaveBeenCalledWith(expect.objectContaining({ kind: 'trade' }));
    client.disconnect();
  });

  it('reports malformed frames without forwarding them', () => {
    const { client, onMessage, onMalformed } = setup();
    client.connect();
    latestSocket().open();
    latestSocket().send('{not json');
    latestSocket().send(tradeFrame({ p: '<script>' }));

    expect(onMalformed).toHaveBeenCalledTimes(2);
    expect(onMessage).not.toHaveBeenCalled();
    client.disconnect();
  });

  it('reconnects with exponential backoff and gives up after maxAttempts', () => {
    const { client, statuses, lastStatus } = setup();
    client.connect();

    latestSocket().drop();
    expect(lastStatus()).toBe('reconnecting');
    expect(statuses[statuses.length - 1].nextRetryAt).toBe(Date.now() + 1_000);

    vi.advanceTimersByTime(1_000);
    expect(FakeSocket.instances).toHaveLength(2);
    latestSocket().drop();
    expect(statuses[statuses.length - 1].nextRetryAt).toBe(Date.now() + 2_000);

    vi.advanceTimersByTime(2_000);
    latestSocket().drop();
    vi.advanceTimersByTime(4_000);
    latestSocket().drop();

    expect(lastStatus()).toBe('error');
    expect(FakeSocket.instances).toHaveLength(4);
  });

  it('retryNow skips the backoff wait', () => {
    const { client, lastStatus } = setup();
    client.connect();
    latestSocket().drop();
    expect(lastStatus()).toBe('reconnecting');

    client.retryNow();
    expect(FakeSocket.instances).toHaveLength(2);
    expect(lastStatus()).toBe('connecting');
    client.disconnect();
  });

  it('forces a reconnect when the feed goes silent', () => {
    const { client, lastStatus } = setup({ staleTimeoutMs: 4_000 });
    client.connect();
    latestSocket().open();
    latestSocket().send(tradeFrame());

    vi.advanceTimersByTime(5_000);
    expect(lastStatus()).toBe('reconnecting');
    expect(FakeSocket.instances[0].close).toHaveBeenCalled();
    client.disconnect();
  });

  it('drops messages above the per-second cap', () => {
    const { client, onMessage, onDropped } = setup({ maxMessagesPerSecond: 5 });
    client.connect();
    latestSocket().open();
    for (let i = 0; i < 8; i += 1) latestSocket().send(tradeFrame({ a: i }));

    expect(onMessage).toHaveBeenCalledTimes(5);
    expect(onDropped).toHaveBeenCalledTimes(3);
    client.disconnect();
  });

  it('does not reconnect after an intentional disconnect', () => {
    const { client, lastStatus } = setup();
    client.connect();
    latestSocket().open();
    client.disconnect();

    vi.advanceTimersByTime(60_000);
    expect(lastStatus()).toBe('idle');
    expect(FakeSocket.instances).toHaveLength(1);
  });

  it('drops a live socket immediately when the network is lost', () => {
    const { client, lastStatus } = setup();
    client.connect();
    latestSocket().open();
    latestSocket().send(tradeFrame());
    expect(lastStatus()).toBe('live');

    client.networkLost();
    expect(lastStatus()).toBe('reconnecting');
    expect(FakeSocket.instances[0].close).toHaveBeenCalled();
    client.disconnect();
  });

  it('while offline, retries without opening sockets and then reports error', () => {
    let online = true;
    const { client, lastStatus } = setup({ isOnline: () => online });
    client.connect();
    latestSocket().open();
    latestSocket().send(tradeFrame());

    online = false;
    client.networkLost();
    vi.advanceTimersByTime(1_000 + 2_000 + 4_000);

    expect(lastStatus()).toBe('error');
    expect(FakeSocket.instances).toHaveLength(1);

    online = true;
    client.retryNow();
    expect(lastStatus()).toBe('connecting');
    expect(FakeSocket.instances).toHaveLength(2);
    client.disconnect();
  });

  it('times out a handshake that never delivers data', () => {
    const { client, lastStatus } = setup({ connectTimeoutMs: 3_000 });
    client.connect();

    vi.advanceTimersByTime(4_000);
    expect(lastStatus()).toBe('reconnecting');
    client.disconnect();
  });
});
