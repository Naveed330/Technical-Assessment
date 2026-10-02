import { memo, useEffect, useMemo, useRef } from 'react';
import {
  Chart,
  Filler,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Tooltip,
  type ScriptableContext,
} from 'chart.js';
import { TIME_WINDOWS } from '../config';
import { useLiveSelector } from '../hooks/useLiveSelector';
import type { SecondBucket } from '../types/event';
import { selectWindowBuckets } from '../utils/aggregate';
import { formatPrice, formatTime } from '../utils/helpers';
import { Loading } from './Loading';

Chart.register(LineController, LineElement, PointElement, LinearScale, Filler, Tooltip);

interface ChartPoint {
  /** Epoch ms. */
  x: number;
  y: number;
}

const LINE_COLOR = '#d08a17';
const AXIS_COLOR = '#565d69';
const GRID_COLOR = 'rgba(16, 20, 28, 0.06)';
const AXIS_FONT = { family: 'ui-monospace, "Cascadia Mono", Consolas, monospace', size: 11 };

const toChartPoints = (buckets: readonly SecondBucket[]): ChartPoint[] =>
  buckets.map((b) => ({ x: b.time * 1000, y: b.close }));

function areaFill({ chart }: ScriptableContext<'line'>): CanvasGradient | string {
  const area = chart.chartArea;
  if (!area) return 'transparent';
  const gradient = chart.ctx.createLinearGradient(0, area.top, 0, area.bottom);
  gradient.addColorStop(0, 'rgba(208, 138, 23, 0.2)');
  gradient.addColorStop(1, 'rgba(208, 138, 23, 0)');
  return gradient;
}

interface LiveChartProps {
  windowSec: number;
}

export const LiveChart = memo(function LiveChart({ windowSec }: LiveChartProps) {
  const buckets = useLiveSelector((s) => s.buckets);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart<'line', ChartPoint[]> | null>(null);

  const points = useMemo(() => toChartPoints(selectWindowBuckets(buckets, windowSec)), [buckets, windowSec]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const chart = new Chart<'line', ChartPoint[]>(canvas, {
      type: 'line',
      data: {
        datasets: [
          {
            data: [],
            borderColor: LINE_COLOR,
            borderWidth: 2,
            backgroundColor: areaFill,
            fill: 'start',
            tension: 0.15,
            pointRadius: 0,
            pointHoverRadius: 3,
            pointHoverBackgroundColor: LINE_COLOR,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        parsing: false,
        normalized: true,
        interaction: { mode: 'index', intersect: false },
        scales: {
          x: {
            type: 'linear',
            bounds: 'data',
            grid: { display: false },
            border: { display: false },
            ticks: {
              color: AXIS_COLOR,
              font: AXIS_FONT,
              maxRotation: 0,
              maxTicksLimit: 6,
              callback: (value) => formatTime(Number(value)),
            },
          },
          y: {
            position: 'right',
            grace: '5%',
            grid: { color: GRID_COLOR },
            border: { display: false },
            ticks: {
              color: AXIS_COLOR,
              font: AXIS_FONT,
              maxTicksLimit: 7,
              callback: (value) => formatPrice(Number(value)),
            },
          },
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            displayColors: false,
            backgroundColor: '#101113',
            titleFont: AXIS_FONT,
            bodyFont: { ...AXIS_FONT, size: 12, weight: 'bold' },
            padding: 8,
            callbacks: {
              title: (items) => {
                const x = items[0]?.parsed.x;
                return x == null ? '' : formatTime(x);
              },
              label: (item) => (item.parsed.y == null ? '' : formatPrice(item.parsed.y)),
            },
          },
        },
      },
    });

    chartRef.current = chart;
    return () => {
      chart.destroy();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    chart.data.datasets[0].data = points;
    chart.update('none');
  }, [points]);

  const windowLabel = TIME_WINDOWS.find((w) => w.seconds === windowSec)?.label ?? `${windowSec}s`;
  const latest = points.length > 0 ? points[points.length - 1].y : null;

  return (
    <section id="chart" className="panel chart" aria-labelledby="chart-title">
      <header className="panel__header">
        <h2 id="chart-title" className="panel__title">
          Price - last {windowLabel}
        </h2>
        <span className="panel__meta num">{latest === null ? '—' : formatPrice(latest)}</span>
      </header>
      <div className="chart__canvas">
        <div className="chart__surface">
          <canvas ref={canvasRef} role="img" aria-label={`${windowLabel} price chart`} />
        </div>
        {points.length === 0 && (
          <div className="chart__overlay">
            <Loading label="Waiting for price data…" />
          </div>
        )}
      </div>
    </section>
  );
});
