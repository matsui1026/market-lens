import { describe, expect, it } from 'vitest'
import type { Listing } from './data/types'
import {
  fiscalYearLabel,
  formatAxisYen,
  formatDate,
  formatPercent,
  formatPrice,
  formatVolume,
  formatYenLarge,
} from './format'
import { findByCode, normalizeQuery, searchListings } from './search'

describe('format', () => {
  it('formats percentages with an optional sign and no negative zero', () => {
    expect(formatPercent(0.1234, { signed: true })).toBe('+12.3%')
    expect(formatPercent(-0.05, { signed: true })).toBe('-5.0%')
    expect(formatPercent(-0.00001, { signed: true })).toBe('0.0%')
    expect(formatPercent(0.25)).toBe('25.0%')
    expect(formatPercent(null)).toBe('—')
    expect(formatPercent(Number.NaN)).toBe('—')
  })

  it('formats prices, large yen amounts and volumes', () => {
    expect(formatPrice(2480)).toBe('2,480円')
    expect(formatPrice(1234.5)).toBe('1,234.5円')
    expect(formatYenLarge(2.1e12)).toBe('2.10兆円')
    expect(formatYenLarge(4.1e11)).toBe('4,100億円')
    expect(formatYenLarge(3.25e8)).toBe('3.3億円')
    expect(formatYenLarge(-5e9)).toBe('-50.0億円')
    expect(formatYenLarge(7.5e7)).toBe('75百万円')
    expect(formatYenLarge(null)).toBe('—')
    expect(formatVolume(1_800_000)).toBe('180万株')
    expect(formatVolume(250_000_000)).toBe('2.50億株')
  })

  it('formats dates, fiscal years and axis labels', () => {
    expect(formatDate('2026-07-24')).toBe('2026/07/24')
    expect(formatDate('2026-07-24T15:00:00')).toBe('2026/07/24')
    expect(formatDate('')).toBe('—')
    expect(fiscalYearLabel('2026-03-31')).toBe('2026年3月期')
    expect(formatAxisYen(1.2e12)).toBe('1.2兆')
    expect(formatAxisYen(-3.4e11)).toBe('-3,400億')
    expect(formatAxisYen(5e7)).toBe('5,000万')
  })
})

const listings: Listing[] = [
  {
    code: '7203',
    name: 'トヨタ自動車',
    nameEn: 'TOYOTA MOTOR CORPORATION',
    sector17: '',
    sector33: '',
    market: '',
    scale: '',
  },
  {
    code: '7201',
    name: '日産自動車',
    nameEn: 'NISSAN MOTOR CO.,LTD.',
    sector17: '',
    sector33: '',
    market: '',
    scale: '',
  },
  {
    code: '130A',
    name: 'ベリサーブ',
    nameEn: 'Veriserve',
    sector17: '',
    sector33: '',
    market: '',
    scale: '',
  },
  {
    code: '8697',
    name: '日本取引所グループ',
    nameEn: 'Japan Exchange Group,Inc.',
    sector17: '',
    sector33: '',
    market: '',
    scale: '',
  },
]

describe('search', () => {
  it('normalizes width, case, kana and spaces', () => {
    expect(normalizeQuery('７２０３')).toBe('7203')
    expect(normalizeQuery('ﾄﾖﾀ')).toBe('とよた')
    expect(normalizeQuery(' Japan  Exchange ')).toBe('japanexchange')
  })

  it('ranks exact code, code prefix, name prefix, then contains', () => {
    expect(searchListings(listings, '7203').map((l) => l.code)).toEqual(['7203'])
    expect(searchListings(listings, '720').map((l) => l.code)).toEqual(['7201', '7203'])
    expect(searchListings(listings, 'とよた').map((l) => l.code)).toEqual(['7203'])
    expect(searchListings(listings, '自動車').map((l) => l.code)).toEqual(['7201', '7203'])
    expect(searchListings(listings, 'exchange').map((l) => l.code)).toEqual(['8697'])
    expect(searchListings(listings, '130a').map((l) => l.code)).toEqual(['130A'])
    expect(searchListings(listings, '   ')).toEqual([])
    expect(searchListings(listings, 'zzz')).toEqual([])
  })

  it('finds by 4- or 5-character code', () => {
    expect(findByCode(listings, '72030')?.name).toBe('トヨタ自動車')
    expect(findByCode(listings, '７２０３')?.name).toBe('トヨタ自動車')
    expect(findByCode(listings, '130a')?.name).toBe('ベリサーブ')
    expect(findByCode(listings, '9999')).toBeUndefined()
  })
})
