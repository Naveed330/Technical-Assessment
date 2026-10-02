import { memo, useMemo } from 'react';
import { TIME_WINDOWS } from '../config';
import { useLiveSelector } from '../hooks/useLiveSelector';
import { summarizeWindow } from '../utils/aggregate';
import {
  formatCompact,
  formatInteger,
  formatPercent,
  formatPrice,
  formatQuantity,
  toneOf,
} from '../utils/helpers';
import { KpiCard } from './KpiCard';

const EMPTY = '—';

// Each group subscribes to its own slice, so e.g. a ticker update does not re-render the trade KPIs.
const TickerKpis = memo(function TickerKpis() {
  const ticker = useLiveSelector((s) => s.ticker);

  if (!ticker) {
    return (
      <>
        <KpiCard label="Last price" value={EMPTY} detail="Waiting for ticker…" />
        <KpiCard label="24h high" value={EMPTY} />
        <KpiCard label="24h volume" value={EMPTY} />
      </>
    );
  }

  return (
    <>
      <KpiCard
        label="Last price"
        value={formatPrice(ticker.lastPrice)}
        detail={`${formatPercent(ticker.priceChangePercent)} in 24h`}
        tone={toneOf(ticker.priceChangePercent)}
      />
      <KpiCard label="24h high" value={formatPrice(ticker.high)} detail={`Low ${formatPrice(ticker.low)}`} />
      <KpiCard
        label="24h volume"
        value={formatCompact(ticker.baseVolume)}
        detail={`${formatCompact(ticker.quoteVolume)} quote · ${formatCompact(ticker.tradeCount)} trades`}
      />
    </>
  );
});

const WindowKpis = memo(function WindowKpis({ windowSec }: { windowSec: number }) {
  const buckets = useLiveSelector((s) => s.buckets);
  const summary = useMemo(() => summarizeWindow(buckets, windowSec), [buckets, windowSec]);
  const windowLabel = TIME_WINDOWS.find((w) => w.seconds === windowSec)?.label ?? `${windowSec}s`;
  const totalVolume = summary.buyVolume + summary.sellVolume;
  const buyShare = totalVolume > 0 ? (summary.buyVolume / totalVolume) * 100 : null;

  return (
    <>
      <KpiCard
        label={`Trades (${windowLabel})`}
        value={formatInteger(summary.tradeCount)}
        detail={`${formatInteger(summary.buyCount)} buys · ${formatInteger(summary.sellCount)} sells`}
      />
      <KpiCard
        label={`Buy pressure (${windowLabel})`}
        value={buyShare === null ? EMPTY : `${buyShare.toFixed(1)}%`}
        detail={`Buy ${formatQuantity(summary.buyVolume)} · Sell ${formatQuantity(summary.sellVolume)}`}
        tone={buyShare === null ? 'neutral' : toneOf(buyShare - 50)}
      />
      <KpiCard
        label={`VWAP (${windowLabel})`}
        value={summary.vwap === null ? EMPTY : formatPrice(summary.vwap)}
        detail={summary.changePercent === null ? undefined : `${formatPercent(summary.changePercent)} in window`}
        tone={toneOf(summary.changePercent)}
      />
    </>
  );
});

const StreamKpis = memo(function StreamKpis() {
  const stats = useLiveSelector((s) => s.stats);

  return (
    <>
      <KpiCard
        label="Message rate"
        value={`${stats.messagesPerSecond.toFixed(1)}/s`}
        detail={`${formatCompact(stats.totalMessages)} received`}
      />
      <KpiCard
        label="Rejected messages"
        value={formatInteger(stats.malformed + stats.dropped)}
        detail={`${formatInteger(stats.malformed)} malformed · ${formatInteger(stats.dropped)} rate-limited`}
        tone={stats.malformed + stats.dropped > 0 ? 'down' : 'neutral'}
      />
    </>
  );
});

interface KpiCardsProps {
  windowSec: number;
}

export const KpiCards = memo(function KpiCards({ windowSec }: KpiCardsProps) {
  return (
    <section className="kpi-grid" aria-label="Key metrics">
      <TickerKpis />
      <WindowKpis windowSec={windowSec} />
      <StreamKpis />
    </section>
  );
});
