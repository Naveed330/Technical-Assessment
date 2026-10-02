import type { StreamMessage, Ticker, Trade } from '../types/event';

/** Binance ticker/aggTrade frames are well under 1 KB; anything far larger is rejected unparsed. */
export const MAX_MESSAGE_LENGTH = 8_192;

const DECIMAL_PATTERN = /^-?\d{1,20}(?:\.\d{1,20})?$/;
const SYMBOL_PATTERN = /^[A-Z0-9]{2,20}$/;

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toDecimal(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string' || !DECIMAL_PATTERN.test(value)) return null;
  return Number(value);
}

function toPositive(value: unknown): number | null {
  const n = toDecimal(value);
  return n !== null && n > 0 ? n : null;
}

function toNonNegative(value: unknown): number | null {
  const n = toDecimal(value);
  return n !== null && n >= 0 ? n : null;
}

function toCount(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function toTimestamp(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : null;
}

function parseTicker(data: UnknownRecord, symbol: string): Ticker | null {
  const eventTime = toTimestamp(data.E);
  const lastPrice = toPositive(data.c);
  const priceChange = toDecimal(data.p);
  const priceChangePercent = toDecimal(data.P);
  const high = toPositive(data.h);
  const low = toPositive(data.l);
  const baseVolume = toNonNegative(data.v);
  const quoteVolume = toNonNegative(data.q);
  const tradeCount = toCount(data.n);

  if (
    eventTime === null ||
    lastPrice === null ||
    priceChange === null ||
    priceChangePercent === null ||
    high === null ||
    low === null ||
    baseVolume === null ||
    quoteVolume === null ||
    tradeCount === null ||
    low > high
  ) {
    return null;
  }

  return {
    symbol,
    eventTime,
    lastPrice,
    priceChange,
    priceChangePercent,
    high,
    low,
    baseVolume,
    quoteVolume,
    tradeCount,
  };
}

function parseAggTrade(data: UnknownRecord, symbol: string): Trade | null {
  const id = toCount(data.a);
  const price = toPositive(data.p);
  const quantity = toPositive(data.q);
  const time = toTimestamp(data.T);

  if (id === null || price === null || quantity === null || time === null || typeof data.m !== 'boolean') {
    return null;
  }

  // m = buyer is the maker, i.e. the aggressor was a seller.
  return { id, symbol, price, quantity, time, side: data.m ? 'sell' : 'buy' };
}

/**
 * Turns an untrusted WebSocket frame into a typed message, or `null` if it is
 * oversized, not JSON, for another symbol, or fails any field check.
 */
export function parseStreamMessage(raw: unknown, expectedSymbol: string): StreamMessage | null {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > MAX_MESSAGE_LENGTH) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(parsed)) return null;

  // Combined streams wrap the payload as { stream, data }.
  const payload = typeof parsed.stream === 'string' && isRecord(parsed.data) ? parsed.data : parsed;

  const symbol = payload.s;
  if (typeof symbol !== 'string' || !SYMBOL_PATTERN.test(symbol) || symbol !== expectedSymbol) {
    return null;
  }

  if (payload.e === '24hrTicker') {
    const ticker = parseTicker(payload, symbol);
    return ticker ? { kind: 'ticker', data: ticker } : null;
  }
  if (payload.e === 'aggTrade') {
    const trade = parseAggTrade(payload, symbol);
    return trade ? { kind: 'trade', data: trade } : null;
  }
  return null;
}
