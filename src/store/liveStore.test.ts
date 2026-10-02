import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeTrade } from '../test/fixtures';
import { createLiveStore } from './liveStore';

const trade = (id: number, time = 1_700_000_000_000 + id) => ({ kind: 'trade' as const, data: makeTrade({ id, time }) });

describe('createLiveStore', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('batches a burst of messages into a single notification per flush', () => {
    const store = createLiveStore({ bufferSize: 100, flushIntervalMs: 250, maxWindowSec: 900 });
    const listener = vi.fn();
    store.subscribe(listener);
    store.start();

    for (let i = 0; i < 1_000; i += 1) store.ingest(trade(i));
    expect(listener).not.toHaveBeenCalled();

    vi.advanceTimersByTime(250);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(store.getSnapshot().stats.totalTrades).toBe(1_000);
    store.stop();
  });

  it('keeps memory bounded to the configured buffer size', () => {
    const store = createLiveStore({ bufferSize: 50, flushIntervalMs: 250, maxWindowSec: 900 });
    for (let i = 0; i < 500; i += 1) store.ingest(trade(i));
    store.flush();

    const { trades } = store.getSnapshot();
    expect(trades).toHaveLength(50);
    expect(trades[0].id).toBe(499);
  });

  it('aggregates trades into one bucket per second', () => {
    const store = createLiveStore({ bufferSize: 100, flushIntervalMs: 250, maxWindowSec: 900 });
    store.ingest(trade(1, 1_000));
    store.ingest(trade(2, 1_500));
    store.ingest(trade(3, 2_100));
    store.flush();

    const { buckets } = store.getSnapshot();
    expect(buckets.map((b) => [b.time, b.tradeCount])).toEqual([
      [1, 2],
      [2, 1],
    ]);
  });

  it('freezes the published view while paused and catches up on resume', () => {
    const store = createLiveStore({ bufferSize: 100, flushIntervalMs: 250, maxWindowSec: 900 });
    store.start();
    store.ingest(trade(1));
    vi.advanceTimersByTime(250);

    store.setPaused(true);
    const frozen = store.getSnapshot().trades;
    store.ingest(trade(2));
    vi.advanceTimersByTime(1_000);
    expect(store.getSnapshot().trades).toBe(frozen);

    store.setPaused(false);
    expect(store.getSnapshot().trades.map((t) => t.id)).toEqual([2, 1]);
    store.stop();
  });

  it('keeps unchanged slices referentially stable', () => {
    const store = createLiveStore({ bufferSize: 100, flushIntervalMs: 250, maxWindowSec: 900 });
    store.ingest(trade(1));
    store.flush();
    const { buckets, ticker } = store.getSnapshot();

    store.recordMalformed();
    store.flush();
    expect(store.getSnapshot().buckets).toBe(buckets);
    expect(store.getSnapshot().ticker).toBe(ticker);
    expect(store.getSnapshot().stats.malformed).toBe(1);
  });

  it('shrinks the buffer at runtime keeping the newest trades', () => {
    const store = createLiveStore({ bufferSize: 200, flushIntervalMs: 250, maxWindowSec: 900 });
    for (let i = 0; i < 200; i += 1) store.ingest(trade(i));
    store.setBufferSize(50);

    const { trades, settings } = store.getSnapshot();
    expect(settings.bufferSize).toBe(50);
    expect(trades).toHaveLength(50);
    expect(trades[0].id).toBe(199);
  });
});
