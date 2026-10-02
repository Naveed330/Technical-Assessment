import { BUFFER_SIZE_LIMITS, FLUSH_INTERVAL_LIMITS } from '../config';
import type { ConnectionInfo, SecondBucket, StreamMessage, Ticker, Trade } from '../types/event';
import { clamp } from '../utils/helpers';
import { RingBuffer } from '../utils/ringBuffer';

export interface StreamStats {
  totalMessages: number;
  totalTrades: number;
  malformed: number;
  dropped: number;
  messagesPerSecond: number;
  lastMessageAt: number | null;
}

export interface LiveSettings {
  bufferSize: number;
  flushIntervalMs: number;
}

export interface LiveSnapshot {
  connection: ConnectionInfo;
  paused: boolean;
  pausedAt: number | null;
  ticker: Ticker | null;
  trades: readonly Trade[];
  buckets: readonly SecondBucket[];
  stats: StreamStats;
  settings: LiveSettings;
}

export interface LiveStore {
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => LiveSnapshot;
  ingest: (message: StreamMessage) => void;
  recordMalformed: () => void;
  recordDropped: () => void;
  setConnection: (info: ConnectionInfo) => void;
  setPaused: (paused: boolean) => void;
  setVisible: (visible: boolean) => void;
  setFlushInterval: (ms: number) => void;
  setBufferSize: (size: number) => void;
  flush: () => void;
  start: () => void;
  stop: () => void;
}

export interface LiveStoreOptions {
  bufferSize: number;
  flushIntervalMs: number;
  maxWindowSec: number;
  now?: () => number;
}

const RATE_WINDOW_MS = 3_000;

const clampBufferSize = (size: number) =>
  clamp(Math.round(size), BUFFER_SIZE_LIMITS.min, BUFFER_SIZE_LIMITS.max);
const clampFlushInterval = (ms: number) =>
  clamp(Math.round(ms), FLUSH_INTERVAL_LIMITS.min, FLUSH_INTERVAL_LIMITS.max);

export function createLiveStore(options: LiveStoreOptions): LiveStore {
  const now = options.now ?? Date.now;
  let settings: LiveSettings = {
    bufferSize: clampBufferSize(options.bufferSize),
    flushIntervalMs: clampFlushInterval(options.flushIntervalMs),
  };
  let trades = new RingBuffer<Trade>(settings.bufferSize);
  const buckets = new RingBuffer<SecondBucket>(options.maxWindowSec + 1);
  let latestTicker: Ticker | null = null;
  const counters = {
    totalMessages: 0,
    totalTrades: 0,
    malformed: 0,
    dropped: 0,
    lastMessageAt: null as number | null,
  };

  let tradesDirty = false;
  let bucketsDirty = false;
  let tickerDirty = false;
  let statsDirty = false;
  let rateSamples: { t: number; total: number }[] = [];
  let paused = false;
  let visible = true;
  let timer: ReturnType<typeof setInterval> | null = null;
  const listeners = new Set<() => void>();

  let snapshot: LiveSnapshot = {
    connection: { status: 'idle', attempt: 0, maxAttempts: 0, nextRetryAt: null },
    paused: false,
    pausedAt: null,
    ticker: null,
    trades: [],
    buckets: [],
    stats: { ...counters, messagesPerSecond: 0 },
    settings,
  };

  const publish = (next: LiveSnapshot) => {
    snapshot = next;
    listeners.forEach((listener) => listener());
  };

  const addToBucket = (trade: Trade) => {
    const second = Math.floor(trade.time / 1000);
    const isBuy = trade.side === 'buy';
    const notional = trade.price * trade.quantity;
    const last = buckets.last();

    if (!last || second > last.time) {
      buckets.push({
        time: second,
        open: trade.price,
        high: trade.price,
        low: trade.price,
        close: trade.price,
        tradeCount: 1,
        buyCount: isBuy ? 1 : 0,
        sellCount: isBuy ? 0 : 1,
        buyVolume: isBuy ? trade.quantity : 0,
        sellVolume: isBuy ? 0 : trade.quantity,
        quoteVolume: notional,
      });
    } else {
      buckets.replaceLast({
        ...last,
        high: Math.max(last.high, trade.price),
        low: Math.min(last.low, trade.price),
        close: second === last.time ? trade.price : last.close,
        tradeCount: last.tradeCount + 1,
        buyCount: last.buyCount + (isBuy ? 1 : 0),
        sellCount: last.sellCount + (isBuy ? 0 : 1),
        buyVolume: last.buyVolume + (isBuy ? trade.quantity : 0),
        sellVolume: last.sellVolume + (isBuy ? 0 : trade.quantity),
        quoteVolume: last.quoteVolume + notional,
      });
    }
    bucketsDirty = true;
  };

  const sampleRate = (t: number): number => {
    rateSamples.push({ t, total: counters.totalMessages });
    const cutoff = t - RATE_WINDOW_MS;
    if (rateSamples[0].t < cutoff) rateSamples = rateSamples.filter((s) => s.t >= cutoff);
    const first = rateSamples[0];
    const elapsedSec = (t - first.t) / 1000;
    if (elapsedSec <= 0) return snapshot.stats.messagesPerSecond;
    return Math.round(((counters.totalMessages - first.total) / elapsedSec) * 10) / 10;
  };

  const commit = (messagesPerSecond: number) => {
    const rateChanged = messagesPerSecond !== snapshot.stats.messagesPerSecond;
    if (!tradesDirty && !bucketsDirty && !tickerDirty && !statsDirty && !rateChanged) return;

    publish({
      ...snapshot,
      ticker: tickerDirty ? latestTicker : snapshot.ticker,
      trades: tradesDirty ? trades.newestFirst() : snapshot.trades,
      buckets: bucketsDirty ? buckets.toArray() : snapshot.buckets,
      stats: statsDirty || rateChanged ? { ...counters, messagesPerSecond } : snapshot.stats,
    });
    tradesDirty = false;
    bucketsDirty = false;
    tickerDirty = false;
    statsDirty = false;
  };

  const tick = () => {
    const rate = sampleRate(now());
    if (paused || !visible) return;
    commit(rate);
  };

  const flush = () => commit(snapshot.stats.messagesPerSecond);

  const startTimer = () => {
    timer = setInterval(tick, settings.flushIntervalMs);
  };

  const stopTimer = () => {
    if (timer !== null) clearInterval(timer);
    timer = null;
  };

  return {
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    getSnapshot: () => snapshot,

    ingest: (message) => {
      counters.totalMessages += 1;
      counters.lastMessageAt = now();
      statsDirty = true;
      if (message.kind === 'ticker') {
        latestTicker = message.data;
        tickerDirty = true;
        return;
      }
      counters.totalTrades += 1;
      trades.push(message.data);
      tradesDirty = true;
      addToBucket(message.data);
    },

    recordMalformed: () => {
      counters.malformed += 1;
      statsDirty = true;
    },

    recordDropped: () => {
      counters.dropped += 1;
      statsDirty = true;
    },

    setConnection: (info) => {
      publish({ ...snapshot, connection: info });
    },

    setPaused: (value) => {
      if (paused === value) return;
      paused = value;
      publish({ ...snapshot, paused: value, pausedAt: value ? now() : null });
      if (!value && visible) flush();
    },

    setVisible: (value) => {
      if (visible === value) return;
      visible = value;
      if (value && !paused) flush();
    },

    setFlushInterval: (ms) => {
      const flushIntervalMs = clampFlushInterval(ms);
      if (flushIntervalMs === settings.flushIntervalMs) return;
      settings = { ...settings, flushIntervalMs };
      if (timer !== null) {
        stopTimer();
        startTimer();
      }
      publish({ ...snapshot, settings });
    },

    setBufferSize: (size) => {
      const bufferSize = clampBufferSize(size);
      if (bufferSize === settings.bufferSize) return;
      const next = new RingBuffer<Trade>(bufferSize);
      trades.toArray().slice(-bufferSize).forEach((trade) => next.push(trade));
      trades = next;
      tradesDirty = true;
      settings = { ...settings, bufferSize };
      publish({ ...snapshot, settings });
      if (!paused && visible) flush();
    },

    flush,

    start: () => {
      if (timer === null) startTimer();
    },

    stop: stopTimer,
  };
}
