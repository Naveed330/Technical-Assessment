/** Fixed-capacity FIFO buffer: pushing past capacity overwrites the oldest item in O(1). */
export class RingBuffer<T> {
  readonly capacity: number;
  private readonly items: (T | undefined)[];
  private start = 0;
  private length = 0;

  constructor(capacity: number) {
    if (!Number.isInteger(capacity) || capacity < 1) {
      throw new RangeError('RingBuffer capacity must be a positive integer');
    }
    this.capacity = capacity;
    this.items = new Array<T | undefined>(capacity);
  }

  get size(): number {
    return this.length;
  }

  push(item: T): void {
    this.items[(this.start + this.length) % this.capacity] = item;
    if (this.length < this.capacity) {
      this.length += 1;
    } else {
      this.start = (this.start + 1) % this.capacity;
    }
  }

  last(): T | undefined {
    return this.length === 0 ? undefined : this.items[(this.start + this.length - 1) % this.capacity];
  }

  replaceLast(item: T): void {
    if (this.length === 0) {
      this.push(item);
      return;
    }
    this.items[(this.start + this.length - 1) % this.capacity] = item;
  }

  /** Oldest first. */
  toArray(): T[] {
    const result = new Array<T>(this.length);
    for (let i = 0; i < this.length; i += 1) {
      result[i] = this.items[(this.start + i) % this.capacity] as T;
    }
    return result;
  }

  newestFirst(): T[] {
    const result = new Array<T>(this.length);
    for (let i = 0; i < this.length; i += 1) {
      result[i] = this.items[(this.start + this.length - 1 - i) % this.capacity] as T;
    }
    return result;
  }

  clear(): void {
    this.items.fill(undefined);
    this.start = 0;
    this.length = 0;
  }
}
