export type TradeSide = 'buy' | 'sell';

/** Validated 24h rolling ticker (Binance `24hrTicker` event). */
export interface Ticker {
  symbol: string;
  eventTime: number;
  lastPrice: number;
  priceChange: number;
  priceChangePercent: number;
  high: number;
  low: number;
  baseVolume: number;
  quoteVolume: number;
  tradeCount: number;
}

/** Validated aggregate trade (Binance `aggTrade` event). */
export interface Trade {
  id: number;
  symbol: string;
  price: number;
  quantity: number;
  /** Trade time, epoch ms. */
  time: number;
  side: TradeSide;
}

export type StreamMessage =
  | { kind: 'ticker'; data: Ticker }
  | { kind: 'trade'; data: Trade };

/** One-second OHLC + flow aggregate built from trades. */
export interface SecondBucket {
  /** Epoch seconds. */
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  tradeCount: number;
  buyCount: number;
  sellCount: number;
  buyVolume: number;
  sellVolume: number;
  quoteVolume: number;
}

export type ConnectionStatus = 'idle' | 'connecting' | 'live' | 'reconnecting' | 'error';

export interface ConnectionInfo {
  status: ConnectionStatus;
  attempt: number;
  maxAttempts: number;
  /** Epoch ms of the next scheduled reconnect, if one is pending. */
  nextRetryAt: number | null;
}
