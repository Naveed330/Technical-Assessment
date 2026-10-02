import type { SecondBucket, Trade } from '../types/event';
import type { SideFilter } from '../types/filters';

export interface WindowSummary {
  tradeCount: number;
  buyCount: number;
  sellCount: number;
  buyVolume: number;
  sellVolume: number;
  vwap: number | null;
  changePercent: number | null;
}

/** Buckets within `windowSec` of the newest bucket (data time, so a paused view stays stable). */
export function selectWindowBuckets(buckets: readonly SecondBucket[], windowSec: number): readonly SecondBucket[] {
  if (buckets.length === 0) return buckets;
  const start = buckets[buckets.length - 1].time - windowSec + 1;
  let i = buckets.length - 1;
  while (i > 0 && buckets[i - 1].time >= start) i -= 1;
  return i === 0 ? buckets : buckets.slice(i);
}

export function summarizeWindow(buckets: readonly SecondBucket[], windowSec: number): WindowSummary {
  const inWindow = selectWindowBuckets(buckets, windowSec);
  let tradeCount = 0;
  let buyCount = 0;
  let sellCount = 0;
  let buyVolume = 0;
  let sellVolume = 0;
  let quoteVolume = 0;

  for (const bucket of inWindow) {
    tradeCount += bucket.tradeCount;
    buyCount += bucket.buyCount;
    sellCount += bucket.sellCount;
    buyVolume += bucket.buyVolume;
    sellVolume += bucket.sellVolume;
    quoteVolume += bucket.quoteVolume;
  }

  const volume = buyVolume + sellVolume;
  const first = inWindow[0];
  const last = inWindow[inWindow.length - 1];

  return {
    tradeCount,
    buyCount,
    sellCount,
    buyVolume,
    sellVolume,
    vwap: volume > 0 ? quoteVolume / volume : null,
    changePercent: first && last && first.open > 0 ? ((last.close - first.open) / first.open) * 100 : null,
  };
}

/** `trades` must be newest-first; the window is relative to the newest trade. */
export function filterTrades(trades: readonly Trade[], side: SideFilter, windowSec: number): readonly Trade[] {
  if (trades.length === 0) return trades;
  const cutoff = trades[0].time - windowSec * 1000;
  const result: Trade[] = [];
  for (const trade of trades) {
    if (trade.time < cutoff) break;
    if (side === 'all' || trade.side === side) result.push(trade);
  }
  return result;
}
