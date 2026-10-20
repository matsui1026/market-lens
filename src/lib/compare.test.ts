import { describe, expect, it } from 'vitest'
import { compareStocks, parseCodes, reconcileSlots } from './compare'
import { demoSource } from './data/demoSource'
import type { Bar } from './data/types'

function bars(dates: string[], closes: Array<number | null>): Bar[] {
  return dates.map((date, i) => {
    const c = closes[i] ?? null
    return { date, open: c, high: c, low: c, close: c, volume: 1, turnover: 1 }
  })
}

describe('parseCodes', () => {
  it('keeps valid unique codes, normalizes width/case and caps at 4', () => {
    expect(parseCodes('7203,６７５８,7203,bad,dm01,130a,8697,9984')).toEqual([
      '7203',
      '6758',
      'DM01',
      '130A',
    ])
    expect(parseCodes(null)).toEqual([])
    expect(parseCodes('')).toEqual([])
  })
})

describe('reconcileSlots', () => {
  it('keeps colors with their stocks and reuses the lowest free slot', () => {
    const first = reconcileSlots([], ['A', 'B', 'C'])
    expect(first).toEqual([
      { code: 'A', slot: 0 },
      { code: 'B', slot: 1 },
      { code: 'C', slot: 2 },
    ])
    const removed = reconcileSlots(first, ['B', 'C'])
    expect(removed).toEqual([
      { code: 'B', slot: 1 },
      { code: 'C', slot: 2 },
    ])
    const added = reconcileSlots(removed, ['B', 'C', 'D'])
    expect(added.find((e) => e.code === 'D')?.slot).toBe(0)
  })
})

describe('compareStocks', () => {
  it('aligns all series to their common dates before indexing to 100', () => {
    const dates = ['2026-01-05', '2026-01-06', '2026-01-07', '2026-01-08']
    const result = compareStocks(
      [
        { code: 'A', bars: bars(dates, [100, 110, 121, 133.1]) },
        { code: 'B', bars: bars(dates.slice(1), [50, 55, 50]) },
      ],
      'all',
    )
    expect(result.start).toBe('2026-01-06')
    expect(result.end).toBe('2026-01-08')
    expect(result.series[0]?.values[0]).toEqual({ date: '2026-01-06', value: 100 })
    expect(result.series[0]?.values.at(-1)?.value).toBeCloseTo(121)
    expect(result.series[1]?.values.at(-1)?.value).toBeCloseTo(100)
  })

  it('returns no common range when a stock has no data', () => {
    const result = compareStocks(
      [
        { code: 'A', bars: bars(['2026-01-05', '2026-01-06'], [1, 2]) },
        { code: 'B', bars: [] },
      ],
      'all',
    )
    expect(result.start).toBeNull()
    expect(result.series.every((s) => s.values.length === 0)).toBe(true)
  })

  it('computes a symmetric correlation matrix with 1 on the diagonal for demo data', async () => {
    const codes = ['DM01', 'DM03', 'DM06']
    const inputs = await Promise.all(
      codes.map(async (code) => ({ code, bars: (await demoSource.bars(code)).data })),
    )
    const { correlations } = compareStocks(inputs, '1y')
    for (let i = 0; i < 3; i++) {
      expect(correlations[i]?.[i]?.value).toBe(1)
      for (let j = 0; j < 3; j++) {
        expect(correlations[i]?.[j]?.value).toBeCloseTo(
          correlations[j]?.[i]?.value ?? Number.NaN,
          12,
        )
      }
    }
    // DM01 and DM03 share a high market beta, DM06 a low one.
    expect(correlations[0]?.[1]?.value ?? 0).toBeGreaterThan(correlations[0]?.[2]?.value ?? 1)
  })
})
