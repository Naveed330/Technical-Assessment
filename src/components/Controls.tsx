import { memo, useCallback, type ChangeEvent, type Dispatch, type SetStateAction } from 'react';
import { BUFFER_SIZE_OPTIONS, FLUSH_INTERVAL_OPTIONS, TIME_WINDOWS } from '../config';
import { useLiveSelector, useLiveStoreApi } from '../hooks/useLiveSelector';
import type { Filters, SideFilter } from '../types/filters';
import { SegmentedControl, type SegmentedOption } from './SegmentedControl';

const WINDOW_OPTIONS: readonly SegmentedOption<number>[] = TIME_WINDOWS.map((w) => ({
  label: w.label,
  value: w.seconds,
}));

const SIDE_OPTIONS: readonly SegmentedOption<SideFilter>[] = [
  { label: 'All', value: 'all' },
  { label: 'Buys', value: 'buy' },
  { label: 'Sells', value: 'sell' },
];

function withCurrent(options: readonly number[], current: number): readonly number[] {
  return options.includes(current) ? options : [...options, current].sort((a, b) => a - b);
}

interface ControlsProps {
  filters: Filters;
  onFiltersChange: Dispatch<SetStateAction<Filters>>;
}

export const Controls = memo(function Controls({ filters, onFiltersChange }: ControlsProps) {
  const store = useLiveStoreApi();
  const paused = useLiveSelector((s) => s.paused);
  const settings = useLiveSelector((s) => s.settings);

  const togglePause = useCallback(() => store.setPaused(!paused), [store, paused]);
  const setWindow = useCallback(
    (windowSec: number) => onFiltersChange((prev) => ({ ...prev, windowSec })),
    [onFiltersChange],
  );
  const setSide = useCallback(
    (side: SideFilter) => onFiltersChange((prev) => ({ ...prev, side })),
    [onFiltersChange],
  );
  const changeFlushInterval = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => store.setFlushInterval(Number(event.target.value)),
    [store],
  );
  const changeBufferSize = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => store.setBufferSize(Number(event.target.value)),
    [store],
  );

  return (
    <section id="controls" className="controls" aria-label="Dashboard controls">
      <button
        type="button"
        className={`btn ${paused ? 'btn--primary' : 'btn--outline'}`}
        onClick={togglePause}
        aria-pressed={paused}
      >
        {paused ? 'Resume feed' : 'Pause feed'}
      </button>

      <SegmentedControl label="Time window" options={WINDOW_OPTIONS} value={filters.windowSec} onChange={setWindow} />
      <SegmentedControl label="Trade side" options={SIDE_OPTIONS} value={filters.side} onChange={setSide} />

      <label className="field">
        <span className="field__label">UI refresh</span>
        <select className="select" value={settings.flushIntervalMs} onChange={changeFlushInterval}>
          {withCurrent(FLUSH_INTERVAL_OPTIONS, settings.flushIntervalMs).map((ms) => (
            <option key={ms} value={ms}>
              {ms} ms
            </option>
          ))}
        </select>
      </label>

      <label className="field">
        <span className="field__label">Trade buffer</span>
        <select className="select" value={settings.bufferSize} onChange={changeBufferSize}>
          {withCurrent(BUFFER_SIZE_OPTIONS, settings.bufferSize).map((size) => (
            <option key={size} value={size}>
              {size} trades
            </option>
          ))}
        </select>
      </label>
    </section>
  );
});
