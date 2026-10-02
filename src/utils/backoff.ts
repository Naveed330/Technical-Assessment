export interface BackoffOptions {
  baseMs: number;
  maxMs: number;
}

/** Exponential backoff with "equal jitter": a random delay in [exp/2, exp], capped at maxMs. */
export function getBackoffDelay(
  attempt: number,
  { baseMs, maxMs }: BackoffOptions,
  random: () => number = Math.random,
): number {
  const exponential = Math.min(maxMs, baseMs * 2 ** Math.max(0, attempt));
  const half = exponential / 2;
  return Math.round(half + random() * half);
}
