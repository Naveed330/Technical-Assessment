import { describe, expect, it } from 'vitest';
import { tickerFrame, tradeFrame } from '../test/fixtures';
import { MAX_MESSAGE_LENGTH, parseStreamMessage } from './validate';

describe('parseStreamMessage', () => {
  it('parses a combined-stream ticker into numbers', () => {
    const result = parseStreamMessage(tickerFrame(), 'BTCUSDT');
    expect(result).toEqual({
      kind: 'ticker',
      data: expect.objectContaining({ symbol: 'BTCUSDT', lastPrice: 60000.1, high: 61000, tradeCount: 987654 }),
    });
  });

  it('parses an aggTrade and maps the maker flag to the aggressor side', () => {
    expect(parseStreamMessage(tradeFrame({ m: false }), 'BTCUSDT')).toMatchObject({
      kind: 'trade',
      data: { id: 42, price: 60000.5, quantity: 0.015, side: 'buy' },
    });
    expect(parseStreamMessage(tradeFrame({ m: true }), 'BTCUSDT')).toMatchObject({ data: { side: 'sell' } });
  });

  it('accepts unwrapped single-stream payloads', () => {
    const raw = JSON.stringify(JSON.parse(tradeFrame()).data);
    expect(parseStreamMessage(raw, 'BTCUSDT')?.kind).toBe('trade');
  });

  it.each([
    ['non-string frame', new ArrayBuffer(8)],
    ['empty string', ''],
    ['invalid JSON', '{"e":'],
    ['JSON array', '[1,2,3]'],
    ['oversized frame', 'x'.repeat(MAX_MESSAGE_LENGTH + 1)],
    ['unknown event type', tradeFrame({ e: 'depthUpdate' })],
    ['other symbol', tradeFrame({ s: 'ETHUSDT' })],
    ['script in symbol', tradeFrame({ s: '<img src=x onerror=alert(1)>' })],
    ['non-numeric price', tradeFrame({ p: '1e9999' })],
    ['negative quantity', tradeFrame({ q: '-1' })],
    ['NaN price', tradeFrame({ p: 'NaN' })],
    ['missing side flag', tradeFrame({ m: 'yes' })],
    ['fractional trade id', tradeFrame({ a: 1.5 })],
    ['low above high', tickerFrame({ l: '70000', h: '60000' })],
  ])('rejects %s', (_label, raw) => {
    expect(parseStreamMessage(raw, 'BTCUSDT')).toBeNull();
  });
});
