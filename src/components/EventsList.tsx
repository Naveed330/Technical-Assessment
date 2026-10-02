import { memo, useMemo } from 'react';
import { FixedSizeList, areEqual, type ListChildComponentProps } from 'react-window';
import { useLiveSelector } from '../hooks/useLiveSelector';
import type { Trade } from '../types/event';
import type { SideFilter } from '../types/filters';
import { filterTrades } from '../utils/aggregate';
import { formatCompact, formatPrice, formatQuantity, formatTimeMs } from '../utils/helpers';
import { Loading } from './Loading';

const ROW_HEIGHT = 36;
const LIST_HEIGHT = 396;

type TradeList = readonly Trade[];

const itemKey = (index: number, data: TradeList) => data[index].id;

const TradeRow = memo(function TradeRow({ index, style, data }: ListChildComponentProps<TradeList>) {
  const trade = data[index];
  return (
    <div className={`trade-row trade-row--${trade.side}`} style={style}>
      <span className="trade-row__time">{formatTimeMs(trade.time)}</span>
      <span className={`badge badge--${trade.side}`}>{trade.side === 'buy' ? 'Buy' : 'Sell'}</span>
      <span className="num trade-row__price">{formatPrice(trade.price)}</span>
      <span className="num">{formatQuantity(trade.quantity)}</span>
      <span className="num trade-row__value">{formatCompact(trade.price * trade.quantity)}</span>
    </div>
  );
}, areEqual);

interface EventsListProps {
  side: SideFilter;
  windowSec: number;
}

export const EventsList = memo(function EventsList({ side, windowSec }: EventsListProps) {
  const trades = useLiveSelector((s) => s.trades);
  const bufferSize = useLiveSelector((s) => s.settings.bufferSize);
  const visible = useMemo(() => filterTrades(trades, side, windowSec), [trades, side, windowSec]);

  let body;
  if (trades.length === 0) {
    body = <Loading label="Waiting for trades…" />;
  } else if (visible.length === 0) {
    body = <p className="empty-state">No trades match the current filters.</p>;
  } else {
    body = (
      <FixedSizeList
        height={LIST_HEIGHT}
        width="100%"
        itemCount={visible.length}
        itemSize={ROW_HEIGHT}
        itemData={visible}
        itemKey={itemKey}
        overscanCount={6}
      >
        {TradeRow}
      </FixedSizeList>
    );
  }

  return (
    <section id="trades" className="panel events" aria-labelledby="events-title">
      <header className="panel__header">
        <h2 id="events-title" className="panel__title">
          Recent trades
        </h2>
        <span className="panel__meta">
          {visible.length} shown · buffer {bufferSize}
        </span>
      </header>
      <div className="trade-row trade-row--head" aria-hidden="true">
        <span>Time</span>
        <span>Side</span>
        <span className="num">Price</span>
        <span className="num">Amount</span>
        <span className="num trade-row__value">Value</span>
      </div>
      <div className="events__body">{body}</div>
    </section>
  );
});
