import type { Bar } from '../data/types'

/** Trading days per year used to annualize (close to the TSE calendar). */
export const TRADING_DAYS_PER_YEAR = 245
/** Moving-average windows shown on the price chart (common in Japan). */
export const MA_WINDOWS = [25, 75] as const
/** Minimum overlapping return days before a correlation is shown. */
export const MIN_CORRELATION_DAYS = 20

export type PeriodId = '3m' | '6m' | '1y' | '2y' | 'all'

export const PERIODS: ReadonlyArray<{ id: PeriodId; label: string; months: number | null }> = [
  { id: '3m', label: '3か月', months: 3 },
  { id: '6m', label: '6か月', months: 6 },
  { id: '1y', label: '1年', months: 12 },
  { id: '2y', label: '2年', months: 24 },
  { id: 'all', label: '全期間', months: null },
]

export function isPeriodId(value: string | null): value is PeriodId {
  return PERIODS.some((p) => p.id === value)
}

/** Calendar date `months` before `isoDate` (clamped to the end of shorter months). */
export function monthsBefore(isoDate: string, months: number): string {
  const [y, m, d] = isoDate.split('-').map(Number) as [number, number, number]
  const target = new Date(Date.UTC(y, m - 1 - months, 1))
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate()
  target.setUTCDate(Math.min(d, lastDay))
  return target.toISOString().slice(0, 10)
}

/** First date (inclusive) of a period that ends at `lastDate`, or null for all data. */
export function periodStart(lastDate: string, period: PeriodId): string | null {
  const months = PERIODS.find((p) => p.id === period)?.months ?? null
  return months === null ? null : monthsBefore(lastDate, months)
}

/** Bars within the period, measured back from the latest bar. */
export function sliceByPeriod(bars: Bar[], period: PeriodId, lastDate?: string): Bar[] {
  const end = lastDate ?? bars.at(-1)?.date
  if (end === undefined) return []
  const start = periodStart(end, period)
  return bars.filter((b) => b.date <= end && (start === null || b.date > start))
}

export type ClosePoint = { date: string; close: number }

export function closes(bars: Bar[]): ClosePoint[] {
  const out: ClosePoint[] = []
  for (const b of bars)
    if (b.close !== null && b.close > 0) out.push({ date: b.date, close: b.close })
  return out
}

/** Last close ÷ first close − 1. */
export function periodReturn(bars: Bar[]): number | null {
  const points = closes(bars)
  const first = points[0]
  const last = points.at(-1)
  if (first === undefined || last === undefined || points.length < 2) return null
  return last.close / first.close - 1
}

/** ln(close_t / close_{t-1}) between consecutive traded days, keyed by the later date. */
export function logReturns(bars: Bar[]): Map<string, number> {
  const points = closes(bars)
  const out = new Map<string, number>()
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1]
    const cur = points[i]
    if (prev !== undefined && cur !== undefined) out.set(cur.date, Math.log(cur.close / prev.close))
  }
  return out
}

function sampleStdDev(values: number[]): number | null {
  if (values.length < 2) return null
  const mean = values.reduce((s, v) => s + v, 0) / values.length
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / (values.length - 1)
  return Math.sqrt(variance)
}

/** Sample standard deviation of daily log returns × √245. */
export function annualizedVolatility(bars: Bar[]): number | null {
  const sd = sampleStdDev([...logReturns(bars).values()])
  return sd === null ? null : sd * Math.sqrt(TRADING_DAYS_PER_YEAR)
}

export type Drawdown = { value: number; peakDate: string; troughDate: string }

/** Largest fall from a running peak, as a negative fraction (0 when prices never fell). */
export function maxDrawdown(bars: Bar[]): Drawdown | null {
  const points = closes(bars)
  const first = points[0]
  if (first === undefined) return null
  let peak = first
  let worst: Drawdown = { value: 0, peakDate: first.date, troughDate: first.date }
  for (const p of points) {
    if (p.close > peak.close) peak = p
    const dd = p.close / peak.close - 1
    if (dd < worst.value) worst = { value: dd, peakDate: peak.date, troughDate: p.date }
  }
  return worst
}

export function averageTurnover(bars: Bar[]): number | null {
  const values = bars.map((b) => b.turnover).filter((v): v is number => v !== null)
  if (values.length === 0) return null
  return values.reduce((s, v) => s + v, 0) / values.length
}

/**
 * Simple moving average of the last `window` traded closes, aligned with `bars`.
 * Null until enough history exists and on days without trades.
 */
export function movingAverage(bars: Bar[], window: number): Array<number | null> {
  const recent: number[] = []
  let sum = 0
  return bars.map((b) => {
    if (b.close === null) return null
    recent.push(b.close)
    sum += b.close
    if (recent.length > window) sum -= recent.shift() ?? 0
    return recent.length === window ? sum / window : null
  })
}

/** Index of closes where the first traded close in the period is 100. */
export function normalizeToHundred(bars: Bar[]): Array<{ date: string; value: number }> {
  const points = closes(bars)
  const base = points[0]
  if (base === undefined) return []
  return points.map((p) => ({ date: p.date, value: (p.close / base.close) * 100 }))
}

/** Pearson correlation of two return series over their common dates. */
export function correlation(
  a: Map<string, number>,
  b: Map<string, number>,
  minDays = MIN_CORRELATION_DAYS,
): { value: number; days: number } | null {
  const xs: number[] = []
  const ys: number[] = []
  for (const [date, x] of a) {
    const y = b.get(date)
    if (y !== undefined) {
      xs.push(x)
      ys.push(y)
    }
  }
  const n = xs.length
  if (n < minDays) return null
  const mx = xs.reduce((s, v) => s + v, 0) / n
  const my = ys.reduce((s, v) => s + v, 0) / n
  let sxy = 0
  let sxx = 0
  let syy = 0
  for (let i = 0; i < n; i++) {
    const dx = (xs[i] ?? 0) - mx
    const dy = (ys[i] ?? 0) - my
    sxy += dx * dy
    sxx += dx * dx
    syy += dy * dy
  }
  // A series that does not move has no defined correlation (allow for float noise).
  if (Math.sqrt(sxx / n) < 1e-12 || Math.sqrt(syy / n) < 1e-12) return null
  return { value: Math.max(-1, Math.min(1, sxy / Math.sqrt(sxx * syy))), days: n }
}

export type Summary = {
  periodReturn: number | null
  volatility: number | null
  maxDrawdown: Drawdown | null
  averageTurnover: number | null
  first: ClosePoint | null
  last: ClosePoint | null
  tradingDays: number
}

export function summarize(bars: Bar[]): Summary {
  const points = closes(bars)
  return {
    periodReturn: periodReturn(bars),
    volatility: annualizedVolatility(bars),
    maxDrawdown: maxDrawdown(bars),
    averageTurnover: averageTurnover(bars),
    first: points[0] ?? null,
    last: points.at(-1) ?? null,
    tradingDays: points.length,
  }
}
