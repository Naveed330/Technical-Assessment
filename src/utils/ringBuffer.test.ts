import { describe, expect, it } from 'vitest';
import { getBackoffDelay } from './backoff';
import { RingBuffer } from './ringBuffer';

describe('RingBuffer', () => {
  it('keeps only the newest `capacity` items in order', () => {
    const buffer = new RingBuffer<number>(3);
    [1, 2, 3, 4, 5].forEach((n) => buffer.push(n));
    expect(buffer.size).toBe(3);
    expect(buffer.toArray()).toEqual([3, 4, 5]);
    expect(buffer.newestFirst()).toEqual([5, 4, 3]);
    expect(buffer.last()).toBe(5);
  });

  it('replaces the newest item in place', () => {
    const buffer = new RingBuffer<number>(2);
    buffer.replaceLast(1);
    buffer.push(2);
    buffer.replaceLast(9);
    expect(buffer.toArray()).toEqual([1, 9]);
  });

  it('rejects invalid capacities', () => {
    expect(() => new RingBuffer(0)).toThrow(RangeError);
    expect(() => new RingBuffer(1.5)).toThrow(RangeError);
  });
});

describe('getBackoffDelay', () => {
  const options = { baseMs: 1_000, maxMs: 30_000 };

  it('grows exponentially within the jitter range', () => {
    expect(getBackoffDelay(0, options, () => 0)).toBe(500);
    expect(getBackoffDelay(0, options, () => 1)).toBe(1_000);
    expect(getBackoffDelay(3, options, () => 1)).toBe(8_000);
  });

  it('never exceeds the cap', () => {
    expect(getBackoffDelay(20, options, () => 1)).toBe(30_000);
  });
});
