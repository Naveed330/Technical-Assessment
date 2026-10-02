import { clamp } from './utils/helpers';

export const DEFAULT_WS_BASE_URL = 'wss://stream.binance.com:9443';
export const DEFAULT_SYMBOL = 'BTCUSDT';

export const ALLOWED_STREAM_HOSTS: ReadonlySet<string> = new Set([
  'stream.binance.com',
  'data-stream.binance.vision',
  'stream.binance.us',
]);

export const MAX_WINDOW_SEC = 900;

export const TIME_WINDOWS = [
  { label: '1m', seconds: 60 },
  { label: '5m', seconds: 300 },
  { label: '15m', seconds: 900 },
] as const;

export const BUFFER_SIZE_LIMITS = { min: 50, max: 10_000 } as const;
export const FLUSH_INTERVAL_LIMITS = { min: 50, max: 5_000 } as const;
export const BUFFER_SIZE_OPTIONS: readonly number[] = [200, 500, 1000, 2000];
export const FLUSH_INTERVAL_OPTIONS: readonly number[] = [100, 250, 500, 1000];

export interface AppConfig {
  symbol: string;
  wsUrl: string;
  bufferSize: number;
  flushIntervalMs: number;
}

export function resolveBaseUrl(raw: string | undefined): string {
  if (!raw) return DEFAULT_WS_BASE_URL;
  try {
    const url = new URL(raw.trim());
    if (url.protocol !== 'wss:' || !ALLOWED_STREAM_HOSTS.has(url.hostname) || url.username || url.password) {
      return DEFAULT_WS_BASE_URL;
    }
    return `${url.protocol}//${url.host}`;
  } catch {
    return DEFAULT_WS_BASE_URL;
  }
}

export function resolveSymbol(raw: string | undefined): string {
  const symbol = (raw ?? '').trim().toUpperCase();
  return /^[A-Z0-9]{5,20}$/.test(symbol) ? symbol : DEFAULT_SYMBOL;
}

export function resolveInt(raw: string | undefined, fallback: number, min: number, max: number): number {
  if (!raw || !/^\d{1,6}$/.test(raw.trim())) return fallback;
  return clamp(Number(raw.trim()), min, max);
}

export function buildStreamUrl(baseUrl: string, symbol: string): string {
  const stream = symbol.toLowerCase();
  return `${baseUrl}/stream?streams=${stream}@ticker/${stream}@aggTrade`;
}

const symbol = resolveSymbol(import.meta.env.VITE_SYMBOL);

export const appConfig: AppConfig = {
  symbol,
  wsUrl: buildStreamUrl(resolveBaseUrl(import.meta.env.VITE_WS_BASE_URL), symbol),
  bufferSize: resolveInt(
    import.meta.env.VITE_BUFFER_SIZE,
    1000,
    BUFFER_SIZE_LIMITS.min,
    BUFFER_SIZE_LIMITS.max,
  ),
  flushIntervalMs: resolveInt(
    import.meta.env.VITE_FLUSH_INTERVAL_MS,
    250,
    FLUSH_INTERVAL_LIMITS.min,
    FLUSH_INTERVAL_LIMITS.max,
  ),
};
