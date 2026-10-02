import { describe, expect, it } from 'vitest';
import { makeTrade } from '../test/fixtures';
import type { SecondBucket } from '../types/event';
import { filterTrades, selectWindowBuckets, summarizeWindow } from './aggregate';

const bucket = (time: number, overrides: Partial<SecondBucket> = {}): SecondBucket => ({
  time,
  open: 100,
  high: 100,
  low: 100,
  close: 100,
  tradeCount: 1,
  buyCount: 1,
  sellCount: 0,
  buyVolume: 1,
  sellVolume: 0,
  quoteVolume: 100,
  ...overrides,
});

describe('window aggregation', () => {
  const buckets = [bucket(10, { open: 90 }), bucket(50), bucket(100, { close: 110, sellCount: 1, sellVolume: 1, quoteVolume: 210 })];

  it('selects buckets relative to the newest bucket', () => {
    expect(selectWindowBuckets(buckets, 60).map((b) => b.time)).toEqual([50, 100]);
    expect(selectWindowBuckets(buckets, 900)).toBe(buckets);
  });

  it('summarizes counts, VWAP and change for the window', () => {
    const summary = summarizeWindow(buckets, 60);
    expect(summary.tradeCount).toBe(2);
    expect(summary.sellCount).toBe(1);
    expect(summary.vwap).toBeCloseTo(310 / 3);
    expect(summary.changePercent).toBeCloseTo(10);
  });

  it('returns empty values for no data', () => {
    expect(summarizeWindow([], 60)).toMatchObject({ tradeCount: 0, vwap: null, changePercent: null });
  });
});

describe('filterTrades', () => {
  const trades = [
    makeTrade({ id: 3, time: 100_000, side: 'sell' }),
    makeTrade({ id: 2, time: 90_000, side: 'buy' }),
    makeTrade({ id: 1, time: 10_000, side: 'buy' }),
  ];

  it('filters by side and time window (newest-first input)', () => {
    expect(filterTrades(trades, 'all', 60).map((t) => t.id)).toEqual([3, 2]);
    expect(filterTrades(trades, 'buy', 900).map((t) => t.id)).toEqual([2, 1]);
    expect(filterTrades(trades, 'sell', 60).map((t) => t.id)).toEqual([3]);
  });
});
