import type { Bar, DataSource, FinancialStatement, Listing } from './types'

/**
 * Synthetic data for the public demo. Every company, price and financial figure
 * here is generated from a fixed random seed and is fictional — nothing comes
 * from J-Quants or any real market.
 */

type DemoCompany = Listing & {
  seed: number
  startPrice: number
  /** Annual drift and volatility of the idiosyncratic part. */
  drift: number
  vol: number
  /** Sensitivity to the shared "market" factor (creates correlations). */
  beta: number
  baseVolume: number
  listedFrom: string
  /** Days with no trades (e.g. a trading halt) — returned as null bars. */
  haltDays?: string[]
  sales: number
  margin: number
  growth: number
  shares: number
  lossYear?: number
}

export const DEMO_END_DATE = '2026-07-24'
const DEMO_START_DATE = '2024-07-01'
export const DEMO_FETCHED_AT = '2026-07-24T18:00:00.000Z'

const COMPANIES: DemoCompany[] = [
  {
    code: 'DM01',
    name: 'デモ精機',
    nameEn: 'Demo Precision',
    sector17: '機械',
    sector33: '機械',
    market: 'プライム',
    scale: 'デモ（架空）',
    seed: 11,
    startPrice: 2480,
    drift: 0.06,
    vol: 0.22,
    beta: 1.1,
    baseVolume: 1_800_000,
    listedFrom: DEMO_START_DATE,
    sales: 820e9,
    margin: 0.09,
    growth: 0.04,
    shares: 410e6,
  },
  {
    code: 'DM02',
    name: 'デモ食品',
    nameEn: 'Demo Foods',
    sector17: '食品',
    sector33: '食料品',
    market: 'プライム',
    scale: 'デモ（架空）',
    seed: 22,
    startPrice: 3920,
    drift: 0.03,
    vol: 0.14,
    beta: 0.5,
    baseVolume: 650_000,
    listedFrom: DEMO_START_DATE,
    sales: 410e9,
    margin: 0.07,
    growth: 0.02,
    shares: 120e6,
  },
  {
    code: 'DM03',
    name: 'デモ商事',
    nameEn: 'Demo Trading',
    sector17: '商社・卸売',
    sector33: '卸売業',
    market: 'プライム',
    scale: 'デモ（架空）',
    seed: 33,
    startPrice: 1650,
    drift: 0.09,
    vol: 0.24,
    beta: 1.2,
    baseVolume: 3_200_000,
    listedFrom: DEMO_START_DATE,
    sales: 2_100e9,
    margin: 0.05,
    growth: 0.06,
    shares: 1_400e6,
  },
  {
    code: 'DM04',
    name: 'デモ銀行',
    nameEn: 'Demo Bank',
    sector17: '銀行',
    sector33: '銀行業',
    market: 'プライム',
    scale: 'デモ（架空）',
    seed: 44,
    startPrice: 980,
    drift: 0.07,
    vol: 0.27,
    beta: 1.3,
    baseVolume: 9_500_000,
    listedFrom: DEMO_START_DATE,
    sales: 1_300e9,
    margin: 0.18,
    growth: 0.03,
    shares: 2_600e6,
  },
  {
    code: 'DM05',
    name: 'デモ通信',
    nameEn: 'Demo Telecom',
    sector17: '情報通信・サービスその他',
    sector33: '情報・通信業',
    market: 'プライム',
    scale: 'デモ（架空）',
    seed: 55,
    startPrice: 4310,
    drift: 0.02,
    vol: 0.16,
    beta: 0.6,
    baseVolume: 1_100_000,
    listedFrom: DEMO_START_DATE,
    sales: 1_600e9,
    margin: 0.16,
    growth: 0.01,
    shares: 900e6,
  },
  {
    code: 'DM06',
    name: 'デモ製薬',
    nameEn: 'Demo Pharma',
    sector17: '医薬品',
    sector33: '医薬品',
    market: 'プライム',
    scale: 'デモ（架空）',
    seed: 66,
    startPrice: 5720,
    drift: -0.02,
    vol: 0.25,
    beta: 0.4,
    baseVolume: 900_000,
    listedFrom: DEMO_START_DATE,
    sales: 520e9,
    margin: 0.12,
    growth: -0.01,
    shares: 330e6,
    lossYear: 2025,
  },
  {
    code: 'DM07',
    name: 'デモ電力',
    nameEn: 'Demo Power',
    sector17: '電力・ガス',
    sector33: '電気・ガス業',
    market: 'プライム',
    scale: 'デモ（架空）',
    seed: 77,
    startPrice: 1240,
    drift: 0.04,
    vol: 0.2,
    beta: 0.7,
    baseVolume: 2_400_000,
    listedFrom: DEMO_START_DATE,
    haltDays: ['2025-09-11', '2025-09-12'],
    sales: 2_700e9,
    margin: 0.04,
    growth: 0.02,
    shares: 1_100e6,
  },
  {
    code: 'DM08',
    name: 'デモ不動産',
    nameEn: 'Demo Realty',
    sector17: '不動産',
    sector33: '不動産業',
    market: 'スタンダード',
    scale: 'デモ（架空）',
    seed: 88,
    startPrice: 760,
    drift: 0.05,
    vol: 0.3,
    beta: 1.0,
    baseVolume: 1_500_000,
    listedFrom: DEMO_START_DATE,
    sales: 140e9,
    margin: 0.14,
    growth: 0.05,
    shares: 210e6,
  },
  {
    code: 'DM09',
    name: 'デモ物流',
    nameEn: 'Demo Logistics',
    sector17: '運輸・物流',
    sector33: '陸運業',
    market: 'スタンダード',
    scale: 'デモ（架空）',
    seed: 99,
    startPrice: 2050,
    drift: 0.01,
    vol: 0.19,
    beta: 0.8,
    baseVolume: 420_000,
    listedFrom: DEMO_START_DATE,
    sales: 260e9,
    margin: 0.06,
    growth: 0.03,
    shares: 85e6,
  },
  {
    code: 'DM10',
    name: 'デモAIラボ',
    nameEn: 'Demo AI Lab',
    sector17: '情報通信・サービスその他',
    sector33: 'サービス業',
    market: 'グロース',
    scale: 'デモ（架空）',
    seed: 110,
    startPrice: 1800,
    drift: 0.15,
    vol: 0.55,
    beta: 1.5,
    baseVolume: 2_900_000,
    listedFrom: '2025-03-17',
    sales: 9e9,
    margin: -0.08,
    growth: 0.45,
    shares: 48e6,
  },
]

/** Deterministic PRNG (mulberry32). */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function normal(rand: () => number): number {
  const u = Math.max(rand(), 1e-12)
  const v = rand()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

function businessDays(from: string, to: string): string[] {
  const days: string[] = []
  const cursor = new Date(`${from}T00:00:00Z`)
  const end = new Date(`${to}T00:00:00Z`)
  while (cursor <= end) {
    const dow = cursor.getUTCDay()
    const iso = cursor.toISOString().slice(0, 10)
    const md = iso.slice(5)
    const holiday = md === '01-01' || md === '01-02' || md === '01-03' || md === '12-31'
    if (dow !== 0 && dow !== 6 && !holiday) days.push(iso)
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return days
}

const TRADING_DAYS = businessDays(DEMO_START_DATE, DEMO_END_DATE)
const YEAR = 245

/** Shared market factor, so companies with a higher beta move together. */
const MARKET_RETURNS: number[] = (() => {
  const rand = mulberry32(2024)
  return TRADING_DAYS.map(() => 0.05 / YEAR + (0.15 / Math.sqrt(YEAR)) * normal(rand))
})()

const barsCache = new Map<string, Bar[]>()

function round(value: number): number {
  return Math.max(1, Math.round(value))
}

export function generateBars(company: DemoCompany): Bar[] {
  const cached = barsCache.get(company.code)
  if (cached !== undefined) return cached
  const rand = mulberry32(company.seed)
  const halts = new Set(company.haltDays ?? [])
  const bars: Bar[] = []
  let close = company.startPrice
  TRADING_DAYS.forEach((date, i) => {
    const market = MARKET_RETURNS[i] ?? 0
    const idio = company.drift / YEAR + (company.vol / Math.sqrt(YEAR)) * normal(rand)
    const ret = company.beta * market + idio
    const gap = 0.004 * normal(rand)
    const wickUp = Math.abs(normal(rand)) * 0.006
    const wickDown = Math.abs(normal(rand)) * 0.006
    const volumeNoise = Math.exp(0.35 * normal(rand))
    if (date < company.listedFrom) return
    if (halts.has(date)) {
      bars.push({
        date,
        open: null,
        high: null,
        low: null,
        close: null,
        volume: null,
        turnover: null,
      })
      return
    }
    const open = round(close * (1 + gap))
    const nextClose = round(close * Math.exp(ret))
    const high = round(Math.max(open, nextClose) * (1 + wickUp))
    const low = round(Math.min(open, nextClose) * (1 - wickDown))
    const volume = Math.round((company.baseVolume * volumeNoise) / 100) * 100
    bars.push({ date, open, high, low, close: nextClose, volume, turnover: nextClose * volume })
    close = nextClose
  })
  barsCache.set(company.code, bars)
  return bars
}

export function generateFinancials(company: DemoCompany): FinancialStatement[] {
  const rand = mulberry32(company.seed * 7 + 3)
  const firstYear = company.listedFrom > '2025-01-01' ? 2025 : 2022
  const out: FinancialStatement[] = []
  let sales = company.sales / Math.pow(1 + company.growth, 2026 - firstYear)
  for (let year = firstYear; year <= 2026; year++) {
    sales *= 1 + company.growth + 0.02 * normal(rand)
    const margin = year === company.lossYear ? -0.04 : company.margin + 0.01 * normal(rand)
    const operatingProfit = sales * margin
    const netProfit = operatingProfit * 0.68
    const equity = sales * 0.55
    const totalAssets = equity / (0.42 + 0.05 * rand())
    out.push({
      disclosedAt: `${year}-05-${String(8 + (company.seed % 7)).padStart(2, '0')}T15:00:00`,
      fiscalYearStart: `${year - 1}-04-01`,
      fiscalYearEnd: `${year}-03-31`,
      periodType: 'FY',
      docType: 'FYFinancialStatements_Consolidated_JP',
      sales: Math.round(sales),
      operatingProfit: Math.round(operatingProfit),
      netProfit: Math.round(netProfit),
      eps: Math.round((netProfit / company.shares) * 100) / 100,
      roe: Math.round((netProfit / equity) * 10000) / 10000,
      equityRatio: Math.round((equity / totalAssets) * 1000) / 1000,
      totalAssets: Math.round(totalAssets),
      equity: Math.round(equity),
    })
  }
  return out
}

function findCompany(code: string): DemoCompany | undefined {
  const upper = code.trim().toUpperCase()
  return COMPANIES.find((c) => c.code === upper)
}

function toListing(company: DemoCompany): Listing {
  const { code, name, nameEn, sector17, sector33, market, scale } = company
  return { code, name, nameEn, sector17, sector33, market, scale }
}

export const demoListings: Listing[] = COMPANIES.map(toListing)

export const demoSource: DataSource = {
  kind: 'demo',
  async listings() {
    return { data: demoListings, fetchedAt: DEMO_FETCHED_AT, origin: 'demo' }
  },
  async bars(code) {
    const company = findCompany(code)
    return {
      data: company === undefined ? [] : generateBars(company),
      fetchedAt: DEMO_FETCHED_AT,
      origin: 'demo',
    }
  },
  async financials(code) {
    const company = findCompany(code)
    return {
      data: company === undefined ? [] : generateFinancials(company),
      fetchedAt: DEMO_FETCHED_AT,
      origin: 'demo',
    }
  },
}
