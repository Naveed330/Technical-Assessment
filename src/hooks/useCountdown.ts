import { useEffect, useState } from 'react';

/** Whole seconds remaining until `targetMs`; ticks only while a target is set. */
export function useCountdown(targetMs: number | null): number | null {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (targetMs === null) return undefined;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [targetMs]);

  if (targetMs === null) return null;
  return Math.max(0, Math.ceil((targetMs - now) / 1000));
}
