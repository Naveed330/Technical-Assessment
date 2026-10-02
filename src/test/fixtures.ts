import type { Trade } from '../types/event';

export const tickerFrame = (overrides: Record<string, unknown> = {}) =>
  JSON.stringify({
    stream: 'btcusdt@ticker',
    data: {
      e: '24hrTicker',
      E: 1_700_000_000_000,
      s: 'BTCUSDT',
      p: '150.00',
      P: '0.25',
      c: '60000.10',
      h: '61000.00',
      l: '59000.00',
      v: '12345.678',
      q: '740000000.00',
      n: 987654,
      ...overrides,
    },
  });

export const tradeFrame = (overrides: Record<string, unknown> = {}) =>
  JSON.stringify({
    stream: 'btcusdt@aggTrade',
    data: {
      e: 'aggTrade',
      E: 1_700_000_000_100,
      s: 'BTCUSDT',
      a: 42,
      p: '60000.50',
      q: '0.015',
      T: 1_700_000_000_050,
      m: false,
      ...overrides,
    },
  });

export const makeTrade = (overrides: Partial<Trade> = {}): Trade => ({
  id: 1,
  symbol: 'BTCUSDT',
  price: 60_000,
  quantity: 0.5,
  time: 1_700_000_000_000,
  side: 'buy',
  ...overrides,
});
