import { describe, expect, it } from 'vitest'
import { DEMO_END_DATE, demoListings, demoSource } from './demoSource'
import { errorCopy } from './errorMessages'
import {
  annualResults,
  displayCode,
  mapBars,
  mapFinancials,
  mapListings,
  num,
} from './jquantsMapping'
import { AppError } from './types'

describe('num', () => {
  it('parses numbers and numeric strings, rejecting blanks and junk', () => {
    expect(num(12.5)).toBe(12.5)
    expect(num('100529000000')).toBe(100529000000)
    expect(num('0.112')).toBe(0.112)
    expect(num('-3.5')).toBe(-3.5)
    for (const v of ['', '  ', null, undefined, 'abc', Number.NaN, Number.POSITIVE_INFINITY, {}]) {
      expect(num(v)).toBeNull()
    }
  })
})

describe('displayCode', () => {
  it('drops the trailing check digit of ordinary shares only', () => {
    expect(displayCode('72030')).toBe('7203')
    expect(displayCode('130A0')).toBe('130A')
    expect(displayCode('25935')).toBe('25935')
    expect(displayCode('7203')).toBe('7203')
  })
})

describe('mapListings', () => {
  it('maps J-Quants V2 master rows and skips incomplete ones', () => {
    const rows = [
      {
        Date: '2026-07-28',
        Code: '86970',
        CoName: '日本取引所グループ',
        CoNameEn: 'Japan Exchange Group,Inc.',
        S17Nm: '金融（除く銀行）',
        S33Nm: 'その他金融業',
        ScaleCat: 'TOPIX Large70',
        MktNm: 'プライム',
      },
      { Code: '13010', CoName: '' },
      'garbage',
      null,
    ]
    expect(mapListings(rows)).toEqual([
      {
        code: '8697',
        name: '日本取引所グループ',
        nameEn: 'Japan Exchange Group,Inc.',
        sector17: '金融（除く銀行）',
        sector33: 'その他金融業',
        market: 'プライム',
        scale: 'TOPIX Large70',
      },
    ])
  })
})

describe('mapBars', () => {
  it('uses adjusted prices, keeps null days, sorts and de-duplicates', () => {
    const bars = mapBars([
      {
        Date: '2026-01-06',
        AdjO: 2,
        AdjH: 3,
        AdjL: 1,
        AdjC: 2.5,
        AdjVo: 100,
        Va: 250,
        O: 999,
        C: 999,
      },
      { Date: '2026-01-05', AdjO: null, AdjH: null, AdjL: null, AdjC: null, AdjVo: null, Va: null },
      { Date: 'bad', AdjC: 1 },
      { Date: '2026-01-06', AdjO: 2, AdjH: 3, AdjL: 1, AdjC: 2.6, AdjVo: 100, Va: 260 },
    ])
    expect(bars.map((b) => [b.date, b.close])).toEqual([
      ['2026-01-05', null],
      ['2026-01-06', 2.6],
    ])
    expect(bars[1]).toEqual({
      date: '2026-01-06',
      open: 2,
      high: 3,
      low: 1,
      close: 2.6,
      volume: 100,
      turnover: 260,
    })
  })
})

describe('mapFinancials and annualResults', () => {
  const base = {
    Code: '86970',
    CurFYSt: '2025-04-01',
    CurFYEn: '2026-03-31',
    Sales: '100',
    OP: '10',
    NP: '7',
    EPS: '66.76',
    ROE: '0.112',
    EqAR: '0.004',
    TA: '',
    Eq: '',
  }
  it('parses string numbers and blank values', () => {
    const [s] = mapFinancials([
      {
        ...base,
        DiscDate: '2026-04-28',
        DiscTime: '15:00:00',
        DocType: 'FYFinancialStatements_Consolidated_IFRS',
        CurPerType: 'FY',
      },
    ])
    expect(s).toMatchObject({
      disclosedAt: '2026-04-28T15:00:00',
      sales: 100,
      roe: 0.112,
      equityRatio: 0.004,
      totalAssets: null,
    })
  })

  it('keeps one full-year report per fiscal year, preferring the latest disclosure', () => {
    const statements = mapFinancials([
      {
        ...base,
        DiscDate: '2026-04-28',
        DiscTime: '15:00:00',
        DocType: 'FYFinancialStatements_Consolidated_IFRS',
        CurPerType: 'FY',
        Sales: '100',
      },
      {
        ...base,
        DiscDate: '2026-05-10',
        DiscTime: '12:00:00',
        DocType: 'FYFinancialStatements_Consolidated_IFRS',
        CurPerType: 'FY',
        Sales: '101',
      },
      {
        ...base,
        DiscDate: '2026-01-30',
        DiscTime: '12:00:00',
        DocType: '3QFinancialStatements_Consolidated_IFRS',
        CurPerType: '3Q',
        Sales: '75',
      },
      {
        ...base,
        DiscDate: '2026-02-10',
        DiscTime: '12:00:00',
        DocType: 'EarnForecastRevision',
        CurPerType: 'FY',
        Sales: '120',
      },
      {
        ...base,
        CurFYSt: '2024-04-01',
        CurFYEn: '2025-03-31',
        DiscDate: '2025-04-28',
        DiscTime: '15:00:00',
        DocType: 'FYFinancialStatements_Consolidated_IFRS',
        CurPerType: 'FY',
        Sales: '90',
      },
    ])
    const annual = annualResults(statements)
    expect(annual.map((s) => [s.fiscalYearEnd, s.sales])).toEqual([
      ['2025-03-31', 90],
      ['2026-03-31', 101],
    ])
  })
})

describe('demo source', () => {
  it('is deterministic and ends on the fixed demo date', async () => {
    const a = await demoSource.bars('DM01')
    const b = await demoSource.bars('dm01')
    expect(a.data).toBe(b.data)
    expect(a.data.at(-1)?.date).toBe(DEMO_END_DATE)
    expect(a.origin).toBe('demo')
    expect(a.data.length).toBeGreaterThan(450)
  })

  it('produces valid OHLC values', async () => {
    for (const listing of demoListings) {
      const { data } = await demoSource.bars(listing.code)
      for (const bar of data) {
        if (bar.close === null) continue
        expect(bar.high).toBeGreaterThanOrEqual(Math.max(bar.open ?? 0, bar.close))
        expect(bar.low).toBeLessThanOrEqual(Math.min(bar.open ?? Infinity, bar.close))
        expect(bar.low).toBeGreaterThan(0)
      }
    }
  })

  it('includes a trading halt, a late listing and a loss year to exercise edge cases', async () => {
    const dm07 = (await demoSource.bars('DM07')).data
    expect(dm07.filter((b) => b.close === null).map((b) => b.date)).toEqual([
      '2025-09-11',
      '2025-09-12',
    ])
    const dm10 = (await demoSource.bars('DM10')).data
    expect(dm10[0]?.date).toBe('2025-03-17')
    const dm06 = (await demoSource.financials('DM06')).data
    expect(dm06.some((s) => (s.netProfit ?? 0) < 0)).toBe(true)
  })

  it('returns no data for unknown codes', async () => {
    expect((await demoSource.bars('9999')).data).toEqual([])
    expect((await demoSource.financials('9999')).data).toEqual([])
  })

  it('generates annual reports that pass the same filter as J-Quants data', async () => {
    const statements = (await demoSource.financials('DM02')).data
    expect(statements).toHaveLength(5)
    expect(annualResults(statements)).toHaveLength(statements.length)
  })
})

describe('errorCopy', () => {
  it('has a Japanese message for every error kind and falls back for unknown errors', () => {
    expect(errorCopy(new AppError('rate_limited')).retryable).toBe(true)
    expect(errorCopy(new AppError('not_configured')).needsSetup).toBe(true)
    expect(errorCopy(new Error('x')).title).toBe('エラーが発生しました')
  })
})
