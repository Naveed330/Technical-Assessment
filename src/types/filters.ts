import type { TradeSide } from './event';

export type SideFilter = 'all' | TradeSide;

export interface Filters {
  windowSec: number;
  side: SideFilter;
}
