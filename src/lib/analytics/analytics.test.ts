import { describe, expect, it } from 'vitest'
import type { Bar } from '../data/types'
import {
  annualizedVolatility,
  averageTurnover,
  correlation,
  logReturns,
  maxDrawdown,
  monthsBefore,
  movingAverage,
  normalizeToHundred,
  periodReturn,
  sliceByPeriod,
  summarize,
  TRADING_DAYS_PER_YEAR,
} from './index'

function bar(date: string, close: number | null, turnover: number | null = 1000): Bar {
  return {
    date,
    open: close,
    high: close,
    low: close,
    close,
    volume: close === null ? null : 10,
    turnover,
  }
}

describe('periodReturn', () => {
  it('uses the first and last traded closes', () => {
    expect(
      periodReturn([bar('2026-01-05', 100), bar('2026-01-06', null), bar('2026-01-07', 125)]),
    ).toBeCloseTo(0.25)
  })
  it('needs at least two closes', () => {
    expect(periodReturn([])).toBeNull()
    expect(periodReturn([bar('2026-01-05', 100)])).toBeNull()
    expect(periodReturn([bar('2026-01-05', null), bar('2026-01-06', null)])).toBeNull()
  })
})

describe('logReturns and volatility', () => {
  it('skips days without trades', () => {
    const r = logReturns([bar('d1', 100), bar('d2', null), bar('d3', 110)])
    expect([...r.keys()]).toEqual(['d3'])
    expect(r.get('d3')).toBeCloseTo(Math.log(1.1))
  })

  it('annualizes the sample standard deviation with √245', () => {
    const closesSeq = [100, 102, 101, 104, 103, 107]
    const bars = closesSeq.map((c, i) => bar(`2026-01-${String(i + 5).padStart(2, '0')}`, c))
    const rets = closesSeq.slice(1).map((c, i) => Math.log(c / (closesSeq[i] ?? 1)))
    const mean = rets.reduce((s, v) => s + v, 0) / rets.length
    const sd = Math.sqrt(rets.reduce((s, v) => s + (v - mean) ** 2, 0) / (rets.length - 1))
    expect(annualizedVolatility(bars)).toBeCloseTo(sd * Math.sqrt(TRADING_DAYS_PER_YEAR), 12)
  })

  it('returns null with fewer than two returns', () => {
    expect(annualizedVolatility([bar('a', 100), bar('b', 101)])).toBeNull()
  })

  it('is zero for a flat series', () => {
    expect(annualizedVolatility([bar('a', 100), bar('b', 100), bar('c', 100)])).toBe(0)
  })
})

describe('maxDrawdown', () => {
  it('finds the deepest fall from a running peak', () => {
    const dd = maxDrawdown([
      bar('d1', 100),
      bar('d2', 120),
      bar('d3', 90),
      bar('d4', 130),
      bar('d5', 117),
    ])
    expect(dd?.value).toBeCloseTo(-0.25)
    expect(dd).toMatchObject({ peakDate: 'd2', troughDate: 'd3' })
  })
  it('is zero when prices only rise', () => {
    expect(maxDrawdown([bar('d1', 1), bar('d2', 2)])?.value).toBe(0)
  })
  it('is null without data', () => {
    expect(maxDrawdown([])).toBeNull()
  })
})

describe('movingAverage', () => {
  it('averages the last n traded closes and stays aligned with bars', () => {
    const ma = movingAverage(
      [bar('a', 1), bar('b', 2), bar('c', null), bar('d', 3), bar('e', 4)],
      2,
    )
    expect(ma).toEqual([null, 1.5, null, 2.5, 3.5])
  })
})

describe('averageTurnover', () => {
  it('ignores days without turnover', () => {
    expect(averageTurnover([bar('a', 1, 100), bar('b', null, null), bar('c', 1, 300)])).toBe(200)
    expect(averageTurnover([bar('a', null, null)])).toBeNull()
  })
})

describe('normalizeToHundred', () => {
  it('indexes the first traded close to 100', () => {
    expect(normalizeToHundred([bar('a', null), bar('b', 50), bar('c', 75)])).toEqual([
      { date: 'b', value: 100 },
      { date: 'c', value: 150 },
    ])
  })
})

describe('correlation', () => {
  const series = (values: number[]) => new Map(values.map((v, i) => [`d${i}`, v]))
  it('is 1 for identical and -1 for mirrored series', () => {
    const x = Array.from({ length: 30 }, (_, i) => Math.sin(i))
    expect(correlation(series(x), series(x))?.value).toBeCloseTo(1)
    expect(correlation(series(x), series(x.map((v) => -v)))?.value).toBeCloseTo(-1)
  })
  it('uses only common dates and requires enough of them', () => {
    const a = series(Array.from({ length: 25 }, (_, i) => i % 3))
    const b = new Map([...a].slice(0, 10))
    expect(correlation(a, b)).toBeNull()
    expect(correlation(a, b, 5)?.days).toBe(10)
  })
  it('is null when a series does not move', () => {
    expect(
      correlation(series(Array(30).fill(0.01)), series(Array.from({ length: 30 }, (_, i) => i))),
    ).toBeNull()
  })
})

describe('periods', () => {
  it('computes month offsets and clamps month ends', () => {
    expect(monthsBefore('2026-07-24', 3)).toBe('2026-04-24')
    expect(monthsBefore('2026-05-31', 3)).toBe('2026-02-28')
    expect(monthsBefore('2026-01-15', 12)).toBe('2025-01-15')
    expect(monthsBefore('2024-03-31', 1)).toBe('2024-02-29')
  })

  it('slices from the latest bar backwards', () => {
    const bars = ['2026-01-10', '2026-04-24', '2026-04-25', '2026-07-24'].map((d) => bar(d, 1))
    expect(sliceByPeriod(bars, '3m').map((b) => b.date)).toEqual(['2026-04-25', '2026-07-24'])
    expect(sliceByPeriod(bars, 'all')).toHaveLength(4)
    expect(sliceByPeriod([], '1y')).toEqual([])
  })
})

describe('summarize', () => {
  it('collects all headline numbers', () => {
    const s = summarize([bar('a', 100, 10), bar('b', 110, 30), bar('c', 99, 20)])
    expect(s.periodReturn).toBeCloseTo(-0.01)
    expect(s.maxDrawdown?.value).toBeCloseTo(-0.1)
    expect(s.averageTurnover).toBe(20)
    expect(s.first).toEqual({ date: 'a', close: 100 })
    expect(s.last).toEqual({ date: 'c', close: 99 })
    expect(s.tradingDays).toBe(3)
  })
})
