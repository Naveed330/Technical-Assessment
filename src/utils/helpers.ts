const priceFormat = new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const quantityFormat = new Intl.NumberFormat(undefined, { maximumFractionDigits: 5 });
const integerFormat = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 });
const compactFormat = new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 2 });
const percentFormat = new Intl.NumberFormat(undefined, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  signDisplay: 'exceptZero',
});
const timeFormat = new Intl.DateTimeFormat(undefined, {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

export const formatPrice = (value: number): string => priceFormat.format(value);
export const formatQuantity = (value: number): string => quantityFormat.format(value);
export const formatInteger = (value: number): string => integerFormat.format(value);
export const formatCompact = (value: number): string => compactFormat.format(value);
export const formatPercent = (value: number): string => `${percentFormat.format(value)}%`;
export const formatTime = (epochMs: number): string => timeFormat.format(epochMs);
export const formatTimeMs = (epochMs: number): string =>
  `${timeFormat.format(epochMs)}.${String(epochMs % 1000).padStart(3, '0')}`;

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export type Tone = 'up' | 'down' | 'neutral';

export function toneOf(value: number | null | undefined): Tone {
  if (value === null || value === undefined || value === 0) return 'neutral';
  return value > 0 ? 'up' : 'down';
}
