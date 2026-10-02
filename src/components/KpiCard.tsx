import { memo } from 'react';
import type { Tone } from '../utils/helpers';

interface KpiCardProps {
  label: string;
  value: string;
  detail?: string;
  tone?: Tone;
}

export const KpiCard = memo(function KpiCard({ label, value, detail, tone = 'neutral' }: KpiCardProps) {
  return (
    <article className={`kpi-card kpi-card--${tone}`}>
      <h3 className="kpi-card__label">{label}</h3>
      <p className={`kpi-card__value kpi-card__value--${tone}`}>{value}</p>
      {detail && <p className="kpi-card__detail">{detail}</p>}
    </article>
  );
});
